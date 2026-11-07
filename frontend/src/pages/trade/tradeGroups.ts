// Personal fork: LF / FT items grouped by expansion, shared by the trade grid and the Discord export.
import { expansions } from '@/lib/CardsDB'
import type { Card, ExpansionId } from '@/types'

export type SortMode = 'list' | 'value'

export interface TradeItem {
  card: Card
  name: string
  number: number
  count?: number // FT only: spare copies
  alt?: number // personal fork: LF: the alt has it (1); FT: how many of `count` are the alt's
  key: number // value (LF) or demand (FT), higher first
  hot?: boolean // top quarter by demand: FT is easy to trade away, LF is scarce
}

export interface SetGroup {
  id: ExpansionId
  items: TradeItem[]
}

const releaseOrder = new Map(expansions.map((e, i) => [e.id, i]))

/** Flags the top quarter of `items` by demand ratio (needs a few items to mean anything). */
export function markHot(items: TradeItem[], ratio: (item: TradeItem) => number): TradeItem[] {
  const ratios = items.map(ratio).filter((r) => r > 0)
  if (ratios.length < 4) {
    return items
  }
  const threshold = ratios.toSorted((a, b) => b - a)[Math.floor(ratios.length / 4)]
  return items.map((item) => ({ ...item, hot: ratio(item) >= threshold }))
}

export const cardNumber = (cardId: string) => Number(cardId.slice(cardId.lastIndexOf('-') + 1))

// FT (has counts): most copies first. LF: descending card number.
const listOrder = (a: TradeItem, b: TradeItem) =>
  a.count === undefined || b.count === undefined ? b.number - a.number : b.count - a.count || a.number - b.number

/**
 * List: LF newest set first and cards by descending number; FT oldest set first and cards by count.
 * Value: cards by key, sets by their best card.
 */
export function groupBySet(items: TradeItem[], mode: SortMode, newestFirst: boolean): SetGroup[] {
  const bySet = [...Map.groupBy(items, (i) => i.card.expansion)].map(([id, setItems]) => ({
    id,
    items: setItems.toSorted(mode === 'value' ? (a, b) => b.key - a.key : listOrder),
    best: Math.max(...setItems.map((i) => i.key)),
  }))
  const order = (id: ExpansionId) => releaseOrder.get(id) ?? 0
  bySet.sort((a, b) => (mode === 'value' ? b.best - a.best : newestFirst ? order(b.id) - order(a.id) : order(a.id) - order(b.id)))
  return bySet.map(({ id, items }) => ({ id, items }))
}
