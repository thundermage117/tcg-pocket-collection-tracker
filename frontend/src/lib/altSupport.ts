// Personal fork: what the alt account can do for the main one. The alt can gift main a ◊–◊◊◊◊ card (one a day)
// and trade it ☆ and up like any other trade, so a card main needs that the alt owns doesn't have to come from
// packs or strangers.
import { basicRarities, getCardByInternalId, tradableExpansions } from '@/lib/CardsDB'
import { getExtraCards, getWantedCards } from '@/lib/utils'
import { valueSortKey } from '@/lib/ValueDB'
import { type Card, type Collection, type Rarity, type RaritySettingsRow, tradableRarities } from '@/types'

/** Cards the alt can hand over at all: gifts and trades both need a tradable rarity in a tradable set. */
export const canMoveToMain = (card: Card) => (tradableRarities as readonly Rarity[]).includes(card.rarity) && tradableExpansions.includes(card.expansion)

export const isGiftable = (card: Card) => basicRarities.includes(card.rarity)

export interface AltCover {
  gift: Card[] // ◊–◊◊◊◊ main needs and the alt owns
  trade: Card[] // ☆ and up main needs and the alt owns
  rest: number // main needs it and the alt doesn't have it either
}

const rarityOrder = new Map(tradableRarities.map((r, i) => [r as Rarity, i]))
// rarest first (◊◊◊◊ before ◊), then most valuable
const byRarityThenValue = (a: Card, b: Card) =>
  (rarityOrder.get(b.rarity) ?? 0) - (rarityOrder.get(a.rarity) ?? 0) || valueSortKey(b.card_id) - valueSortKey(a.card_id)

/** Splits main's wanted cards (its trade settings: to_collect, per-card wanted amounts) by how the alt can help. */
export function altCovers(main: Collection, mainSettings: RaritySettingsRow[], alt: Collection): AltCover {
  const cover: AltCover = { gift: [], trade: [], rest: 0 }
  for (const id of getWantedCards(main, mainSettings)) {
    const card = getCardByInternalId(id)
    if (!card) {
      continue
    }
    if ((alt.get(id)?.amount_owned ?? 0) > 0) {
      ;(isGiftable(card) ? cover.gift : cover.trade).push(card)
    } else {
      cover.rest++
    }
  }
  cover.gift.sort(byRarityThenValue)
  cover.trade.sort(byRarityThenValue)
  return cover
}

/**
 * Main's collection with every card the alt can hand over counted as owned, so "missing" and pack odds only chase
 * cards neither account has. A copy; the cached collection isn't touched.
 */
export function withAltCards(main: Collection, alt: Collection | undefined): Collection {
  if (!alt) {
    return main
  }
  const merged = new Map(main)
  for (const [id, row] of alt) {
    if (row.amount_owned > 0 && (main.get(id)?.amount_owned ?? 0) === 0) {
      const card = getCardByInternalId(id)
      if (card && canMoveToMain(card)) {
        merged.set(id, { ...row, amount_owned: 1, amount_wanted: main.get(id)?.amount_wanted ?? null })
      }
    }
  }
  return merged
}

/** Alt cards worth trading away to other people: its extras, minus anything main still needs from it. */
export function altSpares(alt: Collection, altSettings: RaritySettingsRow[], mainWanted: Set<number>): number[] {
  return getExtraCards(alt, altSettings).filter((id) => !mainWanted.has(id))
}
