// Personal fork: what the alt account can do for the main one. Sharing gifts a ◊–◊◊◊◊ card (each account can
// receive one a day) and ☆ and up go by trade, so a card main needs that the alt owns doesn't have to come from packs.
// The alt doesn't trade with anyone else: that only spends Shinedust.
//
// Latest-set unlock (community-tested, not official): once an account has registered every ◊–◊◊◊◊ card of the newest
// set, its 24-hour Wonder Picks show ☆ or ☆☆ cards it's missing; with every ☆ registered too, only ☆☆. So the
// newest set's ◊–☆ cards come first for both accounts, and the alt's ☆☆ Wonder Picks can then be traded to main.
// They reportedly stop once the account owns every ☆☆ of the set. Sources are in FORK.md, "Alt account".
import { allCards, basicRarities, expansions, getCardByInternalId, tradableExpansions } from '@/lib/CardsDB'
import { pullRate } from '@/lib/stats'
import { getWantedCards } from '@/lib/utils'
import { valueSortKey } from '@/lib/ValueDB'
import type { Profile } from '@/services/profile/useProfile'
import { type Card, type Collection, type Rarity, type RaritySettingsRow, tradableRarities } from '@/types'

export const today = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time
/** localStorage key for the day the last gift to `to` was logged on /alt, so the next one waits for tomorrow. */
export const giftKey = (to: Profile) => `tcg_last_gift_to_${to}`

export function readGiftDate(to: Profile) {
  try {
    return localStorage.getItem(giftKey(to))
  } catch {
    return null
  }
}

/** Cards the alt can hand over at all: gifts and trades both need a tradable rarity in a tradable set. */
export const canMoveToMain = (card: Card) => (tradableRarities as readonly Rarity[]).includes(card.rarity) && tradableExpansions.includes(card.expansion)

export const isGiftable = (card: Card) => basicRarities.includes(card.rarity)

/** The newest set you can open packs of (deluxe and promo sets aren't). */
export const latestExpansion = expansions.filter((e) => e.openable && !e.promo).at(-1) ?? expansions[0]

const unlockRarities: Rarity[] = [...basicRarities, '☆']
const unlockCards = allCards.filter((c) => c.expansion === latestExpansion.id && unlockRarities.includes(c.rarity))

/** In the account's dex: owned now, or owned once (`collected` stays set after a card is given away). */
export const registered = (collection: Collection, id: number) => {
  const row = collection.get(id)
  return row !== undefined && (row.collected || row.amount_owned > 0)
}

export interface UnlockProgress {
  diamonds: { have: number; total: number }
  star: { have: number; total: number }
  missing: Card[] // ◊–☆ of the latest set not registered yet
}

export function unlockProgress(collection: Collection): UnlockProgress {
  const missing = unlockCards.filter((c) => !registered(collection, c.internal_id))
  const diamondsTotal = unlockCards.filter((c) => c.rarity !== '☆').length
  const diamondsMissing = missing.filter((c) => c.rarity !== '☆').length
  return {
    diamonds: { have: diamondsTotal - diamondsMissing, total: diamondsTotal },
    star: { have: unlockCards.length - diamondsTotal - (missing.length - diamondsMissing), total: unlockCards.length - diamondsTotal },
    missing,
  }
}

const twoStarCards = allCards.filter((c) => c.expansion === latestExpansion.id && c.rarity === '☆☆')

/** Whether the account has registered every ☆☆ of the latest set, when its ☆☆ Wonder Picks reportedly stop. */
export const allTwoStarsRegistered = (collection: Collection) => twoStarCards.every((c) => registered(collection, c.internal_id))

/** The latest-set pack most likely to give one of `cards` (the account's missing unlock cards nobody can hand it). */
export function bestUnlockPack(cards: Card[]) {
  if (cards.length === 0 || !latestExpansion.packStructure) {
    return undefined
  }
  return latestExpansion.packs
    .filter((p) => p.name !== 'everypack')
    .map((pack) => ({ pack, chance: pullRate(cards, latestExpansion, pack, false) }))
    .reduce((a, b) => (b.chance > a.chance ? b : a))
}

const rarityOrder = new Map(tradableRarities.map((r, i) => [r as Rarity, i]))

/**
 * Order for cards one account can give the other: unregistered latest-set cards first (they count towards the
 * unlock), then other cards the receiver has never registered, then extra copies it wants; rarest and most valuable
 * first within each.
 */
export function byPriority(receiver: Collection) {
  const tier = (c: Card) => (registered(receiver, c.internal_id) ? 2 : c.expansion === latestExpansion.id ? 0 : 1)
  return (a: Card, b: Card) =>
    tier(a) - tier(b) || (rarityOrder.get(b.rarity) ?? 0) - (rarityOrder.get(a.rarity) ?? 0) || valueSortKey(b.card_id) - valueSortKey(a.card_id)
}

export const countsForUnlock = (receiver: Collection, card: Card) =>
  card.expansion === latestExpansion.id && unlockRarities.includes(card.rarity) && !registered(receiver, card.internal_id)

export interface AltCover {
  gift: Card[] // ◊–◊◊◊◊ main needs and the alt owns
  trade: Card[] // ☆ and up main needs and the alt owns
  rest: number // main needs it and the alt doesn't have it either
}

/** Main's wanted cards (its trade settings) plus its missing latest-set unlock cards, split by how the alt can help. */
export function altCovers(main: Collection, mainSettings: RaritySettingsRow[], alt: Collection): AltCover {
  const needs = new Set([...getWantedCards(main, mainSettings), ...unlockProgress(main).missing.map((c) => c.internal_id)])
  const cover: AltCover = { gift: [], trade: [], rest: 0 }
  for (const id of needs) {
    const card = getCardByInternalId(id)
    if (!card || !canMoveToMain(card)) {
      continue
    }
    if ((alt.get(id)?.amount_owned ?? 0) > 0) {
      ;(isGiftable(card) ? cover.gift : cover.trade).push(card)
    } else {
      cover.rest++
    }
  }
  cover.gift.sort(byPriority(main))
  cover.trade.sort(byPriority(main))
  return cover
}

/**
 * Main's ◊–◊◊◊◊ the alt hasn't registered in the latest set, for the alt's own unlock: its ☆☆ Wonder Picks can then be
 * traded to main. Only copies beyond main's keep amount, so main's decks don't lose a card.
 */
export function giftsToAlt(main: Collection, mainSettings: RaritySettingsRow[], alt: Collection): Card[] {
  const keep = Object.fromEntries(mainSettings.map((s) => [s.rarity, s.to_keep]))
  return unlockCards
    .filter((c) => isGiftable(c) && !registered(alt, c.internal_id))
    .filter((c) => {
      const row = main.get(c.internal_id)
      return (row?.amount_owned ?? 0) > Math.max(1, row?.amount_wanted ?? keep[c.rarity] ?? 1)
    })
    .sort(byPriority(alt))
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
