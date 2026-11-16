// Personal fork: the luck report. Binds lib/luckModel.ts to the card data: per openable expansion, the packs opened
// are estimated from which ◊–◊◊◊◊ are in the dex, then the ☆-and-rarer cards owned are compared with what a typical
// player has after that many packs. "Packs' worth" is the same comparison read the other way: how many packs a
// typical player needs for as many rares.
//
// Deluxe and special packs are left out (different pack shapes, and deluxe reprints share ids with the originals).
// Cards that came by trade, alt gift, Wonder Pick or pack points count as pulled, so this is an estimate, not a record.
import { registered } from '@/lib/altSupport'
import { allCards, basicRarities, expansions } from '@/lib/CardsDB'
import { estimateLuck, type LuckEstimate, type ModelCard, normalCdf } from '@/lib/luckModel'
import { pullRateForSpecificCard } from '@/lib/stats'
import type { Card, Collection, Expansion, Pack, Rarity } from '@/types'

const rareRarities: Rarity[] = ['☆', '☆☆', '☆☆☆', '✵', '✵✵', 'Crown Rare']

interface ExpansionModel {
  expansion: Expansion
  boosters: Pack[]
  cards: { card: Card; rare: boolean; rates: number[] }[]
}

let models: ExpansionModel[] | undefined

// The odds don't depend on the collection, so each card's per-booster rate is worked out once
function getModels() {
  models ??= expansions
    .filter((e) => e.openable && !e.promo && e.packStructure?.cardsPerPack === 5)
    .map((expansion) => {
      const boosters = expansion.packs.filter((p) => p.name !== 'everypack')
      const cards = allCards
        .filter((c) => c.expansion === expansion.id && (basicRarities.includes(c.rarity) || rareRarities.includes(c.rarity)))
        .map((card) => ({
          card,
          rare: rareRarities.includes(card.rarity),
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
}

export function getLuck(collection: Collection): LuckReport {
  const rows = getModels()
    .map(({ expansion, boosters, cards }): ExpansionLuck => {
      const model: ModelCard[] = cards.map(({ card, rare, rates }) => ({ rare, rates, owned: registered(collection, card.internal_id) }))
      return { expansion, boosters, ...estimateLuck(model, boosters.length) }
    })
    .filter((row) => row.packs >= 0.5 || row.rares > 0)

  const total = (of: ExpansionLuck[], pick: (row: ExpansionLuck) => number) => of.reduce((n, row) => n + pick(row), 0)
  const sum = (pick: (row: ExpansionLuck) => number) => total(rows, pick)
  const packs = sum((r) => r.packs)
  const atLeast = rows.some((r) => r.atLeast)
  // independent errors add in quadrature
  const spread = (pick: (row: ExpansionLuck) => number) => Math.sqrt(sum((r) => pick(r) ** 2))
  // A floor on the packs would read as luck (too few packs for the rares), so only expansions with a real estimate are judged
  const judged = rows.filter((r) => !r.atLeast)
  const judgedVariance = total(judged, (r) => r.variance)
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
      // many cards over several expansions: the count is close to normal
      percentile: judgedVariance > 0 ? normalCdf((total(judged, (r) => r.rares) - total(judged, (r) => r.expected)) / Math.sqrt(judgedVariance)) : 0.5,
    },
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

/** "luckier than 88% of players" / "unluckier than 70% of players" / "about as lucky as most players" near the middle. */
export function luckWords(percentile: number) {
  const pct = Math.round(100 * percentile)
  if (pct >= 45 && pct <= 55) {
    return 'about as lucky as most players'
  }
  return pct > 55 ? `luckier than ${Math.min(pct, 99)}% of players` : `unluckier than ${Math.min(100 - pct, 99)}% of players`
}
