// Personal fork: the chase wall's pick per booster. Not advice on what to open: the one card worth hoping for in each.
// Among the ☆-and-rarer cards main is missing, the highest Rankings tier wins, then the rarer card, then the score.
// Cards nobody trades (☆☆☆, Crown) have no tier, so they only lead a booster when nothing ranked is left.
import { allCards, expansions } from '@/lib/CardsDB'
import { ownsCard } from '@/lib/packValue'
import { tierFor, tiers } from '@/lib/rankings'
import { pullRateForSpecificCard } from '@/lib/stats'
import { valueSortKey } from '@/lib/ValueDB'
import { type Card, type Collection, type Expansion, type Pack, type Rarity, rarities } from '@/types'

const chaseRarities: Rarity[] = ['☆', '☆☆', '☆☆☆', '✵', '✵✵', 'Crown Rare']

export interface Chase {
  expansion: Expansion
  pack: Pack
  card: Card
  perPack: number // chance one pack of this booster holds the card
  others: number // other ☆-and-rarer cards still missing in the booster
}

const bestFirst = (a: Card, b: Card) =>
  (tierFor(a) ?? tiers.length) - (tierFor(b) ?? tiers.length) ||
  rarities.indexOf(b.rarity) - rarities.indexOf(a.rarity) ||
  valueSortKey(b.card_id) - valueSortKey(a.card_id)

/** One chase card per openable booster, newest expansion first; boosters with no ☆+ left to pull are left out. */
export function getChaseCards(collection: Collection | undefined): Chase[] {
  const result: Chase[] = []
  for (const expansion of expansions.filter((e) => e.openable && !e.promo && e.packStructure?.cardsPerPack === 5).toReversed()) {
    const missing = allCards.filter((c) => c.expansion === expansion.id && chaseRarities.includes(c.rarity) && !ownsCard(collection, c))
    const taken = new Set<number>() // a card every booster holds leads only one of them
    for (const pack of expansion.packs.filter((p) => p.name !== 'everypack')) {
      const pool = missing.filter((c) => c.pack === pack.name || c.pack === 'everypack').toSorted(bestFirst)
      const card = pool.find((c) => !taken.has(c.internal_id)) ?? pool[0]
      if (!card) {
        continue
      }
      taken.add(card.internal_id)
      result.push({ expansion, pack, card, perPack: pullRateForSpecificCard(expansion, pack.name, card) / 100, others: pool.length - 1 })
    }
  }
  return result
}
