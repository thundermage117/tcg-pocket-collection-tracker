// Personal fork: the overview's pack value map. Per openable pack, the cards you're missing from its pool, split by Most
// wanted tier (the Value tiers tile's scale), so the map shows where the valuable gaps are.
import { expansions } from '@/lib/CardsDB.ts'
import { tiers } from '@/lib/rankings'
import { wantedTierOf } from '@/pages/overview/valueTiers'
import type { Card, ExpansionId, Pack } from '@/types'

export interface TierGap {
  tier: number // index into `tiers`; tiers.length for unranked cards (☆☆☆, Crown Rare, ones nobody has voted on)
  cards: Card[]
}

export interface PackGap {
  pack: Pack
  missing: number
  byTier: TierGap[] // best tier first, only tiers with a missing card
}

export function getPackTierMap(availableCards: Card[], collectedCards: Card[]) {
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
          const gaps = byTier.filter((t) => t.cards.size > 0).map(({ tier, cards }) => ({ tier, cards: [...cards.values()] }))
          return { pack, missing: gaps.reduce((sum, t) => sum + t.cards.length, 0), byTier: gaps }
        }),
    )
  }
  return map
}
