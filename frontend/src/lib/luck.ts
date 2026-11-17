// Personal fork: the luck report. Binds lib/luckModel.ts to the card data: per openable expansion, the packs opened
// are estimated from which ◊ and ◊◊ are in the dex (and, once those are all owned, from ☆, then ☆☆ and ✵), then the
// rarer cards owned are compared with what a typical player has after that many packs.
//
// It can't see how a card arrived, so it sorts the rarities by what their counts can say:
// - can't be traded (☆☆☆, Crown): the gap to the pack odds is pure luck;
// - tradable and in line with the odds: counted as pulls;
// - tradable and far ahead of the odds in most expansions: traded for. Set aside, and only the gap is reported.
// Luck is told in packs: how many packs a typical player needs to own as many of the pulled cards.
//
// Deluxe and special packs are left out (different pack shapes, and deluxe reprints share ids with the originals).
import { registered } from '@/lib/altSupport'
import { allCards, basicRarities, expansions } from '@/lib/CardsDB'
import { countOdds, countPercentile, estimateLuck, type Judgement, type LuckEstimate, looksTradedFor, type ModelCard, packsScale } from '@/lib/luckModel'
import { pullRateForSpecificCard } from '@/lib/stats'
import { type Card, type Collection, type Expansion, type Pack, type Rarity, tradableRarities } from '@/types'

// The evidence ladder: a rarity counts packs once every rarity below it is used up, and is judged for luck until then
const rareLevels: Partial<Record<Rarity, number>> = { '☆': 1, '☆☆': 2, '✵': 2, '☆☆☆': 3, '✵✵': 3, 'Crown Rare': 3 }
export const rareRarities = Object.keys(rareLevels) as Rarity[]
const canTrade = (rarity: string) => (tradableRarities as readonly string[]).includes(rarity)
// Packs are counted from ◊ and ◊◊ only. The last missing cards are what the estimate leans on most, and those are
// mostly ◊◊◊ and ◊◊◊◊, which alt gifts, trades for the Wonder Pick unlock and pack points fill in: each would add a lot
// of packs that were never opened. ◊ and ◊◊ come in too many copies to be worth filling by hand.
const rarerDiamonds: Rarity[] = ['◊◊◊', '◊◊◊◊']

/** What the packs were counted from at each evidence level, and what's left to judge. */
export const evidenceNames = ['◊ and ◊◊', '◊, ◊◊ and ☆', '◊, ◊◊, ☆, ☆☆ and ✵']

interface ExpansionModel {
  expansion: Expansion
  boosters: Pack[]
  cards: { card: Card; level: number; rates: number[] }[]
}

let models: ExpansionModel[] | undefined
let rarestFirst: Rarity[] | undefined

// The odds don't depend on the collection, so each card's per-booster rate is worked out once
function getModels() {
  models ??= expansions
    .filter((e) => e.openable && !e.promo && e.packStructure?.cardsPerPack === 5)
    .map((expansion) => {
      const boosters = expansion.packs.filter((p) => p.name !== 'everypack')
      const cards = allCards
        .filter((c) => c.expansion === expansion.id && (basicRarities.includes(c.rarity) || c.rarity in rareLevels))
        .map((card) => ({
          card,
          level: rareLevels[card.rarity] ?? 0,
          rates: boosters.map((b) =>
            card.pack === b.name || card.pack === 'everypack' ? -Math.log1p(-pullRateForSpecificCard(expansion, b.name, card) / 100) : 0,
          ),
        }))
        .filter((c) => c.rates.some((r) => r > 0))
      return { expansion, boosters, cards }
    })
  return models
}

/** The rare rarities by their average chance per card per pack, lowest first: the hits people remember lead. */
function getRarestFirst() {
  rarestFirst ??= (() => {
    const all = getModels().flatMap((m) => m.cards.filter((c) => c.level > 0))
    const mean = (rarity: Rarity) => {
      const of = all.filter((c) => c.card.rarity === rarity)
      return of.reduce((sum, c) => sum + Math.max(...c.rates), 0) / Math.max(1, of.length)
    }
    return rareRarities.toSorted((a, b) => mean(a) - mean(b))
  })()
  return rarestFirst
}

export interface ExpansionLuck extends LuckEstimate {
  expansion: Expansion
  boosters: Pack[]
  clear: boolean // judged, and far enough from the middle (outside 10–90%) to be worth showing up front
  judgedWorth: number // packs a typical player needs to own as many of the judged cards (`worth` covers every rare)
}

