// Personal fork: shared types and wording for the packs page.
import { type BoosterValue, matchesFilters, type PackFilters } from '@/lib/packValue'
import { tierFor, tiers, twoStarPosition } from '@/lib/rankings'
import { demandScore, getCardValue, kindLabel, type TwoStarKind } from '@/lib/ValueDB'
import type { Card, Rarity } from '@/types'

export interface PackRow extends BoosterValue {
  id: string
}

/** Min/max across all packs, so headline bars show spread instead of all sitting near 100%. */
export interface Range {
  min: number
  max: number
}

// Every rarity a booster can give, in the order the game lists them; promos never come from a booster
export const rarityOptions: Rarity[] = ['◊', '◊◊', '◊◊◊', '◊◊◊◊', '☆', '☆☆', '☆☆☆', '✵', '✵✵', 'Crown Rare']

// ?rarity= values, readable in a URL where the symbols would be percent-escaped
export const raritySlug: Record<Rarity, string> = {
  '◊': '1d',
  '◊◊': '2d',
  '◊◊◊': '3d',
  '◊◊◊◊': '4d',
  '☆': '1s',
  '☆☆': '2s',
  '☆☆☆': '3s',
  '✵': '1sh',
  '✵✵': '2sh',
  'Crown Rare': 'crown',
  P: 'promo',
}

export const showRarity = (r: Rarity) => (r === 'Crown Rare' ? 'Crown' : r)

/** Which tier scale a rarity is judged by: ☆☆ by community vote Elo, every other rarity by trade demand. */
export const scaleName = (r: Rarity) => (r === '☆☆' ? 'vote' : 'Most wanted')

// Same names as the overview's Value filter; the tiers are the vote tiers for ☆☆ and Most wanted for the rest
export const tierOptions = ['all', 'top', 'hot'] as const
export type TierOption = (typeof tierOptions)[number]

export const tierLabel = (key: TierOption, r: Rarity) =>
  key === 'all' ? `Any ${showRarity(r)}` : `${key === 'hot' ? 'Hot (SSS–S)' : 'Top tiers (SSS–A)'} by ${scaleName(r)} tier`

// Lowest tier each option keeps, as an index into `tiers` (0 = SSS, 3 = A)
export const tierMax: Record<TierOption, number> = { all: Number.POSITIVE_INFINITY, top: 3, hot: 2 }

export const kindOptions = ['all', 'full_art', 'trainer', 'rainbow'] as const
export type KindOption = (typeof kindOptions)[number]

export const showKind = (k: KindOption) => (k === 'all' ? 'All' : kindLabel[k])

/** A card's tier for its chip; undefined for cards nobody trades (☆☆☆, Crown Rare), which get no chip. */
export const cardTier = (card: Card) => {
  const index = tierFor(card)
  return index === undefined ? undefined : tiers[index]
}

export const tierChipTitle = (card: Card) =>
  card.rarity === '☆☆'
    ? `Vote tier ${cardTier(card)?.name} · #${twoStarPosition(card.card_id)} of all ☆☆ by community vote`
    : `Most wanted tier ${cardTier(card)?.name} · ×${demandScore(getCardValue(card.card_id)).toFixed(1)} wishlists per trade offer`

/** Per-pack odds read better as "1 in N packs" than as fractions of a percent. */
export const oneIn = (p: number) => (p > 0 ? `1 in ${Math.round(1 / p)}` : '–')

/** "1 in 28 packs"; common pulls (◊ and the like) as "83% of packs", where "1 in 1" would round the odds away. */
export const packOdds = (p: number) => (p >= 0.5 ? `${Math.round(100 * p)}% of packs` : `${oneIn(p)} packs`)

/** The verb after packOdds: "1 in 28 packs gives", "83% of packs give". */
export const gives = (p: number) => (p >= 0.5 ? 'give' : 'gives')

export const fill = (x: number, { min, max }: Range) => (max > min ? 0.08 + (0.92 * (x - min)) / (max - min) : 1)

export interface TargetFilters extends PackFilters {
  tier: TierOption
}

/** What a pack is ranked on, e.g. "a Hot trainer ☆☆ you're missing" or "a top-tier ◊◊◊"; shared by the cards, the banner and the chart. */
export function describeTarget({ rarity, tier, kind, onlyMissing }: TargetFilters) {
  const words = [tier === 'hot' ? 'Hot' : tier === 'top' ? 'top-tier' : '', kind ? kindLabel[kind as TwoStarKind].toLowerCase() : '', rarity]
  const phrase = words.filter(Boolean).join(' ')
  return `a ${phrase}${onlyMissing ? " you're missing" : ''}`
}

/** The headline for a pack: the odds and what they're for, or why there are none. */
export function packStat(pack: PackRow, filters: TargetFilters) {
  if (pack.perPack > 0) {
    return { stat: packOdds(pack.perPack), caption: `${gives(pack.perPack)} ${describeTarget(filters)}` }
  }
  if (filters.onlyMissing && pack.missing === 0) {
    return { stat: 'None left', caption: `you own every ${filters.rarity} here` }
  }
  return filters.onlyMissing && pack.cards.some((c) => matchesFilters(c, undefined, filters))
    ? { stat: 'None left', caption: `you own every ${filters.rarity} here that matches` }
    : { stat: 'None', caption: `no ${filters.rarity} here match` }
}
