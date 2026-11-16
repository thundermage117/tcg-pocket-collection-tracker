// Personal fork: the luck report. Binds lib/luckModel.ts to the card data: per openable expansion, the packs opened
// are estimated from which ◊–◊◊◊◊ are in the dex (and, once those are all owned, from ☆, then ☆☆ and ✵), then the
// rarer cards owned are compared with what a typical player has after that many packs, in total and per rarity.
// "Packs' worth" is the same comparison read the other way: how many packs a typical player needs for as many rares.
//
// Deluxe and special packs are left out (different pack shapes, and deluxe reprints share ids with the originals).
// Cards that came by trade, alt gift, Wonder Pick or pack points count as pulled, so this is an estimate, not a record.
import { registered } from '@/lib/altSupport'
import { allCards, basicRarities, expansions } from '@/lib/CardsDB'
import { countPercentile, estimateLuck, type Judgement, type LuckEstimate, type ModelCard } from '@/lib/luckModel'
import { pullRateForSpecificCard } from '@/lib/stats'
import type { Card, Collection, Expansion, Pack, Rarity } from '@/types'

// The evidence ladder: a rarity counts packs once every rarity below it is used up, and is judged for luck until then
const rareLevels: Partial<Record<Rarity, number>> = { '☆': 1, '☆☆': 2, '✵': 2, '☆☆☆': 3, '✵✵': 3, 'Crown Rare': 3 }
export const rareRarities = Object.keys(rareLevels) as Rarity[]

/** What the packs were counted from at each evidence level, and what's left to judge. */
export const evidenceNames = ['◊–◊◊◊◊', '◊–☆', '◊–☆☆ and ✵']
export const judgedNames = ['☆ and rarer', '☆☆ and rarer', '☆☆☆, ✵✵ and Crown']

interface ExpansionModel {
  expansion: Expansion
  boosters: Pack[]
  cards: { card: Card; level: number; rates: number[] }[]
}

let models: ExpansionModel[] | undefined

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

export interface ExpansionLuck extends LuckEstimate {
  expansion: Expansion
  boosters: Pack[]
}

/** A rarity's luck over every expansion where it's judged. */
export interface RarityTotal {
  rarity: Rarity
  owned: number
  expected: number
  percentile: number
  expansions: number // how many expansions it's judged in
}

export interface LuckReport {
  expansions: ExpansionLuck[] // newest first, only the ones with anything owned
  packs: number
  low: number
  high: number // Infinity when atLeast
  atLeast: boolean
  rares: number
  worth: number
  // Luck is only judged where the packs are an estimate, not a floor, so those expansions get their own totals
  judged: { expansions: number; packs: number; worth: number; percentile: number }
  byRarity: RarityTotal[] // in rarity order, only the ones judged somewhere
}

export function getLuck(collection: Collection): LuckReport {
  const rows = getModels()
    .map(({ expansion, boosters, cards }): ExpansionLuck => {
      const model: ModelCard[] = cards.map(({ card, level, rates }) => ({ rarity: card.rarity, level, rates, owned: registered(collection, card.internal_id) }))
      return { expansion, boosters, ...estimateLuck(model, boosters.length) }
    })
    .filter((row) => row.packs >= 0.5 || row.rares > 0)

  const total = <T>(of: T[], pick: (item: T) => number) => of.reduce((n, item) => n + pick(item), 0)
  const sum = (pick: (row: ExpansionLuck) => number) => total(rows, pick)
  const packs = sum((r) => r.packs)
  const atLeast = rows.some((r) => r.atLeast)
  // independent errors add in quadrature
  const spread = (pick: (row: ExpansionLuck) => number) => Math.sqrt(sum((r) => pick(r) ** 2))
  // A floor on the packs would read as luck (too few packs for the rares), so only expansions with a real estimate are judged
  const judged = rows.filter((r) => !r.atLeast)
  const percentile = (of: Judgement[]) =>
    countPercentile(
      total(of, (j) => j.owned),
      total(of, (j) => j.expected),
      total(of, (j) => j.variance),
    )

  return {
    expansions: rows.toReversed(),
    packs,
    low: Math.max(0, packs - spread((r) => r.packs - r.low)),
    high: atLeast ? Number.POSITIVE_INFINITY : packs + spread((r) => r.high - r.packs),
    atLeast,
    rares: sum((r) => r.rares),
    worth: sum((r) => r.worth),
    judged: {
      expansions: judged.length,
      packs: total(judged, (r) => r.packs),
      worth: total(judged, (r) => r.worth),
      percentile: percentile(judged.map((r) => r.judged)),
    },
    byRarity: rareRarities.flatMap((rarity) => {
      const of = judged.flatMap((r) => r.byRarity.filter((x) => x.rarity === rarity && x.judged))
      return of.length === 0
        ? []
        : [{ rarity, owned: total(of, (j) => j.owned), expected: total(of, (j) => j.expected), percentile: percentile(of), expansions: of.length }]
    }),
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

/** "luckier than 88% of players" / "unluckier than 70% of players" / "about as lucky as most players" near the middle. */
export function luckWords(percentile: number) {
  const pct = Math.round(100 * percentile)
  if (pct >= 45 && pct <= 55) {
    return 'about as lucky as most players'
  }
  return pct > 55 ? `luckier than ${Math.min(pct, 99)}% of players` : `unluckier than ${Math.min(100 - pct, 99)}% of players`
}