export type RarityKind = 'untradable' | 'pulls' | 'traded'

/** One rarity over every expansion where it can be read. */
export interface RarityTotal {
  rarity: Rarity
  kind: RarityKind
  owned: number
  expected: number // what the packs give a typical player
  percentile: number
  packs: number // packs opened in the expansions it's read in
  worth: number // packs a typical player needs to own as many (0 for traded)
  expansions: number
}

/** A group of rarities judged together: the packs it was judged over, what they're worth, and the luck. */
export interface Verdict {
  owned: number
  expected: number
  percentile: number
  packs: number
  worth: number
  rarities: Rarity[]
}

export interface LuckReport {
  expansions: ExpansionLuck[] // newest first, only the ones with anything owned
  packs: number
  low: number
  high: number // Infinity when atLeast
  atLeast: boolean
  judgedExpansions: number // expansions with a real estimate, not a floor: the only ones luck is read in
  pulls: Verdict | undefined // every rarity counted as pulls: the headline
  untradable: Verdict | undefined // ☆☆☆ and Crown alone, which nobody can have traded for
  byRarity: RarityTotal[] // rarest first, only the ones read somewhere
  traded: Rarity[]
  rarerDiamonds: RarityTotal[] // ◊◊◊ and ◊◊◊◊ against what the packs give; never used to count them
}

export function getLuck(collection: Collection): LuckReport {
  const inputs = getModels().map(({ expansion, boosters, cards }) => ({
    expansion,
    boosters,
    model: cards.map(({ card, level, rates }): ModelCard => ({ rarity: card.rarity, level, rates, owned: registered(collection, card.internal_id) })),
  }))

  // A first pass on the packs alone, to spot the tradable rares that run far ahead of them
  const firstPass = inputs.map(({ model, boosters }) => estimateLuck(model, boosters.length, new Set(rarerDiamonds))).filter((e) => !e.atLeast)
  const traded = getRarestFirst().filter(
    (rarity) => canTrade(rarity) && looksTradedFor(firstPass.flatMap((e) => e.byRarity.filter((r) => r.rarity === rarity && r.judged))),
  )
  const setAside = new Set<string>([...rarerDiamonds, ...traded])

  const rows = inputs
    .map(({ expansion, boosters, model }) => {
      const estimate = estimateLuck(model, boosters.length, setAside)
      const p = estimate.judged.percentile
      const judgedRarities = new Set(estimate.byRarity.filter((r) => r.judged).map((r) => r.rarity))
      const judgedWorth = packsScale([{ cards: model.filter((c) => judgedRarities.has(c.rarity)), perBooster: estimate.perBooster }]) * estimate.packs
      return {
        expansion,
        boosters,
        model,
        ...estimate,
        judgedWorth,
        clear: !estimate.atLeast && estimate.judged.total > 0 && (p <= 0.1 || p >= 0.9),
      }
    })
    .filter((row) => row.packs >= 0.5 || row.rares > 0 || row.byRarity.some((r) => r.owned > 0))

  const total = <T>(of: T[], pick: (item: T) => number) => of.reduce((n, item) => n + pick(item), 0)
  const packs = total(rows, (r) => r.packs)
  const atLeast = rows.some((r) => r.atLeast)
  // independent errors add in quadrature
  const spread = (pick: (row: (typeof rows)[number]) => number) => Math.sqrt(total(rows, (r) => pick(r) ** 2))
  // A floor on the packs would read as luck (too few packs for the rares), so only expansions with a real estimate are read
  const judged = rows.filter((r) => !r.atLeast)
  const percentile = (of: Judgement[]) =>
    countPercentile(
      total(of, (j) => j.owned),
      total(of, (j) => j.expected),
      total(of, (j) => j.variance),
    )

  // A group of rarities over the expansions where they're judged: luck as a percentile and in packs
  const verdict = (rarities: Rarity[]): Verdict | undefined => {
    const inRows = judged
      .map((row) => ({ row, of: row.byRarity.filter((r) => r.judged && rarities.includes(r.rarity as Rarity)) }))
      .filter(({ of }) => of.length > 0)
    if (inRows.length === 0) {
      return undefined
    }
    const of = inRows.flatMap((x) => x.of)
    const over = total(inRows, ({ row }) => row.packs)
    const scale = packsScale(
      inRows.map(({ row, of }) => ({ cards: row.model.filter((c) => of.some((r) => r.rarity === c.rarity)), perBooster: row.perBooster })),
    )
    return {
      owned: total(of, (j) => j.owned),
      expected: total(of, (j) => j.expected),
      percentile: percentile(of),
      packs: over,
      worth: scale * over,
      rarities: rarities.filter((rarity) => of.some((r) => r.rarity === rarity)),
    }
  }

  // A set-aside rarity is never judged, only compared with what the packs give wherever they're a real estimate
  const gapToPacks = (rarity: Rarity): RarityTotal[] => {
    const of = judged.flatMap((r) => r.byRarity.filter((x) => x.rarity === rarity))
    return of.length === 0
      ? []
      : [
          {
            rarity,
            kind: 'traded',
            owned: total(of, (j) => j.owned),
            expected: total(of, (j) => j.expected),
            percentile: percentile(of),
            packs: total(judged, (r) => r.packs),
            worth: 0,
            expansions: of.length,
          },
        ]
  }

  const byRarity = getRarestFirst().flatMap((rarity): RarityTotal[] => {
    const kind: RarityKind = setAside.has(rarity) ? 'traded' : canTrade(rarity) ? 'pulls' : 'untradable'
    if (kind === 'traded') {
      return gapToPacks(rarity)
    }
    const v = verdict([rarity])
    const expansionsIn = judged.filter((r) => r.byRarity.some((x) => x.rarity === rarity && x.judged)).length
    return v ? [{ rarity, kind, owned: v.owned, expected: v.expected, percentile: v.percentile, packs: v.packs, worth: v.worth, expansions: expansionsIn }] : []
  })

  return {
    expansions: rows.toReversed(),
    packs,
    low: Math.max(0, packs - spread((r) => r.packs - r.low)),
    high: atLeast ? Number.POSITIVE_INFINITY : packs + spread((r) => r.high - r.packs),
    atLeast,
    judgedExpansions: judged.length,
    pulls: verdict(rareRarities.filter((r) => !setAside.has(r))),
    untradable: verdict(rareRarities.filter((r) => !canTrade(r))),
    byRarity,
    traded,
    rarerDiamonds: rarerDiamonds.flatMap(gapToPacks),
  }
}

