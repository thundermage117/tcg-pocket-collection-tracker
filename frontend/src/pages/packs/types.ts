// Personal fork: shared types and wording for the packs page.
import { type BoosterValue, matchesFilters, type PackFilters, type PackRarity } from '@/lib/packValue'
import { tierFor, tiers, twoStarPosition } from '@/lib/rankings'
import { demandScore, getCardValue, kindLabel, type TwoStarKind } from '@/lib/ValueDB'
import type { Card } from '@/types'

export interface PackRow extends BoosterValue {
  id: string
}

/** Min/max across all packs, so headline bars show spread instead of all sitting near 100%. */
export interface Range {
  min: number
  max: number
}

// Every rarity a booster can give, in the order the game lists them, after 'all'; promos never come from a booster
export const rarityOptions: PackRarity[] = ['all', '◊', '◊◊', '◊◊◊', '◊◊◊◊', '☆', '☆☆', '☆☆☆', '✵', '✵✵', 'Crown Rare']

/** What the page optimises: the cards you want most (Value) or the most cards you're missing (Completion). */
export const goalOptions = ['value', 'complete'] as const
export type Goal = (typeof goalOptions)[number]
export const goalLabels: Record<Goal, string> = { value: 'Value', complete: 'Completion' }

// ?rarity= values, readable in a URL where the symbols would be percent-escaped
export const raritySlug: Record<PackRarity, string> = {
  all: 'all',
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

export const showRarity = (r: PackRarity) => (r === 'all' ? 'All' : r === 'Crown Rare' ? 'Crown' : r)

/** The rarity as a noun in a sentence: "an S+ ◊◊◊", "an A+ card", "12 ☆☆", "40 cards". */
export const rarityNoun = (r: PackRarity) => (r === 'all' ? 'card' : r)
export const rarityCount = (n: number, r: PackRarity) => (r === 'all' ? `${n} card${n === 1 ? '' : 's'}` : `${n} ${r}`)

/** Which tier scale a rarity is judged by: ☆☆ by community vote Elo, every other rarity by trade demand. */
export const scaleName = (r: PackRarity) => (r === '☆☆' ? 'vote' : r === 'all' ? 'vote (☆☆) or Most wanted' : 'Most wanted')

// Same names as the overview's Value filter; the tiers are the vote tiers for ☆☆ and Most wanted for the rest
export const tierOptions = ['all', 'top', 'hot'] as const
export type TierOption = (typeof tierOptions)[number]

export const tierLabel = (key: TierOption, r: PackRarity) =>
  key === 'all' ? `Any ${r === 'all' ? 'card' : showRarity(r)}` : `${key === 'hot' ? 'S+ (SSS–S)' : 'A+ (SSS–A)'} by ${scaleName(r)} tier`

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

/** What a pack is ranked on, e.g. "an S+ trainer ☆☆ you're missing" or "an A+ ◊◊◊"; shared by the cards, the banner and the chart. */
export function describeTarget({ rarity, tier, kind, onlyMissing }: TargetFilters) {
  const words = [tier === 'hot' ? 'S+' : tier === 'top' ? 'A+' : '', kind ? kindLabel[kind as TwoStarKind].toLowerCase() : '', rarityNoun(rarity)]
  const phrase = words.filter(Boolean).join(' ')
  return `${tier === 'all' ? 'a' : 'an'} ${phrase}${onlyMissing ? " you're missing" : ''}`
}

/** The headline for a pack: the odds and what they're for, or why there are none. */
export function packStat(pack: PackRow, filters: TargetFilters) {
  if (pack.perPack > 0) {
    return { stat: packOdds(pack.perPack), caption: `${gives(pack.perPack)} ${describeTarget(filters)}` }
  }
  if (filters.onlyMissing && pack.missing === 0) {
    return { stat: 'None left', caption: `you own every ${rarityNoun(filters.rarity)} here` }
  }
  return filters.onlyMissing && pack.cards.some((c) => matchesFilters(c, undefined, filters))
    ? { stat: 'None left', caption: `you own every ${rarityNoun(filters.rarity)} here that matches` }
    : { stat: 'None', caption: `no ${rarityNoun(filters.rarity)} here match${filters.rarity === 'all' ? 'es' : ''}` }
}

/**
 * A value card's count line in plain words: "4 of your 11 missing ☆☆ are A+", "11 of 13 ☆☆ missing",
 * "2 of 13 ☆☆ are S+ trainers", "You own all 13 ☆☆".
 */
export function poolLine(pack: PackRow, { rarity, tier, kind, onlyMissing }: TargetFilters, hasCollection: boolean) {
  const total = rarityCount(pack.cards.length, rarity)
  if (hasCollection && pack.missing === 0) {
    return `You own all ${total}`
  }
  const n = pack.wanted.length
  const quality = [tier === 'hot' ? 'S+' : tier === 'top' ? 'A+' : '', kind ? `${kindLabel[kind as TwoStarKind].toLowerCase()}${n === 1 ? '' : 's'}` : '']
    .filter(Boolean)
    .join(' ')
  const are = n === 1 ? 'is' : 'are'
  const missing = `${pack.missing} of ${total} missing`
  if (hasCollection && onlyMissing) {
    const noun = rarity === 'all' ? `card${pack.missing === 1 ? '' : 's'}` : rarity
    return quality ? `${n} of your ${pack.missing} missing ${noun} ${are} ${quality}` : missing
  }
  if (quality) {
    return `${n} of ${total} ${are} ${quality}`
  }
  return hasCollection ? missing : total
}

/** Missing cards one pack gives on average: "≈1.8 new cards per pack" above one, "1 new card every 6 packs" below. */
export function newPerPack(x: number) {
  if (x <= 0) {
    return { stat: '–', caption: 'new cards per pack' }
  }
  return x >= 1 ? { stat: `≈${x.toFixed(1)}`, caption: 'new cards per pack' } : { stat: '1 new card', caption: `every ${Math.round(1 / x)} packs` }
}

/** The completion headline for a pack: new cards per pack, or "Complete" once every card of the scope is owned. */
export function completionStat(pack: PackRow, rarity: PackRarity) {
  return pack.missing === 0 ? { stat: 'Complete', caption: `you own every ${rarityNoun(rarity)} here` } : newPerPack(pack.expectedNew)
}
