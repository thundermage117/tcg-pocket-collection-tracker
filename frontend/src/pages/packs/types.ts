// Personal fork: shared types and wording for the packs page.
import { type BoosterValue, matchesFilters, type PackFilters } from '@/lib/packValue'
import { tiers, twoStarPosition, twoStarTier } from '@/lib/rankings'
import { kindLabel, type TwoStarKind } from '@/lib/ValueDB'
import type { Card } from '@/types'

export interface PackRow extends BoosterValue {
  id: string
}

/** Min/max across all packs, so headline bars show spread instead of all sitting near 100%. */
export interface Range {
  min: number
  max: number
}

// Same names as the overview's Value filter, but over the ☆☆ Elo tiers (Rankings' default tab), not Most wanted
export const tierOptions = ['all', 'top', 'hot'] as const
export type TierOption = (typeof tierOptions)[number]

export const tierLabels: Record<TierOption, string> = {
  all: 'Any ☆☆',
  top: 'Top tiers (SSS–A)',
  hot: 'Hot (SSS–S)',
}

// Lowest tier each option keeps, as an index into `tiers` (0 = SSS, 3 = A)
export const tierMax: Record<TierOption, number> = { all: Number.POSITIVE_INFINITY, top: 3, hot: 2 }

export const kindOptions = ['all', 'full_art', 'trainer', 'rainbow'] as const
export type KindOption = (typeof kindOptions)[number]

export const showKind = (k: KindOption) => (k === 'all' ? 'All' : kindLabel[k])

/** A ☆☆'s Elo tier, for its chip; every card on this page has an Elo, so the fallback never shows. */
export const cardTier = (card: Card) => tiers[twoStarTier(card.card_id) ?? tiers.length - 1]

export const tierChipTitle = (card: Card) => `Tier ${cardTier(card).name} · #${twoStarPosition(card.card_id)} of all ☆☆ by community vote`

/** Per-pack odds read better as "1 in N packs" than as fractions of a percent. */
export const oneIn = (p: number) => (p > 0 ? `1 in ${Math.round(1 / p)}` : '–')

export const fill = (x: number, { min, max }: Range) => (max > min ? 0.08 + (0.92 * (x - min)) / (max - min) : 1)

export interface TargetFilters extends PackFilters {
  tier: TierOption
}

/** What a pack is ranked on, e.g. "a Hot trainer ☆☆ you're missing"; shared by the cards, the banner and the chart. */
export function describeTarget({ tier, kind, onlyMissing }: TargetFilters) {
  const words = [tier === 'hot' ? 'Hot' : tier === 'top' ? 'top-tier' : '', kind ? kindLabel[kind as TwoStarKind].toLowerCase() : '', '☆☆']
  const phrase = words.filter(Boolean).join(' ')
  return `a ${phrase}${onlyMissing ? " you're missing" : ''}`
}

/** The headline for a pack: the odds and what they're for, or why there are none. */
export function packStat(pack: PackRow, filters: TargetFilters) {
  if (pack.perPack > 0) {
    return { stat: `${oneIn(pack.perPack)} packs`, caption: `gives ${describeTarget(filters)}` }
  }
  if (filters.onlyMissing && pack.missing === 0) {
    return { stat: 'None left', caption: 'you own every ☆☆ here' }
  }
  return filters.onlyMissing && pack.cards.some((c) => matchesFilters(c, undefined, filters))
    ? { stat: 'None left', caption: 'you own every ☆☆ here that matches' }
    : { stat: 'None', caption: 'no ☆☆ here match' }
}
