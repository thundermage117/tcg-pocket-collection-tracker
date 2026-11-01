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

/**
 * Every card anyone trades, by wishlists per offer (see demandRatio).
 * Deluxe-pack foils are scarce enough to fill the top tiers on their own, so they are a separate ranking, not a filter.
 */
export function getMostWanted(includeFoils = false): RankedCard[] {
  const entries: Omit<RankedCard, 'position'>[] = []
  for (const card of allCards) {
    const value = getCardValue(card.card_id)
    const score = demandRatio(value)
    if (value && score > 0 && (includeFoils || !card.foil)) {
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
// One hue per tier, hot to cool (magenta → blue), with a neutral grey at the bottom.
export const tiers: Tier[] = [
  { name: 'SSS', color: '#f472d0', upTo: 0.01 },
  { name: 'SS', color: '#ff6b6b', upTo: 0.03 },
  { name: 'S', color: '#ff9f43', upTo: 0.08 },
  { name: 'A', color: '#ffd93d', upTo: 0.2 },
  { name: 'B', color: '#8fdc5c', upTo: 0.45 },
  { name: 'C', color: '#3fd0c9', upTo: 0.7 },
  { name: 'D', color: '#74a9ff', upTo: 0.9 },
  { name: 'E', color: '#a3a3a3', upTo: 1 },
]

export function tierIndex(position: number, total: number): number {
  const index = tiers.findIndex((t) => position <= Math.ceil(t.upTo * total))
  return index === -1 ? tiers.length - 1 : index
}

let tierLookup: { elo: Map<string, Tier>; wanted: Map<string, Tier>; wantedWithFoils: Map<string, Tier> } | undefined

const tiersOf = (ranking: RankedCard[]) => new Map(ranking.map((e) => [e.card.card_id, tiers[tierIndex(e.position, ranking.length)]]))

/** The card's tier on each Rankings tab, exactly as the Rankings page shows it. Foils only rank with the foils switch on (`foil`). */
export function cardTiers(cardId: string): { elo?: Tier; wanted?: Tier; foil: boolean } {
  tierLookup ??= { elo: tiersOf(getTwoStarRanking()), wanted: tiersOf(getMostWanted()), wantedWithFoils: tiersOf(getMostWanted(true)) }
  const plain = tierLookup.wanted.get(cardId)
  return { elo: tierLookup.elo.get(cardId), wanted: plain ?? tierLookup.wantedWithFoils.get(cardId), foil: !plain && tierLookup.wantedWithFoils.has(cardId) }
}
