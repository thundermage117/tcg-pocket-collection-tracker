// Sanity check for frontend/src/lib/luckModel.ts:  pnpm tsx scripts/luck/check-luck.ts
// Deals simulated collections from known pack counts and checks the model finds them again. Cards are dealt
// independently (each owned with 1 − (1 − p)^n), which is the model's own assumption, so this tests the solver.
import assert from 'node:assert/strict'
import { countPercentile, estimateLuck, type ModelCard } from '../../frontend/src/lib/luckModel.ts'

// deterministic random numbers (mulberry32)
function rng(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rate = (p: number) => -Math.log(1 - p)

// A set shaped like a three-booster expansion: per booster 50 ◊, 25 ◊◊, 8 ◊◊◊, 5 ◊◊◊◊, 8 ☆, 10 ☆☆, 2 ☆☆☆, 1 Crown,
// at roughly the game's per-card odds, plus 10 ◊ every booster holds.
function makeSet(boosters: number) {
  const cards: Omit<ModelCard, 'owned'>[] = []
  const add = (count: number, chance: number, rarity: string, level: number, booster?: number) => {
    for (let i = 0; i < count; i++) {
      cards.push({ rarity, level, rates: Array.from({ length: boosters }, (_, b) => (booster === undefined || booster === b ? rate(chance) : 0)) })
    }
  }
  for (let b = 0; b < boosters; b++) {
    add(50, 0.05, '◊', 0, b)
    add(25, 0.058, '◊◊', 0, b)
    add(8, 0.031, '◊◊◊', 0, b)
    add(5, 0.0166, '◊◊◊◊', 0, b)
    add(8, 0.016, '☆', 1, b)
    add(10, 0.0025, '☆☆', 2, b)
    add(2, 0.005, '☆☆☆', 3, b)
    add(1, 0.0004, 'Crown', 3, b)
  }
  add(10, 0.05, '◊', 0)
  return cards
}

function deal(set: Omit<ModelCard, 'owned'>[], packs: number[], random: () => number): ModelCard[] {
  return set.map((c) => ({ ...c, owned: random() < 1 - Math.exp(-c.rates.reduce((sum, r, b) => sum + r * packs[b], 0)) }))
}

const set = makeSet(3)

// 1. Finds the packs again, per booster, across uneven mixes; the likely range holds the truth at least 8 times in 10
for (const truth of [
  [40, 40, 40],
  [120, 10, 0],
  [15, 60, 110],
]) {
  const random = rng(truth[0] * 7 + truth[2])
  const total = truth.reduce((a, b) => a + b, 0)
  let sum = 0
  let covered = 0
  const perBooster = [0, 0, 0]
  const runs = 300
  for (let i = 0; i < runs; i++) {
    const est = estimateLuck(deal(set, truth, random), 3)
    sum += est.packs
    est.perBooster.forEach((n, b) => {
      perBooster[b] += n
    })
    covered += Number(est.atLeast || (est.low <= total && total <= est.high))
  }
  const mean = sum / runs
  console.log(
    `truth ${truth.join('/')} → mean ${perBooster.map((n) => (n / runs).toFixed(0)).join('/')} (total ${mean.toFixed(0)}), range holds truth ${Math.round((100 * covered) / runs)}%`,
  )
  assert.ok(Math.abs(mean - total) / total < 0.1, `mean estimate ${mean} is within 10% of ${total}`)
  truth.forEach((n, b) => {
    assert.ok(Math.abs(perBooster[b] / runs - n) < Math.max(5, 0.15 * n), `booster ${b}: ${perBooster[b] / runs} near ${n}`)
  })
  assert.ok(covered / runs > 0.8, 'the likely range holds the truth in at least 80% of runs')
}

// 2. Luck is fair on average: over many typical players the percentile averages one half, and worth averages near the packs
{
  const random = rng(99)
  const truth = [80, 50, 20]
  let percentile = 0
  let worth = 0
  let extreme = 0
  const runs = 400
  for (let i = 0; i < runs; i++) {
    const est = estimateLuck(deal(set, truth, random), 3)
    percentile += est.judged.percentile
    worth += est.worth
    extreme += Number(est.judged.percentile < 0.05 || est.judged.percentile > 0.95)
  }
  console.log(
    `typical players: mean percentile ${(percentile / runs).toFixed(2)}, ${Math.round((100 * extreme) / runs)}% read as top or bottom 5%, mean worth ${(worth / runs).toFixed(0)} for 150 packs`,
  )
  assert.ok(Math.abs(percentile / runs - 0.5) < 0.05)
  // calibrated: about 1 typical player in 10 lands in the outer 5%s, not many more (the packs estimate's error is priced in)
  assert.ok(extreme / runs < 0.15, `${extreme} of ${runs} runs in the outer 5%s`)
  assert.ok(Math.abs(worth / runs - 150) / 150 < 0.2)
}

// 2b. Once a booster's commons run out, ☆ and then ☆☆ count the packs instead, and only what's above them is judged
{
  const random = rng(3)
  const truth = [15, 60, 400]
  const ladder: Record<string, number> = { '☆': 1, '☆☆': 2, '☆☆☆': 3, Crown: 3 }
  let sum = 0
  let percentile = 0
  let extreme = 0
  const levels = [0, 0, 0]
  let floors = 0
  const runs = 300
  for (let i = 0; i < runs; i++) {
    const est = estimateLuck(deal(set, truth, random), 3)
    // now and then even the booster's ☆☆ are all owned: still a floor, and left out of the averages
    if (est.atLeast) {
      floors++
      continue
    }
    levels[est.evidenceLevel]++
    sum += est.packs
    percentile += est.judged.percentile
    extreme += Number(est.judged.percentile < 0.05 || est.judged.percentile > 0.95)
    assert.equal(
      est.judged.total,
      est.byRarity.filter((r) => r.judged).reduce((n, r) => n + r.total, 0),
    )
    for (const r of est.byRarity) {
      assert.equal(r.judged, ladder[r.rarity] > est.evidenceLevel)
    }
  }
  console.log(
    `475 packs, one booster's commons exhausted: counted from level ${levels.map((n, l) => `${l}: ${n}`).join(', ')}; mean ${(sum / (runs - floors)).toFixed(0)} packs, mean percentile ${(percentile / (runs - floors)).toFixed(2)}, ${Math.round((100 * extreme) / (runs - floors))}% in the outer 5%s, ${floors} floors`,
  )
  const judged = runs - floors
  assert.ok(floors / runs < 0.05, `${floors} floors`)
  assert.ok(levels[2] / judged > 0.8, 'mostly counted from ☆☆')
  // few ☆☆ per booster, so the estimate leans high: within 20%
  assert.ok(Math.abs(sum / judged - 475) / 475 < 0.2)
  assert.ok(Math.abs(percentile / judged - 0.5) < 0.07)
  assert.ok(extreme / judged < 0.17)
}

// 2c. Each rarity is judged fairly on its own
{
  const random = rng(42)
  const byRarity = new Map<string, number>()
  const runs = 300
  for (let i = 0; i < runs; i++) {
    for (const r of estimateLuck(deal(set, [80, 50, 20], random), 3).byRarity) {
      byRarity.set(r.rarity, (byRarity.get(r.rarity) ?? 0) + r.percentile / runs)
    }
  }
  console.log(`mean percentile by rarity: ${[...byRarity].map(([r, p]) => `${r} ${p.toFixed(2)}`).join(', ')}`)
  for (const [rarity, mean] of byRarity) {
    assert.ok(Math.abs(mean - 0.5) < 0.07, `${rarity}: ${mean}`)
  }
}

// 3. A lucky player reads lucky: same commons, every rare owned
{
  const cards = deal(set, [60, 60, 60], rng(5))
  const plain = estimateLuck(cards, 3)
  const lucky = estimateLuck(
    cards.map((c) => (c.level > 0 ? { ...c, owned: true } : c)),
    3,
  )
  assert.equal(lucky.packs, plain.packs)
  assert.ok(lucky.judged.percentile > 0.999)
  assert.ok(lucky.worth > 5 * plain.packs, `worth ${lucky.worth} far above ${plain.packs} packs`)
  assert.ok(Number.isFinite(lucky.worth))
}

// 4. Edge cases: nothing owned; every common owned is a floor; rares without commons still get a worth
{
  const none = estimateLuck(
    set.map((c) => ({ ...c, owned: false })),
    3,
  )
  assert.equal(none.packs, 0)
  assert.equal(none.worth, 0)
  assert.equal(none.judged.percentile, 0.5)

  const full = estimateLuck(
    set.map((c) => ({ ...c, owned: c.level < 3 })),
    3,
  )
  assert.ok(full.atLeast)
  assert.equal(full.high, Number.POSITIVE_INFINITY)
  assert.ok(full.packs > 300 && full.packs < 5000, `a floor of ${full.packs} packs`)

  const tradedFor = estimateLuck(
    set.map((c, i) => ({ ...c, owned: c.level > 0 && i % 7 === 0 })),
    3,
  )
  assert.equal(tradedFor.packs, 0)
  assert.ok(tradedFor.worth > 0)
}

// combined counts: Poisson while small (owning no Crown when 0.3 are typical is ordinary), normal when large
assert.ok(Math.abs(countPercentile(0, 0.3, 0.3) - Math.exp(-0.3) / 2) < 1e-9)
assert.ok(countPercentile(1, 0.3, 0.3) > 0.8)
assert.ok(Math.abs(countPercentile(50, 50, 40) - 0.5) < 1e-6)
assert.ok(Math.abs(countPercentile(62.4, 50, 40) - 0.975) < 1e-3)

console.log('luck model ok')
