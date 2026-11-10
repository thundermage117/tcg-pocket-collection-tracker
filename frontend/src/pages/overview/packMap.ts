// Personal fork: the overview's pack value map. Per openable pack, the cards you're missing from its pool, split by Most
// wanted tier (the Value tiers tile's scale), so the map shows where the valuable gaps are.
import { expansions } from '@/lib/CardsDB.ts'
import { tiers } from '@/lib/rankings'
import { pullRateForSpecificCard } from '@/lib/stats'
import { wantedTierOf } from '@/pages/overview/valueTiers'
import type { Card, ExpansionId, Pack } from '@/types'

export interface TierGap {
  tier: number // index into `tiers`; tiers.length for unranked cards (☆☆☆, Crown Rare, ones nobody has voted on)
  cards: Card[]
  odds: number // how many of these one pack gives on average (0 unless asked for)
}

export interface PackGap {
  pack: Pack
  missing: number
  odds: number // missing cards one pack gives on average: the packs page's expectedNew, under the overview's filters
  byTier: TierGap[] // best tier first, only tiers with a missing card
}

/** withOdds adds each tier's pull odds, a pull rate per missing card, so it's only worked out when the map is sized by them */
export function getPackTierMap(availableCards: Card[], collectedCards: Card[], withOdds = false) {
  const owned = new Set(collectedCards.map((c) => c.internal_id))
  const missing = Object.groupBy(
    availableCards.filter((c) => !owned.has(c.internal_id)),
    (c) => c.expansion,
  ) as Partial<Record<ExpansionId, Card[]>>

  const map = new Map<ExpansionId, PackGap[]>()
  for (const expansion of expansions.filter((e) => e.openable)) {
    map.set(
      expansion.id,
      expansion.packs
        .filter((p) => p.name !== 'everypack')
        .map((pack) => {
          // the same pool as the "New card" chance: the pack's own cards plus the set's everypack cards, each once
          const byTier = [...tiers, undefined].map((_, tier) => ({ tier, cards: new Map<number, Card>() }))
          for (const c of missing[expansion.id] ?? []) {
            if (c.pack === pack.name || c.pack === 'everypack') {
              byTier[wantedTierOf(c.internal_id) ?? tiers.length].cards.set(c.internal_id, c)
            }
          }
          // by linearity, the expected number of distinct missing cards in one pack (pullRateForSpecificCard is a percent)
          const odds = (cards: Card[]) =>
            withOdds && expansion.packStructure ? cards.reduce((sum, c) => sum + pullRateForSpecificCard(expansion, pack.name, c) / 100, 0) : 0
          const gaps = byTier
            .filter((t) => t.cards.size > 0)
            .map(({ tier, cards }) => {
              const list = [...cards.values()]
              return { tier, cards: list, odds: odds(list) }
            })
          return {
            pack,
            missing: gaps.reduce((sum, t) => sum + t.cards.length, 0),
            odds: gaps.reduce((sum, t) => sum + t.odds, 0),
            byTier: gaps,
          }
        }),
    )
  }
  return map
}
