// Personal fork: the completion heatmap's cell model: counts and missing cards per expansion × rarity cell, colour bands,
// the legend and label formatting.

import { completionPct } from '@/pages/overview/completionPct'
import { previewCount } from '@/pages/overview/components/MissingThumbs'
import { type Card, type ExpansionId, type Rarity, tradableRarities } from '@/types'

// What a cell shows: completion %, or how many cards are still missing
export type CellMode = 'pct' | 'left'

// What sizes a pack on the map: cards missing from it, or how many of them one pack gives on average
export type MapSize = 'missing' | 'odds'

export interface Cell {
  collected: number
  available: number
}

// On mobile a tap selects a cell (or a set's pack chances) and shows it in the details bar
export type Selection = { row: string; col: Rarity | 'all' } | { row: ExpansionId; col: 'packs' }

// Expansions are grouped by series (A, B, C: the id's first letter); a series' summary row is keyed "s:<letter>"
export const seriesOf = (id: ExpansionId) => id.charAt(0)
export const seriesRow = (series: string) => `s:${series}`
export const isSeriesRow = (row: string) => row.startsWith('s:')

const rowsOf = (c: Card) => [c.expansion, seriesRow(seriesOf(c.expansion)), 'all']

// Unique cards per "<row>|<rarity>" and "<row>|all", where a row is an expansion, its series or "all"
export function countByCell(cards: Card[]) {
  const ids = new Map<string, Set<number>>()
  const add = (key: string, id: number) => {
    let set = ids.get(key)
    if (!set) {
      set = new Set()
      ids.set(key, set)
    }
    set.add(id)
  }
  for (const c of cards) {
    for (const row of rowsOf(c)) {
      add(`${row}|${c.rarity}`, c.internal_id)
      add(`${row}|all`, c.internal_id)
    }
  }
  return new Map([...ids].map(([key, set]) => [key, set.size]))
}

// The first missing cards per cell key (same keys as countByCell), in card order, for the thumbnail previews
export function missingByCell(available: Card[], collected: Card[]) {
  const owned = new Set(collected.map((c) => c.internal_id))
  const cards = new Map<string, Card[]>()
  const seen = new Set<string>()
  for (const c of available) {
    if (owned.has(c.internal_id)) {
      continue
    }
    for (const key of rowsOf(c).flatMap((row) => [`${row}|${c.rarity}`, `${row}|all`])) {
      const list = cards.get(key) ?? []
      // a card can be in several packs (or listed twice), so dedupe per cell
      if (list.length < previewCount && !seen.has(`${key}|${c.internal_id}`)) {
        seen.add(`${key}|${c.internal_id}`)
        list.push(c)
        cards.set(key, list)
      }
    }
  }
  return cards
}

// Ordinal bands, one blue brighter as a cell nears done, and the reserved "good" green (always with its 100% / ✓
// label) once it's complete. Each step clears 2:1 against the neutral-800 card and its label clears APCA Lc 60.
export const swatches = {
  none: { backgroundColor: 'rgb(64 64 64 / 0.35)', color: 'rgb(163 163 163)' },
  b1: { backgroundColor: '#1c5cab', color: '#ffffff' },
  b2: { backgroundColor: '#2a78d6', color: '#ffffff' },
  b3: { backgroundColor: '#5598e7', color: '#ffffff' },
  b4: { backgroundColor: '#9ec5f4', color: '#0b0b0b' },
  done: { backgroundColor: '#0ca30c', color: '#ffffff' },
}
type Swatch = keyof typeof swatches

// Bands follow what the cell shows: % complete (bunched where cells actually sit, 80–100), or cards left
export function cellSwatch({ collected, available }: Cell, mode: CellMode): Swatch {
  const missing = available - collected
  if (missing === 0) {
    return 'done'
  }
  if (mode === 'left') {
    return missing <= 2 ? 'b4' : missing <= 5 ? 'b3' : missing <= 15 ? 'b2' : 'b1'
  }
  const pct = (100 * collected) / available
  return collected === 0 ? 'none' : pct < 50 ? 'b1' : pct < 80 ? 'b2' : pct < 95 ? 'b3' : 'b4'
}

export const legend: Record<CellMode, [Swatch, string][]> = {
  pct: [
    ['none', '0%'],
    ['b1', '1–49%'],
    ['b2', '50–79%'],
    ['b3', '80–94%'],
    ['b4', '95–99%'],
    ['done', '100%'],
  ],
  left: [
    ['b1', '16+'],
    ['b2', '6–15'],
    ['b3', '3–5'],
    ['b4', '1–2'],
    ['done', 'complete'],
  ],
}

export function formatPct({ collected, available }: Cell) {
  return `${completionPct(collected, available)}%`
}

export function formatLeft({ collected, available }: Cell) {
  return collected === available ? '✓' : String(available - collected)
}

// 1–2 cards from done: the easiest gaps to close with a trade, so only for rarities that can be traded
export const isNearlyDone = (col: Rarity | 'all', { collected, available }: Cell) =>
  (tradableRarities as readonly string[]).includes(col) && available - collected > 0 && available - collected <= 2

// Columns of the same family (◊…◊◊◊◊, ☆…☆☆☆, ✵ ✵✵) sit together, with a gap before the next family
export const rarityFamily = (r: Rarity) => ['◊', '☆', '✵'].find((f) => r.startsWith(f)) ?? r

export const rarityLabel = (r: Rarity | 'all') => (r === 'all' ? 'all rarities' : r)

// One decimal, minus a trailing .0, so a column of 100% / 45% doesn't read as a wall of "100.0%"
export const formatChance = (pct: number) => `${pct.toFixed(1).replace(/\.0$/, '')}%`
