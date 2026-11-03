// Personal fork: card leaderboards built from the bundled value snapshot (ValueDB).
// Only ☆☆ has meaningful community Elo votes; every other rarity is ranked by trade demand.

import { allCards } from '@/lib/CardsDB'
import { type CardValue, demandScore, getCardValue } from '@/lib/ValueDB'
import type { Card } from '@/types'

export interface RankedCard {
  card: Card
  value: CardValue
  score: number
  position: number // 1 = best, over the whole (unfiltered) ranking
  tier: number // index into tiers, over the whole ranking, so a card keeps its tier when the list is filtered
}

export interface Tier {
  name: string
  color: string
}

// One hue per tier, hot to cool (magenta → blue), with a neutral grey at the bottom.
export const tiers: Tier[] = [
  { name: 'SSS', color: '#f472d0' },
  { name: 'SS', color: '#ff6b6b' },
  { name: 'S', color: '#ff9f43' },
  { name: 'A', color: '#ffd93d' },
  { name: 'B', color: '#8fdc5c' },
  { name: 'C', color: '#3fd0c9' },
  { name: 'D', color: '#74a9ff' },
  { name: 'E', color: '#a3a3a3' },
]

// Most wanted: cumulative share of the ranking that ends each tier, e.g. 0.2 = top 20%.
// Thousands of cards on a smooth curve, so fixed shares split it as well as anything.
export const wantedShares = [0.01, 0.03, 0.08, 0.2, 0.45, 0.7, 0.9, 1]

const byShare = (scores: number[]) =>
  scores.map((_, i) => {
    const index = wantedShares.findIndex((share) => i + 1 <= Math.ceil(share * scores.length))
    return index === -1 ? tiers.length - 1 : index
  })

/**
 * ☆☆ Elo: Jenks natural breaks over the (descending) scores — the split into tiers.length groups with the least
 * within-tier variance — so a tier ends where the Elo jumps, and near-equal cards share a tier.
 */
function byNaturalBreaks(scores: number[]): number[] {
  const n = scores.length
  const k = tiers.length
  if (n <= k) {
    return scores.map((_, i) => i)
  }
  const sum = [0]
  const sumSq = [0]
  for (const x of scores) {
    sum.push(sum[sum.length - 1] + x)
    sumSq.push(sumSq[sumSq.length - 1] + x * x)
  }
  // squared deviation of scores[i..j) from their mean
  const cost = (i: number, j: number) => sumSq[j] - sumSq[i] - (sum[j] - sum[i]) ** 2 / (j - i)

  // best[g][j]: least cost of splitting the first j scores into g tiers; start[g][j]: where the last one begins
  const best = Array.from({ length: k + 1 }, () => new Array<number>(n + 1).fill(Number.POSITIVE_INFINITY))
  const start = Array.from({ length: k + 1 }, () => new Array<number>(n + 1).fill(0))
  best[0][0] = 0
  for (let g = 1; g <= k; g++) {
    for (let j = g; j <= n; j++) {
      for (let i = g - 1; i < j; i++) {
        const c = best[g - 1][i] + cost(i, j)
        if (c < best[g][j]) {
          best[g][j] = c
          start[g][j] = i
        }
      }
    }
  }
  const tierOf = new Array<number>(n)
  for (let g = k, j = n; g > 0; j = start[g][j], g--) {
    tierOf.fill(g - 1, start[g][j], j)
  }
  return tierOf
}

function rank(entries: Omit<RankedCard, 'position' | 'tier'>[], assignTiers: (scores: number[]) => number[]): RankedCard[] {
  const sorted = entries.toSorted((a, b) => b.score - a.score)
  const tierOf = assignTiers(sorted.map((e) => e.score))
  return sorted.map((e, i) => ({ ...e, position: i + 1, tier: tierOf[i] }))
}

/** All ☆☆ cards by vote-adjusted Elo, deluxe packs included. */
export function getTwoStarRanking(): RankedCard[] {
  const entries: Omit<RankedCard, 'position' | 'tier'>[] = []
  for (const card of allCards) {
    const value = getCardValue(card.card_id)
    if (card.rarity === '☆☆' && value?.adj !== undefined) {
      entries.push({ card, value, score: value.adj })
    }
  }
  return rank(entries, byNaturalBreaks)
}

/**
 * Every card anyone trades, by wishlists per offer shrunk for small samples (see demandScore).
 * Reprints share their original's numbers, so only the original is ranked.
 * Deluxe-pack foils are scarce enough to fill the top tiers on their own, so they are a separate ranking, not a filter.
 */
export function getMostWanted(includeFoils = false): RankedCard[] {
  const entries: Omit<RankedCard, 'position' | 'tier'>[] = []
  for (const card of allCards) {
    const value = getCardValue(card.card_id)
    const score = demandScore(value)
    if (value && !value.same_as && score > 0 && (includeFoils || !card.foil)) {
      entries.push({ card, value, score })
    }
  }
  return rank(entries, byShare)
}

export interface DemandPoint {
  card: Card
  value: CardValue
  wish: number
  offers: number
  score: number // demandScore
}

/**
 * Every card with eleet wishlist and trade-list counts, for the demand map: unwanted cards included, unlike Most wanted,
 * but not cards nobody lists at all (0 / 0, mostly unreleased or untradable ones), which would only stack on the origin. Reprints plot once, as their original; foils only with `includeFoils`, like getMostWanted.
 */
export function getDemandMap(includeFoils = false): DemandPoint[] {
  const points: DemandPoint[] = []
  for (const card of allCards) {
    const value = getCardValue(card.card_id)
    if (value?.wish !== undefined && value.offers !== undefined && value.wish + value.offers > 0 && !value.same_as && (includeFoils || !card.foil)) {
      points.push({ card, value, wish: value.wish, offers: value.offers, score: demandScore(value) })
    }
  }
  return points
}

let twoStarPositions: Map<string, number> | undefined

/** Position in the ☆☆ Elo ranking (1 = best). Ordered by adj, unlike the source's raw `rank`, so every page agrees. */
export function twoStarPosition(cardId: string): number | undefined {
  twoStarPositions ??= new Map(getTwoStarRanking().map((e) => [e.card.card_id, e.position]))
  return twoStarPositions.get(cardId)
}

let tierLookup: { elo: Map<string, Tier>; wanted: Map<string, Tier>; wantedWithFoils: Map<string, Tier> } | undefined

const tiersOf = (ranking: RankedCard[]) => new Map(ranking.map((e) => [e.card.card_id, tiers[e.tier]]))

/**
 * The card's tier on each Rankings tab, exactly as the Rankings page shows it. Foils only rank with the foils switch on
 * (`foil`); a reprint is ranked as its original (`wantedAs`).
 */
export function cardTiers(cardId: string): { elo?: Tier; wanted?: Tier; foil: boolean; wantedAs: string } {
  tierLookup ??= { elo: tiersOf(getTwoStarRanking()), wanted: tiersOf(getMostWanted()), wantedWithFoils: tiersOf(getMostWanted(true)) }
  const wantedAs = getCardValue(cardId)?.same_as ?? cardId
  const plain = tierLookup.wanted.get(wantedAs)
  return {
    elo: tierLookup.elo.get(cardId),
    wanted: plain ?? tierLookup.wantedWithFoils.get(wantedAs),
    foil: !plain && tierLookup.wantedWithFoils.has(wantedAs),
    wantedAs,
  }
}
