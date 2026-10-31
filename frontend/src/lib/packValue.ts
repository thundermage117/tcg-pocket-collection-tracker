// Personal fork: rank boosters by the value of their ☆☆ pool.
// Every ☆☆ in a booster has equal odds (slot 4: 0.5% / N, slot 5: 2% / N), so a guaranteed ☆☆
// is a uniform draw from the booster's pool and every stat below is a plain average over it.

import { allCards, expansions } from '@/lib/CardsDB'
import { getCardValue } from '@/lib/ValueDB'
import type { Card, Collection, ExpansionId } from '@/types'

export interface BoosterValue {
  expansionId: ExpansionId
  expansionName: string
  packName: string
  cards: Card[]
  meanAdj: number
  pTop50: number
  pTrainerOrRainbow: number
  minVotes: number
  best: Card
  // personalised: what a guaranteed ☆☆ is worth to you
  pNew: number
  meanAdjNew: number | undefined
}

const TOP_N = 50

const adjOf = (card: Card) => getCardValue(card.card_id)?.adj ?? 0

export function getBoosterValues(collection: Collection | undefined): BoosterValue[] {
  const owned = (card: Card) => (collection?.get(card.internal_id)?.amount_owned ?? 0) > 0
  const result: BoosterValue[] = []

  for (const expansion of expansions) {
    // openable === false excludes the Deluxe packs (A4b, B4b) and promos
    if (!expansion.openable || expansion.promo) {
      continue
    }
    const twoStars = allCards.filter((c) => c.expansion === expansion.id && c.rarity === '☆☆' && getCardValue(c.card_id)?.adj !== undefined)
    for (const pack of expansion.packs.filter((p) => p.name !== 'everypack')) {
      const cards = twoStars.filter((c) => c.pack === pack.name || c.pack === 'everypack')
      if (cards.length === 0) {
        continue
      }
      const missing = cards.filter((c) => !owned(c))
      const values = cards.map((c) => getCardValue(c.card_id) ?? {})
      result.push({
        expansionId: expansion.id,
        expansionName: expansion.name,
        packName: pack.name,
        cards: cards.toSorted((a, b) => adjOf(b) - adjOf(a)),
        meanAdj: mean(cards.map(adjOf)),
        pTop50: values.filter((v) => (v.rank ?? Infinity) <= TOP_N).length / cards.length,
        pTrainerOrRainbow: values.filter((v) => v.kind === 'trainer' || v.kind === 'rainbow').length / cards.length,
        minVotes: Math.min(...values.map((v) => v.votes ?? 0)),
        best: cards.reduce((a, b) => (adjOf(b) > adjOf(a) ? b : a)),
        pNew: missing.length / cards.length,
        meanAdjNew: missing.length ? mean(missing.map(adjOf)) : undefined,
      })
    }
  }
  return result
}

function mean(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}
