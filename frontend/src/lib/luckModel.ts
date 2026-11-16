// Personal fork: the maths behind the luck report (lib/luck.ts binds it to the card data; this file imports nothing,
// so scripts/luck/check-luck.ts can run it in Node).
//
// The app never knows how many packs were opened: only which cards are owned. But the commons give it away. After n
// packs of a booster, a card with per-pack chance p is owned with probability 1 − (1 − p)^n, so the pattern of owned
// and missing ◊–◊◊◊◊ has a most likely n per booster. With that n, the same formula says how many ☆-and-rarer cards a
// typical player would own by now, which is what the owned ones are compared against.
//
// When every common is owned the count has no upper limit, so the next rarities up join the evidence (☆, then ☆☆ and
// ✵, whose cards take hundreds of packs to run out), and luck is judged only on the rarities above them.
//
// What it can't see: cards that arrived by trade, gift, Wonder Pick or pack points count as pulled.

export interface ModelCard {
  owned: boolean
  rarity: string
  level: number // 0 for ◊–◊◊◊◊, then rising with rarity: which step of the evidence ladder the card joins at
  rates: number[] // per booster: −ln(1 − chance of this card in one pack), 0 where the booster doesn't hold it
}

/** How a group of cards did against what a typical player owns of them after the estimated packs. */
export interface Judgement {
  owned: number
  total: number
  expected: number
  variance: number // of the typical count: the cards' own chance, plus not knowing the packs exactly
  percentile: number // share of players with as many packs who'd own fewer (ties split), 0–1
}

export interface RarityLuck extends Judgement {
  rarity: string
  judged: boolean // false when the rarity was used to count the packs, so its luck can't be read
}

