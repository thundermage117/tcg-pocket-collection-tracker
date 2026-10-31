// Personal fork: shared types for the packs page.
import type { BoosterValue } from '@/lib/packValue'

export type SortKey = 'meanAdj' | 'forMe' | 'pTrainerOrRainbow' | 'perPackTop50' | 'perPackNew'

export interface PackRow extends BoosterValue {
  id: string
  // expected value of a guaranteed ☆☆ to you: duplicates count as worthless
  forMe: number
}

/** Min/max across all packs, so Value bars show spread instead of all sitting near 100%. */
export interface Range {
  min: number
  max: number
}

export type Ranges = Record<'meanAdj' | 'forMe' | 'perPackTop50' | 'perPackNew', Range>

export const personalSorts: SortKey[] = ['forMe', 'perPackNew']

export const pct = (x: number) => `${Math.round(100 * x)}%`

/** Per-pack odds read better as "1 in N packs" than as fractions of a percent. */
export const oneIn = (p: number) => (p > 0 ? `1 in ${Math.round(1 / p)}` : '–')

export const fill = (x: number, { min, max }: Range) => (max > min ? 0.08 + (0.92 * (x - min)) / (max - min) : 1)
