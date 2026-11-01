// Personal fork: trade fairness check. Pure scoring over the value snapshot so it can be tested without React.
// A card's score is its percentile (0–100) among all tradable cards of its rarity, so both sides of a
// same-rarity trade are comparable. ☆☆ blends vote Elo with demand; every other rarity is demand only.

import { craftingCost } from '@/lib/CardsDB'
import { type CardValue, demandScore, PROVISIONAL_VOTES } from '@/lib/ValueDB'
import type { Rarity, TradableRarity } from '@/types'

// Shinedust each side pays for the card it receives (game8 / serebii, Oct 2026). ◊ and ◊◊ are free.
export const shinedustCost: Record<TradableRarity, number> = {
  '◊': 0,
  '◊◊': 0,
  '◊◊◊': 1200,
  '◊◊◊◊': 5000,
  '☆': 4000,
  '☆☆': 25000,
  '✵': 10000,
  '✵✵': 30000,
}

// Shinedust granted for pulling a duplicate (serebii)
export const duplicateShinedust: Record<TradableRarity, number> = {
  '◊': 20,
  '◊◊': 40,
  '◊◊◊': 240,
  '◊◊◊◊': 720,
  '☆': 470,
  '☆☆': 2400,
  '✵': 1700,
  '✵✵': 3600,
}

// CardsDB has no shiny prices; these are Bulbapedia's
export const packPointCost: Partial<Record<Rarity, number>> = { ...craftingCost, '✵': 1000, '✵✵': 1350 }
export const PACK_POINTS_PER_PACK = 5

export const ELO_WEIGHT = 0.7 // ☆☆ share of the score from Elo once votes have settled
export const FAIR_BAND = 15 // score points either way that still count as fair
export const THIN_FAIR_BAND = 25 // wider band when data is thin
const BIG_GAP = 35
const THIN_LISTINGS = 300 // eleet wishlists + offers below this is too few to trust
const MORE_WANTED = 1.5 // demand ratio multiple worth calling out

export interface RarityPool {
  demand: number[] // sorted ascending, cards with listings only
  elo: number[] // sorted ascending, ☆☆ adjusted Elo
}

/** Sorted demand / Elo values for one rarity, from every tradable card of it. A reprint counts once, as its original. */
export function buildPool(values: (CardValue | undefined)[]): RarityPool {
  const demand: number[] = []
  const elo: number[] = []
  for (const value of values) {
    if (listings(value) > 0 && !value?.same_as) {
      demand.push(demandScore(value))
    }
    if (value?.adj !== undefined) {
      elo.push(value.adj)
    }
  }
  const asc = (a: number, b: number) => a - b
  return { demand: demand.sort(asc), elo: elo.sort(asc) }
}

const listings = (value: CardValue | undefined) => (value?.wish ?? 0) + (value?.offers ?? 0)

// index of the first value >= x (or > x when `strict`)
function bound(sorted: number[], x: number, strict = false) {
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid] < x || (strict && sorted[mid] === x)) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

/** Mid-rank percentile: lowest = 0, highest = 100, ties share the middle. */
export function percentile(sorted: number[], x: number): number {
  if (sorted.length < 2) {
    return 50
  }
  const below = bound(sorted, x)
  const equal = bound(sorted, x, true) - below
  return (100 * (below + Math.max(equal - 1, 0) / 2)) / (sorted.length - 1)
}

export interface CardScore {
  score?: number // 0–100, undefined without any data
  demand?: number // adjusted wishlists per offer (demandScore)
  demandPct?: number
  eloPct?: number
  eloPosition?: number // 1 = best ☆☆
  eloTotal?: number
  votes?: number
  listings: number
  provisional: boolean // ☆☆ Elo still settling
  thin: boolean // too few listings, or provisional Elo
}

export function scoreCard(value: CardValue | undefined, pool: RarityPool): CardScore {
  const count = listings(value)
  const demand = count > 0 ? demandScore(value) : undefined
  const demandPct = demand !== undefined ? percentile(pool.demand, demand) : undefined
  const provisional = value?.votes !== undefined && value.votes < PROVISIONAL_VOTES
  const base = { demand, demandPct, listings: count, provisional, thin: count < THIN_LISTINGS || provisional }

  if (value?.adj === undefined) {
    return { ...base, score: demandPct }
  }
  const eloPct = percentile(pool.elo, value.adj)
  const weight = demandPct === undefined ? 1 : ELO_WEIGHT * Math.min(1, (value.votes ?? 0) / PROVISIONAL_VOTES)
  return {
    ...base,
    score: weight * eloPct + (1 - weight) * (demandPct ?? 0),
    eloPct,
    eloPosition: pool.elo.length - bound(pool.elo, value.adj, true) + 1,
    eloTotal: pool.elo.length,
    votes: value.votes,
  }
}

export type VerdictKind = 'fair' | 'steal' | 'overpay' | 'unknown'

export interface Verdict {
  kind: VerdictKind
  big: boolean // gap beyond BIG_GAP
  lean: boolean // thin data: say "leaning", not a confident call
  gap?: number // get − give, in score points
  headline: string
  reasons: string[]
}

