// Personal fork: rank boosters by the chance one pack gives a card you want, of one rarity or of all of them.
// "Want" is a filter over the booster's cards of that rarity (or every card, each on its own scale): at or above a tier (☆☆ by community vote Elo, every
// other rarity by Most wanted), of a style (☆☆ only: full art / trainer / rainbow), and optionally only the ones
// you're missing. perPack uses the real pull odds (stats.ts), rare packs included.

import { allCards, expansions } from '@/lib/CardsDB'
import { tierFor, tiers } from '@/lib/rankings'
import { pullRate } from '@/lib/stats'
import { getCardValue, type TwoStarKind, valueSortKey } from '@/lib/ValueDB'
import { type Card, type Collection, type ExpansionId, type Rarity, rarities } from '@/types'

export type PackRarity = Rarity | 'all'

export interface PackFilters {
  rarity: PackRarity
  maxTier: number // lowest tier index that counts (0 = SSS); Infinity for every card, ranked or not
  kind?: TwoStarKind // ☆☆ only; undefined for every style
  onlyMissing: boolean
}

export const defaultPackFilters: PackFilters = { rarity: '☆☆', maxTier: Number.POSITIVE_INFINITY, onlyMissing: true }

export interface BoosterValue {
  expansionId: ExpansionId
  expansionName: string
  packName: string
  color: string
  cards: Card[] // every card of the rarity (or of every rarity), best first
  wanted: Card[] // the ones matching the filters, best first
  missing: number // every missing card of the rarity, whatever the filters
  tierMix: { total: number; owned: number }[] // per tier, index as in `tiers`, then one for unranked cards
  minVotes: number // fewest votes behind any of its ☆☆'s Elo; Infinity without ☆☆
  best: Card
  perPack: number // chance one pack opened gives a card in `wanted`
}

export const ownsCard = (collection: Collection | undefined, card: Card) => (collection?.get(card.internal_id)?.amount_owned ?? 0) > 0

export const matchesFilters = (card: Card, collection: Collection | undefined, { maxTier, kind, onlyMissing }: PackFilters) =>
  (maxTier === Number.POSITIVE_INFINITY || (tierFor(card) ?? Number.POSITIVE_INFINITY) <= maxTier) &&
  (!kind || getCardValue(card.card_id)?.kind === kind) &&
  !(onlyMissing && ownsCard(collection, card))

// openable === false excludes the Deluxe packs (A4b, B4b) and promos
const openableExpansions = expansions.filter((e) => e.openable && !e.promo)

/** A rarity's cards in openable packs (every rarity's for 'all'); ☆☆ only those with an Elo, since every ☆☆ stat on the page comes from it. */
const poolOf = (rarity: PackRarity) =>
  allCards.filter(
    (c) =>
      (rarity === 'all' ? c.rarity !== 'P' : c.rarity === rarity) &&
      openableExpansions.some((e) => e.id === c.expansion) &&
      (c.rarity !== '☆☆' || getCardValue(c.card_id)?.adj !== undefined),
  )

const rarityRank = (card: Card) => rarities.indexOf(card.rarity)

/**
 * Best first. One rarity sorts by its own score (Elo for ☆☆, demand otherwise). Every rarity can't: the two scores
 * aren't comparable, and valueSortKey would put each ☆☆ ahead of everything. So tier first, then the rarer card, then score.
 */
const bestFirst = (rarity: PackRarity) => (a: Card, b: Card) =>
  rarity === 'all'
    ? (tierFor(a) ?? tiers.length) - (tierFor(b) ?? tiers.length) || rarityRank(b) - rarityRank(a) || valueSortKey(b.card_id) - valueSortKey(a.card_id)
    : valueSortKey(b.card_id) - valueSortKey(a.card_id)

const bestTiers = new Map<PackRarity, number | undefined>()

/** The best tier index any openable card of the rarity reaches, so tier choices it can't meet can be switched off. */
export function bestTierOf(rarity: PackRarity): number | undefined {
  if (!bestTiers.has(rarity)) {
    const ranked = poolOf(rarity)
      .map(tierFor)
      .filter((t) => t !== undefined)
    bestTiers.set(rarity, ranked.length ? Math.min(...ranked) : undefined)
  }
  return bestTiers.get(rarity)
}

export function getBoosterValues(collection: Collection | undefined, filters: PackFilters = defaultPackFilters): BoosterValue[] {
  const result: BoosterValue[] = []
  const pool = poolOf(filters.rarity)

  for (const expansion of openableExpansions) {
    const inSet = pool.filter((c) => c.expansion === expansion.id)
    for (const pack of expansion.packs.filter((p) => p.name !== 'everypack')) {
      const cards = inSet.filter((c) => c.pack === pack.name || c.pack === 'everypack').toSorted(bestFirst(filters.rarity))
      if (cards.length === 0) {
        continue
      }
      const wanted = cards.filter((c) => matchesFilters(c, collection, filters))
      const tierMix = [...tiers, undefined].map(() => ({ total: 0, owned: 0 }))
      for (const c of cards) {
        const mix = tierMix[tierFor(c) ?? tiers.length]
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
        minVotes: Math.min(...cards.filter((c) => c.rarity === '☆☆').map((c) => getCardValue(c.card_id)?.votes ?? 0)),
        best: cards[0],
        perPack: wanted.length && expansion.packStructure ? pullRate(wanted, expansion, pack, false) : 0,
      })
    }
  }
  return result
}
