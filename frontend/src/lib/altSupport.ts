// Personal fork: what the alt account can do for the main one. Sharing gifts a ◊–◊◊◊◊ card (each account can
// receive one a day) and ☆ and up go by trade, so a card main needs that the alt owns doesn't have to come from packs.
// The alt doesn't trade with anyone else: that only spends Shinedust.
//
// Latest-set unlock (community-tested, not official): once an account has registered every ◊–◊◊◊◊ card of the newest
// set, its 24-hour Wonder Picks show ☆ or ☆☆ cards it's missing; with every ☆ registered too, only ☆☆. So the
// newest set's ◊–☆ cards come first for both accounts, and the alt's ☆☆ Wonder Picks can then be traded to main.
// They reportedly stop once the account owns every ☆☆ of the set. Sources are in FORK.md, "Alt account".
import { allCards, basicRarities, expansions, getCardByInternalId, tradableExpansions } from '@/lib/CardsDB'
import { pullRate, pullRateForSpecificCard } from '@/lib/stats'
import { FAIR_BAND } from '@/lib/tradeFairness'
import { getWantedCards } from '@/lib/utils'
import { valueSortKey } from '@/lib/ValueDB'
import { cardScore } from '@/pages/trade/tradeCheckData'
import type { Profile } from '@/services/profile/useProfile'
import { type Card, type Collection, defaultRaritySettings, type Expansion, type Pack, type Rarity, type RaritySettingsRow, tradableRarities } from '@/types'

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