/** A pack count as an estimate reads: two significant figures ("about 1,900", "240", "43"). */
export function roundPacks(n: number) {
  if (n < 100) {
    return Math.round(n).toLocaleString('en-US')
  }
  const step = 10 ** (Math.floor(Math.log10(n)) - 1)
  return (Math.round(n / step) * step).toLocaleString('en-US')
}

/** A typical count: one decimal while it's small enough to matter ("2.1"), whole above ten. */
export const typicalCount = (n: number) => n.toFixed(n < 10 ? 1 : 0)

/** Luck in packs: "about 800 packs behind" / "about 300 packs ahead" / "right on par" within a tenth. */
export function packsAhead(worth: number, packs: number) {
  const gap = worth - packs
  if (Math.abs(gap) < 0.1 * packs || Math.abs(gap) < 5) {
    return 'right on par'
  }
  return `about ${roundPacks(Math.abs(gap))} packs ${gap > 0 ? 'ahead' : 'behind'}`
}

/** Below this many typical cards, luck reads as odds ("about 1 player in 19 has this few"), not packs: one card more or
 * less would swing a packs figure by hundreds. */
const SMALL_COUNT = 10

/** "about 1 player in 19 has this few" / "about 1 player in 6 has this many" / "about what most players have". */
export function oddsWords(owned: number, expected: number) {
  const chance = countOdds(owned, expected)
  if (chance > 0.3) {
    return 'about what most players have'
  }
  return `about 1 player in ${Math.round(1 / chance)} has this ${owned < expected ? 'few' : 'many'}`
}

/** Luck in packs while the count is big enough, in odds when it's small. */
export const luckInWords = (v: { owned: number; expected: number; worth: number; packs: number }) =>
  v.expected < SMALL_COUNT ? oddsWords(v.owned, v.expected) : packsAhead(v.worth, v.packs)

/** "luckier than 88% of players" / "unluckier than 70% of players" / "about as lucky as most players" near the middle. */
export function luckWords(percentile: number) {
  const pct = Math.round(100 * percentile)
  if (pct >= 45 && pct <= 55) {
    return 'about as lucky as most players'
  }
  return pct > 55 ? `luckier than ${Math.min(pct, 99)}% of players` : `unluckier than ${Math.min(100 - pct, 99)}% of players`
}
