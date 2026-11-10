// Personal fork: the overview's Value filter and tier tile, from the Rankings "Most wanted" tiers (deluxe foils
// excluded, as on Rankings by default).
import { mostWantedTier, tiers } from '@/lib/rankings'
import type { Card } from '@/types'

export const valueOptions = ['all', 'top', 'hot'] as const
export type ValueOption = (typeof valueOptions)[number]

export const valueLabels: Record<ValueOption, string> = {
  all: 'All cards',
  top: 'Top tiers (SSS–A)',
  hot: 'Hot (SSS–S)',
}

// Lowest tier each option keeps, as an index into `tiers` (0 = SSS, 3 = A)
export const valueMaxTier: Record<ValueOption, number> = { all: Number.POSITIVE_INFINITY, top: 3, hot: 2 }

/** Most wanted tier index (0 = SSS) by internal_id; reprints share their original's id, so they share its tier. */
export const wantedTierOf = mostWantedTier

export const inValue = (value: ValueOption, internalId: number) =>
  value === 'all' || (wantedTierOf(internalId) ?? Number.POSITIVE_INFINITY) <= valueMaxTier[value]

export interface TierCount {
  available: number
  collected: number
}

/** Unique ranked cards per Most wanted tier in `available`, and how many of them are in `collected`. */
export function countByTier(available: Card[], collected: Card[]): TierCount[] {
  const count = (cards: Card[]) => {
    const ids = tiers.map(() => new Set<number>())
    for (const c of cards) {
      const tier = wantedTierOf(c.internal_id)
      if (tier !== undefined) {
        ids[tier].add(c.internal_id)
      }
    }
    return ids.map((set) => set.size)
  }
  const a = count(available)
  const c = count(collected)
  return tiers.map((_, i) => ({ available: a[i], collected: c[i] }))
}
