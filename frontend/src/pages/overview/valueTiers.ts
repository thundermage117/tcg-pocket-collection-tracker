// Personal fork: the overview's Value filter and tier tile, from the Rankings "Most wanted" tiers (deluxe foils
// excluded, as on Rankings by default).
import { getMostWanted } from '@/lib/rankings'

export const valueOptions = ['all', 'top', 'hot'] as const
export type ValueOption = (typeof valueOptions)[number]

export const valueLabels: Record<ValueOption, string> = {
  all: 'All cards',
  top: 'Top tiers (SSS–A)',
  hot: 'Hot (SSS–S)',
}

// Lowest tier each option keeps, as an index into `tiers` (0 = SSS, 3 = A)
export const valueMaxTier: Record<ValueOption, number> = { all: Number.POSITIVE_INFINITY, top: 3, hot: 2 }

let tierById: Map<number, number> | undefined

/** Most wanted tier index (0 = SSS) by internal_id; reprints share their original's id, so they share its tier. */
export function wantedTierOf(internalId: number): number | undefined {
  tierById ??= new Map(getMostWanted().map((e) => [e.card.internal_id, e.tier]))
  return tierById.get(internalId)
}

export const inValue = (value: ValueOption, internalId: number) =>
  value === 'all' || (wantedTierOf(internalId) ?? Number.POSITIVE_INFINITY) <= valueMaxTier[value]
