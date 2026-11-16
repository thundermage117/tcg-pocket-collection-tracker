// Personal fork: the maths behind the luck report (lib/luck.ts binds it to the card data; this file imports nothing,
// so scripts/luck/check-luck.ts can run it in Node).
//
// The app never knows how many packs were opened: only which cards are owned. But the commons give it away. After n
// packs of a booster, a card with per-pack chance p is owned with probability 1 − (1 − p)^n, so the pattern of owned
// and missing ◊–◊◊◊◊ has a most likely n per booster. With that n, the same formula says how many ☆-and-rarer cards a
// typical player would own by now, which is what the owned ones are compared against.
//
// What it can't see: cards that arrived by trade, gift, Wonder Pick or pack points count as pulled.

export interface ModelCard {
  owned: boolean
  rare: boolean // ☆ and rarer: what luck is measured on. The rest (◊–◊◊◊◊) estimate the packs opened.
  rates: number[] // per booster: −ln(1 − chance of this card in one pack), 0 where the booster doesn't hold it
}

export interface LuckEstimate {
  packs: number // packs opened, most likely
  perBooster: number[]
  low: number // likely range of `packs` (two standard errors either way)
  high: number // Infinity when atLeast
  atLeast: boolean // a booster's ◊–◊◊◊◊ are all owned, so its packs are a floor, not an estimate
  rares: number // ☆-and-rarer cards owned
  rareTotal: number
  expected: number // how many of them a typical player owns after `packs`
  variance: number // of that count: the cards' own chance, plus not knowing `packs` exactly
  percentile: number // share of players with as many packs who'd own fewer rares (ties split), 0–1
  worth: number // packs a typical player needs to own `rares` of them
}

const MAX_PACKS = 1e6

const exposure = (card: ModelCard, packs: number[]) => card.rates.reduce((sum, rate, b) => sum + rate * packs[b], 0)

/** Root of a decreasing function on [0, MAX_PACKS], 0 when it's already negative at 0. */
function solveDecreasing(f: (x: number) => number) {
  if (f(0) <= 0) {
    return 0
  }
  let lo = 0
  let hi = 1
  while (f(hi) > 0 && hi < MAX_PACKS) {
    lo = hi
    hi *= 2
  }
  for (let i = 0; i < 60 && hi - lo > 1e-3; i++) {
    const mid = (lo + hi) / 2
    if (f(mid) > 0) {
      lo = mid
    } else {
      hi = mid
    }
  }
  return (lo + hi) / 2
}

/**
 * Most likely packs per booster given which commons are owned. The log-likelihood is concave, so climbing one booster
 * at a time converges. A booster with every common owned has no upper limit: it gets the packs at which half a card
 * would still be expected missing, and is reported as a floor.
 */
function estimatePacks(commons: ModelCard[], boosters: number) {
  const packs: number[] = Array(boosters).fill(0)
  const saturated: boolean[] = Array(boosters).fill(false)
  for (let b = 0; b < boosters; b++) {
    const inBooster = commons.filter((c) => c.rates[b] > 0)
    saturated[b] = inBooster.length > 0 && inBooster.every((c) => c.owned)
  }
  for (let sweep = 0; sweep < 60; sweep++) {
    let moved = 0
    for (let b = 0; b < boosters; b++) {
      const inBooster = commons.filter((c) => c.rates[b] > 0)
      if (!inBooster.some((c) => c.owned)) {
        packs[b] = 0
        continue
      }
      const at = (n: number) => {
        const trial = packs.with(b, n)
        return inBooster.map((c) => ({ c, x: exposure(c, trial) }))
      }
      const next = saturated[b]
        ? solveDecreasing((n) => at(n).reduce((missing, { x }) => missing + Math.exp(-x), 0) - 0.5)
        : // the log-likelihood's slope in this booster's packs
          solveDecreasing((n) => at(n).reduce((slope, { c, x }) => slope + (c.owned ? c.rates[b] / Math.expm1(Math.max(x, 1e-12)) : -c.rates[b]), 0))
      moved = Math.max(moved, Math.abs(next - packs[b]))
      packs[b] = next
    }
    if (moved < 0.01) {
      break
    }
  }
  return { packs, atLeast: saturated.some((s, b) => s && packs[b] > 0) }
}