/** "top 5%" / "bottom 20%" for a percentile; "mid-range" in between, where a share reads oddly ("top 44%"). */
export function shareLabel(pct: number) {
  if (pct >= 65) {
    return `top ${Math.max(1, Math.round(100 - pct))}%`
  }
  return pct <= 35 ? `bottom ${Math.max(1, Math.round(pct))}%` : 'mid-range'
}

const fmtRatio = (x: number) => (x >= 10 ? x.toFixed(0) : x.toFixed(1))

export function judgeTrade(give: CardScore, get: CardScore, rarity: Rarity): Verdict {
  if (give.score === undefined || get.score === undefined) {
    const side = give.score === undefined && get.score === undefined ? 'either card' : give.score === undefined ? 'your card' : 'their card'
    return { kind: 'unknown', big: false, lean: true, headline: 'Not enough data', reasons: [`No value data for ${side} yet, so there's nothing to compare.`] }
  }

  const lean = give.thin || get.thin
  const band = lean ? THIN_FAIR_BAND : FAIR_BAND
  const gap = get.score - give.score
  const kind: VerdictKind = gap > band ? 'steal' : gap < -band ? 'overpay' : 'fair'
  const big = Math.abs(gap) > BIG_GAP
  const word = { fair: 'fair', steal: big ? 'big steal' : 'steal', overpay: big ? 'big overpay' : 'overpay' }[kind]
  const headline = lean ? (kind === 'fair' ? 'Probably fair' : `Leaning ${word}`) : word[0].toUpperCase() + word.slice(1)

  const reasons: string[] = []
  if (give.eloPosition !== undefined && get.eloPosition !== undefined && give.eloPct !== undefined && get.eloPct !== undefined) {
    reasons.push(
      `You give Elo #${give.eloPosition} of ${give.eloTotal} ${rarity} (${shareLabel(give.eloPct)}) and get Elo #${get.eloPosition} (${shareLabel(get.eloPct)}).`,
    )
  } else if (give.demandPct !== undefined && get.demandPct !== undefined) {
    reasons.push(`Among ${rarity} by demand, yours is ${shareLabel(give.demandPct)} and theirs is ${shareLabel(get.demandPct)}.`)
  }

  if (give.demand !== undefined && get.demand !== undefined) {
    const multiple = get.demand / Math.max(give.demand, 0.01)
    const counts = `yours ${fmtRatio(give.demand)}, theirs ${fmtRatio(get.demand)} adjusted wishlists per offer`
    if (multiple >= MORE_WANTED) {
      reasons.push(`Their card is ${fmtRatio(multiple)}× more wanted (${counts}).`)
    } else if (multiple <= 1 / MORE_WANTED) {
      reasons.push(`Your card is ${fmtRatio(1 / multiple)}× more wanted (${counts}).`)
    } else {
      reasons.push(`Both are about equally wanted (${counts}).`)
    }
  }

  // ☆☆ only: votes and the trade lists can point opposite ways
  if (give.eloPct !== undefined && get.eloPct !== undefined && give.demandPct !== undefined && get.demandPct !== undefined) {
    const eloGap = get.eloPct - give.eloPct
    const demandGap = get.demandPct - give.demandPct
    if (Math.abs(eloGap) > FAIR_BAND && Math.abs(demandGap) > FAIR_BAND && Math.sign(eloGap) !== Math.sign(demandGap)) {
      reasons.push(`Elo and demand disagree: votes favour ${eloGap > 0 ? 'their' : 'your'} card, trade lists favour ${demandGap > 0 ? 'theirs' : 'yours'}.`)
    }
  }

  for (const [who, s] of [
    ['your card', give],
    ['their card', get],
  ] as const) {
    if (s.provisional) {
      reasons.push(`Elo for ${who} is still settling (${s.votes} votes), so it counts for less.`)
    }
    if (s.listings < THIN_LISTINGS) {
      reasons.push(`Few people list ${who} yet (${s.listings} wishlists + offers), so its demand is rough.`)
    }
  }

  return { kind, big, lean, gap, headline, reasons }
}

export interface Ask<T> {
  item: T
  score: number
  realistic: boolean // within the fair band of what you give; above it they may decline
}

/** Cards worth asking for in return: at least fair for you. Fair ones best first, then reaches smallest stretch first. */
export function bestAsks<T>(give: CardScore, candidates: { item: T; score: CardScore }[]): Ask<T>[] {
  if (give.score === undefined) {
    return []
  }
  const floor = give.score - FAIR_BAND
  const ceiling = give.score + (give.thin ? THIN_FAIR_BAND : FAIR_BAND)
  return candidates
    .flatMap(({ item, score }) => (score.score !== undefined && score.score >= floor ? [{ item, score: score.score, realistic: score.score <= ceiling }] : []))
    .sort((a, b) => Number(b.realistic) - Number(a.realistic) || (a.realistic ? b.score - a.score : a.score - b.score))
}