export interface LuckEstimate {
  packs: number // packs opened, most likely
  perBooster: number[]
  low: number // likely range of `packs` (two standard errors either way)
  high: number // Infinity when atLeast
  evidenceLevel: number // the highest card level the packs were counted from (0: ◊–◊◊◊◊ alone)
  atLeast: boolean // even the last step of the ladder is all owned in some booster, so the packs are a floor
  rares: number // cards above ◊–◊◊◊◊ owned
  judged: Judgement // over the cards above the evidence
  byRarity: RarityLuck[] // every rarity above ◊–◊◊◊◊, in the order first seen
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
 * Most likely packs per booster given which of the evidence cards (`commons`, at first) are owned. The log-likelihood is concave, so climbing one booster
 * at a time converges. A booster with all its evidence owned has no upper limit: it gets the packs at which half a card
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

/**
 * Relative standard error of the total, from the likelihood's curvature in each booster's own packs. Per booster and
 * not along "more or fewer packs of the same mix": a lightly opened booster's packs are known closely, and that must
 * not vouch for a heavily opened one whose evidence has nearly run out.
 */
function relativeError(evidence: ModelCard[], packs: number[]) {
  let variance = 0
  for (let b = 0; b < packs.length; b++) {
    if (packs[b] <= 0) {
      continue
    }
    let info = 0
    for (const c of evidence) {
      const x = exposure(c, packs)
      if (c.owned && c.rates[b] > 0 && x > 0) {
        const e = Math.expm1(x)
        info += (c.rates[b] ** 2 * (e + 1)) / (e * e)
      }
    }
    if (info <= 0) {
      return Number.POSITIVE_INFINITY
    }
    variance += 1 / info
  }
  const total = packs.reduce((a, b) => a + b, 0)
  return total > 0 ? Math.sqrt(variance) / total : Number.POSITIVE_INFINITY
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
function normalCdf(z: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const tail = Math.exp((-z * z) / 2) * 0.3989422804 * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  return z >= 0 ? 1 - tail : tail
}

/**
 * The percentile of a count added up over several expansions, from its typical value and variance alone: Poisson
 * while the typical count is small (a Crown or two), where a bell curve would call owning none unlucky; normal above.
 */
export function countPercentile(owned: number, expected: number, variance: number) {
  if (expected <= 0) {
    return owned > 0 ? 1 : 0.5
  }
  if (expected < 10) {
    let term = Math.exp(-expected)
    let below = 0
    for (let k = 0; k < owned; k++) {
      below += term
      term *= expected / (k + 1)
    }
    return Math.min(1, below + term / 2)
  }
  return variance > 0 ? normalCdf((owned - expected) / Math.sqrt(variance)) : 0.5
}

const LAST_EVIDENCE_LEVEL = 2 // ☆☆ and ✵: the rarest cards allowed to count packs, leaving the top rarities to judge

export function estimateLuck(cards: ModelCard[], boosters: number): LuckEstimate {
  // Climb the ladder until the evidence has a card missing in every booster that was opened
  let evidenceLevel = 0
  let evidence = cards.filter((c) => c.level === 0)
  let estimate = estimatePacks(evidence, boosters)
  while (estimate.atLeast && evidenceLevel < LAST_EVIDENCE_LEVEL) {
    evidenceLevel++
    evidence = cards.filter((c) => c.level <= evidenceLevel)
    estimate = estimatePacks(evidence, boosters)
  }
  const { packs: perBooster, atLeast } = estimate
  const packs = perBooster.reduce((a, b) => a + b, 0)
  const error = relativeError(evidence, perBooster)
  const spread = Number.isFinite(error) ? error : 0

  const chancesAt = (of: ModelCard[], mix: number[]) => of.map((c) => -Math.expm1(-exposure(c, mix)))

  // The packs are an estimate, and 20% more packs means noticeably more rares expected. Judging luck at the single
  // most likely number would call ordinary estimation error "lucky" or "unlucky", so the percentile is averaged over
  // the packs it could have been, and the variance carries the same doubt.
  const judge = (of: ModelCard[]): Judgement => {
    const owned = of.filter((c) => c.owned).length
    const chances = chancesAt(of, perBooster)
    const perScale = of.reduce((sum, c) => {
      const x = exposure(c, perBooster)
      return sum + x * Math.exp(-x)
    }, 0) // how fast the expected count grows with the packs
    return {
      owned,
      total: of.length,
      expected: chances.reduce((a, b) => a + b, 0),
      variance: chances.reduce((sum, p) => sum + p * (1 - p), 0) + (perScale * spread) ** 2,
      percentile:
        errorPoints.reduce((sum, { z, weight }) => {
          const scale = Math.max(0.05, 1 + z * spread)
          return (
            sum +
            weight *
              percentileOf(
                owned,
                chancesAt(
                  of,
                  perBooster.map((n) => n * scale),
                ),
              )
          )
        }, 0) / errorWeight,
    }
  }

  const rareCards = cards.filter((c) => c.level > 0)
  const rares = rareCards.filter((c) => c.owned).length
  const byRarity = [...Map.groupBy(rareCards, (c) => c.rarity)].map(([rarity, of]) => ({ rarity, judged: of[0].level > evidenceLevel, ...judge(of) }))

  // Packs' worth: scale the same booster mix until the expected rares match the owned ones. With no packs estimated
  // (rares but no commons, e.g. traded for), an even mix. Owning every rare has no finite answer, so aim half a card short.
  const mix = packs > 0 ? perBooster.map((n) => n / packs) : perBooster.map(() => 1 / boosters)
  const target = Math.min(rares, rareCards.length - 0.5)
  const worth =
    rares === 0
      ? 0
      : solveDecreasing(
          (n) =>
            target -
            chancesAt(
              rareCards,
              mix.map((share) => share * n),
            ).reduce((a, b) => a + b, 0),
        )

  return {
    packs,
    perBooster,
    low: packs * Math.max(0, 1 - 2 * error),
    high: atLeast ? Number.POSITIVE_INFINITY : packs * (1 + 2 * error),
    evidenceLevel,
    atLeast,
    rares,
    judged: judge(cards.filter((c) => c.level > evidenceLevel)),
    byRarity,
    worth,
  }
}
