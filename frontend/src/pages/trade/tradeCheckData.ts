// Personal fork: binds the pure trade fairness scoring (lib/tradeFairness) to the bundled card and value data.
import { allCards, tradableExpansions } from '@/lib/CardsDB'
import { buildPool, type CardScore, type RarityPool, scoreCard } from '@/lib/tradeFairness'
import { getCardValue } from '@/lib/ValueDB'
import { type Card, type Rarity, tradableRarities } from '@/types'

export const isTradable = (card: Card) => (tradableRarities as readonly Rarity[]).includes(card.rarity) && tradableExpansions.includes(card.expansion)

export const tradableCards = allCards.filter(isTradable)

const pools = new Map<Rarity, RarityPool>()
const scores = new Map<string, CardScore>()

/** Score of a card against every tradable card of its rarity (cached; the snapshot never changes at runtime). */
export function cardScore(card: Card): CardScore {
  let score = scores.get(card.card_id)
  if (!score) {
    let pool = pools.get(card.rarity)
    if (!pool) {
      pool = buildPool(tradableCards.filter((c) => c.rarity === card.rarity).map((c) => getCardValue(c.card_id)))
      pools.set(card.rarity, pool)
    }
    score = scoreCard(getCardValue(card.card_id), pool)
    scores.set(card.card_id, score)
  }
  return score
}

/** Short value hint: ☆☆ Elo position when known, else wishlists per offer. */
export function scoreHint(score: CardScore) {
  if (score.eloPosition !== undefined) {
    return `☆☆ #${score.eloPosition}`
  }
  return score.demand !== undefined ? `demand ×${score.demand.toFixed(1)}` : 'no data'
}
