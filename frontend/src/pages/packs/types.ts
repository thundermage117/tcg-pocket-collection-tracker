// Personal fork: shared types for the packs page.
import type { BoosterValue } from '@/lib/packValue'

export type SortKey = 'meanAdj' | 'forMe' | 'pTrainerOrRainbow' | 'pNew'

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

export const personalSorts: SortKey[] = ['forMe', 'pNew']

export const pct = (x: number) => `${Math.round(100 * x)}%`

export const fill = (x: number, { min, max }: Range) => (max > min ? 0.08 + (0.92 * (x - min)) / (max - min) : 1)
