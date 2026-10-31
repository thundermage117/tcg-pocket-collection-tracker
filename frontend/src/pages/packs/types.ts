// Personal fork: shared types for the packs page.
import type { BoosterValue } from '@/lib/packValue'

export type SortKey = 'perPackNew' | 'perPackTop50' | 'meanAdj' | 'pTrainerOrRainbow'

export interface PackRow extends BoosterValue {
  id: string
  // 1-based position by average ☆☆ value among all packs, so Elo has a reference point
  valueRank: number
}

/** Min/max across all packs, so headline bars show spread instead of all sitting near 100%. */
export interface Range {
  min: number
  max: number
}

export type Ranges = Record<SortKey, Range>

export const personalSorts: SortKey[] = ['perPackNew']

/** Per-pack odds read better as "1 in N packs" than as fractions of a percent. */
export const oneIn = (p: number) => (p > 0 ? `1 in ${Math.round(1 / p)}` : '–')

export const ordinal = (n: number) => {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')
  return `${n}${suffix}`
}

export const fill = (x: number, { min, max }: Range) => (max > min ? 0.08 + (0.92 * (x - min)) / (max - min) : 1)

interface Goal {
  label: string
  /** Big number on the card, e.g. "1 in 140 packs". */
  stat: (p: PackRow, total: number) => string
  /** What the number means, read after `stat`. */
  caption: (p: PackRow, total: number) => string
}

/** One wording per goal, shared by the toggle, the pack cards and the best-pick banner. */
export const goals: Record<SortKey, Goal> = {
  perPackNew: {
    label: "Cards I'm missing",
    stat: (p) => (p.perPackNew > 0 ? `${oneIn(p.perPackNew)} packs` : 'None left'),
    caption: (p) => (p.perPackNew > 0 ? "gives a ☆☆ you're missing" : 'you own every ☆☆ here'),
  },
  perPackTop50: {
    label: 'Top-50 cards',
    stat: (p) => `${oneIn(p.perPackTop50)} packs`,
    caption: () => 'gives a top-50 ☆☆',
  },
  meanAdj: {
    label: 'Best average card',
    stat: (p) => `Elo ${Math.round(p.meanAdj)}`,
    caption: (p, total) => `average ☆☆ value · ${ordinal(p.valueRank)} of ${total} packs`,
  },
  pTrainerOrRainbow: {
    label: 'Trainers / rainbows',
    stat: (p) => `${p.trainerOrRainbowCount} of ${p.cards.length}`,
    caption: () => '☆☆ are trainers or rainbows',
  },
}

export const sortOrder: SortKey[] = ['perPackNew', 'perPackTop50', 'meanAdj', 'pTrainerOrRainbow']