const isGiftable = (card: Card) => basicRarities.includes(card.rarity)

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
function byPriority(receiver: Collection) {
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

/**
 * A spare scoring this or higher (percentile among cards of its rarity, lib/tradeFairness) is worth more in a trade with
 * another player than as the card main sends the alt back, which never leaves the alt. Below it, a spare is hard to
 * trade with anyone else, and the alt takes any card of the rarity, so that's where it goes.
 */
export const KEEP_FOR_TRADING = 50

export const tradeScore = (card: Card) => cardScore(card).score ?? 0 // no value data: nobody lists it, so it's alt fodder
export const keepForTrading = (card: Card) => tradeScore(card) >= KEEP_FOR_TRADING

export interface AltTrade {
  card: Card // ☆ and up main needs and the alt owns
  back?: Card // main's low-value spare it sends back; undefined while main has none of this rarity
  outside?: Card // waiting only: main's high-value spare that could get this card from another player instead
}

export interface SparePlan {
  trades: AltTrade[] // in altCovers' order (unlock cards first, then rarest and most valuable)
  forAlt: Map<number, number> // internal_id → spare copies main sends back in the trades above
}

/**
 * Which of main's spares go to the alt and which stay for trading with other players. Each alt trade gets main's
 * lowest-scoring spare of that rarity below KEEP_FOR_TRADING; a copy is promised to one trade only, and a card main
 * would keep is never offered. A trade with no such spare waits rather than spend a high-value spare on the alt, and
 * names one that could get the card from another player instead: the cheapest that's still roughly fair for it.
 */
export function planSpares(main: Collection, mainSettings: RaritySettingsRow[], alt: Collection): SparePlan {
  const keep = Object.fromEntries(mainSettings.map((s) => [s.rarity, s.to_keep]))
  const cover = altCovers(main, mainSettings, alt)
  const rarities = new Set(cover.trade.map((c) => c.rarity))
  const spares = [...main].flatMap(([id, row]) => {
    const card = getCardByInternalId(id)
    if (!card || !rarities.has(card.rarity) || !canMoveToMain(card)) {
      return []
    }
    const left = row.amount_owned - (row.amount_wanted ?? keep[card.rarity] ?? defaultRaritySettings.to_keep)
    return left > 0 ? [{ card, left, score: tradeScore(card) }] : []
  })
  const low = spares.filter((s) => s.score < KEEP_FOR_TRADING).sort((a, b) => a.score - b.score)
  const high = spares.filter((s) => s.score >= KEEP_FOR_TRADING).sort((a, b) => a.score - b.score)

  const forAlt = new Map<number, number>()
  const trades = cover.trade.map((card): AltTrade => {
    const fits = (s: (typeof spares)[number]) => s.card.rarity === card.rarity && s.card.internal_id !== card.internal_id && s.left > 0
    const back = low.find(fits)
    if (back) {
      back.left--
      forAlt.set(back.card.internal_id, (forAlt.get(back.card.internal_id) ?? 0) + 1)
      return { card, back: back.card }
    }
    const wanted = tradeScore(card)
    const outside = high.find((s) => fits(s) && s.score >= wanted - FAIR_BAND) ?? high.findLast(fits)
    if (outside) {
      outside.left--
    }
    return { card, outside: outside?.card }
  })
  return { trades, forAlt }
}

/** Main can take one gift a day, so once the alt holds this many ◊–◊◊◊◊ main needs, more of them add nothing for weeks. */
export const GIFT_QUEUE_FULL = 14

export interface AltPackRow {
  expansion: Expansion
  pack: Pack
  unlockTargets: Card[] // the alt's missing newest-set ◊–☆ in this pack that main can't gift it
  unlockChance: number // chance one pack gives one of them
  rareTargets: Card[] // ☆ and up main needs, the alt doesn't own and can trade, best first
  rareChance: number
  commonTargets: Card[] // ◊–◊◊◊◊ main needs and the alt doesn't own; empty while the gift queue is full
  commonExpected: number // how many of them one pack gives on average
}

export interface AltPackPick {
  phase: 'unlock' | 'main'
  unlockLeft: number // the alt's unlock cards only packs or Wonder Picks can give
  giftQueue: number // ◊–◊◊◊◊ main needs that the alt already holds
  packs: AltPackRow[] // best first, only packs that give something
}

const openablePacks = expansions
  .filter((e) => e.openable && !e.promo && e.packStructure)
  .flatMap((expansion) => expansion.packs.filter((p) => p.name !== 'everypack').map((pack) => ({ expansion, pack })))

const inPack = (cards: Card[], expansion: Expansion, pack: Pack) =>
  cards.filter((c) => c.expansion === expansion.id && (c.pack === pack.name || c.pack === 'everypack'))

/**
 * Which pack the alt should open. While the alt still misses newest-set ◊–☆ that main can't gift it, the newest set's
 * packs, by the chance of one of those (its ☆☆ Wonder Picks follow). After that every pack, by the chance of a ☆ or
 * rarer card main needs that neither account has, since trades are what the alt adds; ◊–◊◊◊◊ break ties only while
 * the gift queue is short.
 */
export function bestAltPacks(main: Collection, mainSettings: RaritySettingsRow[], alt: Collection): AltPackPick {
  const toAlt = new Set(giftsToAlt(main, mainSettings, alt).map((c) => c.internal_id))
  const unlock = unlockProgress(alt).missing.filter((c) => !toAlt.has(c.internal_id))
  const cover = altCovers(main, mainSettings, alt)
  const giftQueue = cover.gift.length

  const needs = new Set([...getWantedCards(main, mainSettings), ...unlockProgress(main).missing.map((c) => c.internal_id)])
  const forMain = [...needs]
    .map((id) => getCardByInternalId(id))
    .filter((c): c is Card => c !== undefined && canMoveToMain(c) && (alt.get(c.internal_id)?.amount_owned ?? 0) === 0)
    .sort((a, b) => (rarityOrder.get(b.rarity) ?? 0) - (rarityOrder.get(a.rarity) ?? 0) || valueSortKey(b.card_id) - valueSortKey(a.card_id))
  const rare = forMain.filter((c) => !isGiftable(c))
  const common = giftQueue < GIFT_QUEUE_FULL ? forMain.filter(isGiftable) : []

  const phase = unlock.length > 0 ? 'unlock' : 'main'
  const rows = openablePacks
    .filter(({ expansion }) => phase === 'main' || expansion.id === latestExpansion.id)
    .map(({ expansion, pack }): AltPackRow => {
      const unlockTargets = inPack(unlock, expansion, pack)
      const rareTargets = inPack(rare, expansion, pack)
      const commonTargets = inPack(common, expansion, pack)
      return {
        expansion,
        pack,
        unlockTargets,
        unlockChance: unlockTargets.length ? pullRate(unlockTargets, expansion, pack, false) : 0,
        rareTargets,
        rareChance: rareTargets.length ? pullRate(rareTargets, expansion, pack, false) : 0,
        commonTargets,
        // by linearity, the expected number of them in one pack (pullRateForSpecificCard is a percent)
        commonExpected: commonTargets.reduce((sum, c) => sum + pullRateForSpecificCard(expansion, pack.name, c) / 100, 0),
      }
    })
    .filter((r) => r.unlockChance > 0 || r.rareChance > 0 || r.commonExpected > 0)
    .sort((a, b) => (phase === 'unlock' ? b.unlockChance - a.unlockChance : 0) || b.rareChance - a.rareChance || b.commonExpected - a.commonExpected)

  return { phase, unlockLeft: unlock.length, giftQueue, packs: rows }
}
