// Personal fork: card leaderboards built from the bundled value snapshot (ValueDB).
// Only ☆☆ has meaningful community Elo votes; every other rarity is ranked by trade demand.

import { allCards } from '@/lib/CardsDB'
import { type CardValue, demandRatio, getCardValue } from '@/lib/ValueDB'
import type { Card } from '@/types'

export interface RankedCard {
  card: Card
  value: CardValue
  score: number
  position: number // 1 = best, over the whole (unfiltered) ranking
}

function rank(entries: Omit<RankedCard, 'position'>[]): RankedCard[] {
  return entries.toSorted((a, b) => b.score - a.score).map((e, i) => ({ ...e, position: i + 1 }))
}

/** All ☆☆ cards by vote-adjusted Elo, deluxe packs included. */
export function getTwoStarRanking(): RankedCard[] {
  const entries: Omit<RankedCard, 'position'>[] = []
  for (const card of allCards) {
    const value = getCardValue(card.card_id)
    if (card.rarity === '☆☆' && value?.adj !== undefined) {
      entries.push({ card, value, score: value.adj })
    }
  }
  return rank(entries)
}

/** Every card anyone trades, by wishlists per offer (see demandRatio). */
export function getMostWanted(): RankedCard[] {
  const entries: Omit<RankedCard, 'position'>[] = []
  for (const card of allCards) {
    const value = getCardValue(card.card_id)
    const score = demandRatio(value)
    if (value && score > 0) {
      entries.push({ card, value, score })
    }
  }
  return rank(entries)
}

let twoStarPositions: Map<string, number> | undefined

/** Position in the ☆☆ Elo ranking (1 = best). Ordered by adj, unlike the source's raw `rank`, so every page agrees. */
export function twoStarPosition(cardId: string): number | undefined {
  twoStarPositions ??= new Map(getTwoStarRanking().map((e) => [e.card.card_id, e.position]))
  return twoStarPositions.get(cardId)
}

export interface Tier {
  name: string
  color: string
  upTo: number // cumulative share of the whole ranking, e.g. 0.2 = top 20%
}

// Shares are of the full ranking, so a card keeps its tier when the list is filtered.
export const tiers: Tier[] = [
  { name: 'S', color: '#f5c542', upTo: 0.05 },
  { name: 'A', color: '#f97362', upTo: 0.2 },
  { name: 'B', color: '#a78bfa', upTo: 0.45 },
  { name: 'C', color: '#60a5fa', upTo: 0.7 },
  { name: 'D', color: '#737373', upTo: 1 },
]

export function tierIndex(position: number, total: number): number {
  const index = tiers.findIndex((t) => position <= Math.ceil(t.upTo * total))
  return index === -1 ? tiers.length - 1 : index
}

let tierLookup: { elo: Map<string, Tier>; wanted: Map<string, Tier> } | undefined

const tiersOf = (ranking: RankedCard[]) => new Map(ranking.map((e) => [e.card.card_id, tiers[tierIndex(e.position, ranking.length)]]))

/** The card's tier on each Rankings tab, exactly as the Rankings page shows it. */
export function cardTiers(cardId: string): { elo?: Tier; wanted?: Tier } {
  tierLookup ??= { elo: tiersOf(getTwoStarRanking()), wanted: tiersOf(getMostWanted()) }
  return { elo: tierLookup.elo.get(cardId), wanted: tierLookup.wanted.get(cardId) }
}