/** Relative standard error of the pack estimate, from the likelihood's curvature along "more or fewer packs of the same mix". */
function relativeError(commons: ModelCard[], packs: number[]) {
  let info = 0
  for (const c of commons) {
    const x = exposure(c, packs)
    if (c.owned && x > 0) {
      const e = Math.expm1(x)
      info += (x * x * (e + 1)) / (e * e)
    }
  }
  return info > 0 ? 1 / Math.sqrt(info) : Number.POSITIVE_INFINITY
}

/** Chance of owning exactly k of independent cards with these chances (Poisson binomial), for every k. */
function countDistribution(chances: number[]) {
  let dist = [1]
  for (const p of chances) {
    const next: number[] = Array(dist.length + 1).fill(0)
    for (let k = 0; k < dist.length; k++) {
      next[k] += dist[k] * (1 - p)
      next[k + 1] += dist[k] * p
    }
    dist = next
  }
  return dist
}

/** Share of players who'd own fewer than `owned` of the cards, counting half of those who'd own exactly as many. */
function percentileOf(owned: number, chances: number[]) {
  const dist = countDistribution(chances)
  let below = 0
  for (let k = 0; k < owned && k < dist.length; k++) {
    below += dist[k]
  }
  return below + (dist[owned] ?? 0) / 2
}

// Standard normal points and weights, for averaging over the packs estimate's error
const errorPoints = [-2.5, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5].map((z) => ({ z, weight: Math.exp((-z * z) / 2) }))
const errorWeight = errorPoints.reduce((sum, p) => sum + p.weight, 0)

/** Standard normal CDF (Abramowitz–Stegun 26.2.17, good to 7 decimals). */
export function normalCdf(z: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const tail = Math.exp((-z * z) / 2) * 0.3989422804 * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  return z >= 0 ? 1 - tail : tail
}

export function estimateLuck(cards: ModelCard[], boosters: number): LuckEstimate {
  const commons = cards.filter((c) => !c.rare)
  const rareCards = cards.filter((c) => c.rare)
  const { packs: perBooster, atLeast } = estimatePacks(commons, boosters)
  const packs = perBooster.reduce((a, b) => a + b, 0)
  const error = relativeError(commons, perBooster)

  const chancesAt = (mix: number[]) => rareCards.map((c) => -Math.expm1(-exposure(c, mix)))
  const chances = chancesAt(perBooster)
  const rares = rareCards.filter((c) => c.owned).length

  // The packs are an estimate, and 20% more packs means noticeably more rares expected. Judging luck at the single
  // most likely number would call ordinary estimation error "lucky" or "unlucky", so the percentile is averaged over
  // the packs it could have been, and the variance carries the same doubt.
  const spread = Number.isFinite(error) ? error : 0
  const percentile =
    errorPoints.reduce((sum, { z, weight }) => {
      const scale = Math.max(0.05, 1 + z * spread)
      return sum + weight * percentileOf(rares, chancesAt(perBooster.map((n) => n * scale)))
    }, 0) / errorWeight
  const perScale = rareCards.reduce((sum, c) => {
    const x = exposure(c, perBooster)
    return sum + x * Math.exp(-x)
  }, 0) // how fast the expected count grows with the packs

  // Packs' worth: scale the same booster mix until the expected rares match the owned ones. With no packs estimated
  // (rares but no commons, e.g. traded for), an even mix. Owning every rare has no finite answer, so aim half a card short.
  const mix = packs > 0 ? perBooster.map((n) => n / packs) : perBooster.map(() => 1 / boosters)
  const target = Math.min(rares, rareCards.length - 0.5)
  const worth = rares === 0 ? 0 : solveDecreasing((n) => target - chancesAt(mix.map((share) => share * n)).reduce((a, b) => a + b, 0))

  return {
    packs,
    perBooster,
    low: packs * Math.max(0, 1 - 2 * error),
    high: atLeast ? Number.POSITIVE_INFINITY : packs * (1 + 2 * error),
    atLeast,
    rares,
    rareTotal: rareCards.length,
    expected: chances.reduce((a, b) => a + b, 0),
    variance: chances.reduce((sum, p) => sum + p * (1 - p), 0) + (perScale * spread) ** 2,
    percentile,
    worth,
  }
}
