// Personal fork: rank boosters by the chance one pack gives a ☆☆ you want.
// "Want" is a filter over the booster's ☆☆ pool: at or above a ☆☆ Elo tier, of a style (full art / trainer /
// rainbow), and optionally only the ones you're missing. perPack uses the real pull odds (stats.ts), rare packs included.

import { allCards, expansions } from '@/lib/CardsDB'
import { tiers, twoStarTier } from '@/lib/rankings'
import { pullRate } from '@/lib/stats'
import { getCardValue, type TwoStarKind } from '@/lib/ValueDB'
import type { Card, Collection, ExpansionId } from '@/types'

export interface PackFilters {
  maxTier: number // lowest tier index that counts (0 = SSS); Infinity for every ☆☆
  kind?: TwoStarKind // undefined for every style
  onlyMissing: boolean
}

export interface BoosterValue {
  expansionId: ExpansionId
  expansionName: string
  packName: string
  color: string
  cards: Card[] // every ☆☆, best first
  wanted: Card[] // the ones matching the filters, best first
  missing: number // every missing ☆☆, whatever the filters
  tierMix: { total: number; owned: number }[] // per tier, index as in `tiers`
  minVotes: number
  best: Card
  perPack: number // chance one pack opened gives a card in `wanted`
}

const adjOf = (card: Card) => getCardValue(card.card_id)?.adj ?? 0

export const ownsCard = (collection: Collection | undefined, card: Card) => (collection?.get(card.internal_id)?.amount_owned ?? 0) > 0

export const matchesFilters = (card: Card, collection: Collection | undefined, { maxTier, kind, onlyMissing }: PackFilters) =>
  (twoStarTier(card.card_id) ?? Number.POSITIVE_INFINITY) <= maxTier &&
  (!kind || getCardValue(card.card_id)?.kind === kind) &&
  !(onlyMissing && ownsCard(collection, card))

export function getBoosterValues(
  collection: Collection | undefined,
  filters: PackFilters = { maxTier: Number.POSITIVE_INFINITY, onlyMissing: true },
): BoosterValue[] {
  const result: BoosterValue[] = []

  for (const expansion of expansions) {
    // openable === false excludes the Deluxe packs (A4b, B4b) and promos
    if (!expansion.openable || expansion.promo) {
      continue
    }
    const twoStars = allCards.filter((c) => c.expansion === expansion.id && c.rarity === '☆☆' && getCardValue(c.card_id)?.adj !== undefined)
    for (const pack of expansion.packs.filter((p) => p.name !== 'everypack')) {
      const cards = twoStars.filter((c) => c.pack === pack.name || c.pack === 'everypack').toSorted((a, b) => adjOf(b) - adjOf(a))
      if (cards.length === 0) {
        continue
      }
      const wanted = cards.filter((c) => matchesFilters(c, collection, filters))
      const tierMix = tiers.map(() => ({ total: 0, owned: 0 }))
      for (const c of cards) {
        const mix = tierMix[twoStarTier(c.card_id) ?? tiers.length - 1]
        mix.total++
        mix.owned += ownsCard(collection, c) ? 1 : 0
      }
      result.push({
        expansionId: expansion.id,
        expansionName: expansion.name,
        packName: pack.name,
        color: pack.color,
        cards,
        wanted,
        missing: cards.filter((c) => !ownsCard(collection, c)).length,
        tierMix,
        minVotes: Math.min(...cards.map((c) => getCardValue(c.card_id)?.votes ?? 0)),
        best: cards[0],
        perPack: wanted.length && expansion.packStructure ? pullRate(wanted, expansion, pack, false) : 0,
      })
    }
  }
  return result
}
