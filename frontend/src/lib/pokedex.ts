// Personal fork: cards grouped by species, in National Dex order. Forms (ex, Alolan, Mega, Team Rocket's, …) count as their base species.
import { allCards } from '@/lib/CardsDB'
import { capitalize, pokemonTranslations } from '@/lib/utils'
import { type Card, type CardType, type Collection, rarities } from '@/types'

// The first 1025 keys are the species in National Dex order (bulbasaur … pecharunt); forms are appended after them
const DEX_SIZE = 1025
const dexNumbers = new Map(
  Object.keys(pokemonTranslations)
    .slice(0, DEX_SIZE)
    .map((key, i) => [key, i + 1]),
)

export interface Generation {
  nr: number
  first: number
  last: number
}

export const generations: Generation[] = [
  [1, 151],
  [152, 251],
  [252, 386],
  [387, 493],
  [494, 649],
  [650, 721],
  [722, 809],
  [810, 905],
  [906, 1025],
].map(([first, last], i) => ({ nr: i + 1, first, last }))

export const generationOf = (dexNr: number) => generations.find((g) => dexNr <= g.last) as Generation

/**
 * Species key (a pokemon_translations key) of a Pokémon card. Drops ` ex`, then the longest run of words that is a species:
 * leading words go first (Alolan, Mega, Team Rocket's, Dusk Mane, Teal Mask), then trailing ones (Mega Mewtwo X, Castform Rainy Form).
 */
export function speciesKey(card: Card): string | undefined {
  if (card.card_type !== 'pokémon') {
    return undefined
  }
  const words = card.name.toLowerCase().split(' ')
  if (words.at(-1) === 'ex') {
    words.pop()
  }
  for (let end = words.length; end > 0; end--) {
    for (let start = 0; start < end; start++) {
      const key = words.slice(start, end).join(' ')
      if (dexNumbers.has(key)) {
        return key
      }
    }
  }
  return undefined
}

export interface Species {
  dexNr: number
  key: string
  cards: Card[] // every printing, in cards.json order
  forms: string[] // distinct card names (Charizard, Charizard ex, Mega Charizard X ex, …)
  types: CardType[]
}

function buildSpecies(): Species[] {
  const byKey = new Map<string, Card[]>()
  for (const card of allCards) {
    const key = speciesKey(card)
    if (key) {
      byKey.set(key, [...(byKey.get(key) ?? []), card])
    }
  }
  return [...byKey]
    .map(([key, cards]) => ({
      dexNr: dexNumbers.get(key) as number,
      key,
      cards,
      forms: [...new Set(cards.map((c) => c.name))],
      types: [...new Set(cards.flatMap((c) => (c.secondary_energy ? [c.energy, c.secondary_energy] : [c.energy])))],
    }))
    .sort((a, b) => a.dexNr - b.dexNr)
}

export const allSpecies: Species[] = buildSpecies()

export const getSpecies = (dexNr: number) => allSpecies.find((s) => s.dexNr === dexNr)

/** Species name in the app language, falling back to English. */
export function speciesName(species: Species, lang: string): string {
  const translations = pokemonTranslations[species.key] as Record<string, string | null>
  return translations[lang] || translations['en-US'] || capitalize(species.key)
}

/** True when any language's name contains the query, so a French name finds the species in English too. */
export function speciesMatches(species: Species, query: string): boolean {
  const translations = pokemonTranslations[species.key] as Record<string, string | null>
  return Object.values(translations).some((name) => name?.toLowerCase().includes(query))
}

export const ownedCount = (collection: Collection | undefined, cards: Card[]) =>
  cards.filter((c) => (collection?.get(c.internal_id)?.amount_owned ?? 0) > 0).length

const rarityIndex = (card: Card) => rarities.indexOf(card.rarity)

/** Art for the species tile: the most common owned printing, or the most common printing when none is owned. */
export function coverCard(species: Species, collection: Collection | undefined): Card {
  const owned = species.cards.filter((c) => (collection?.get(c.internal_id)?.amount_owned ?? 0) > 0)
  const pool = owned.length > 0 ? owned : species.cards
  return pool.reduce((best, c) => (rarityIndex(c) < rarityIndex(best) ? c : best))
}
