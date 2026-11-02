// Personal fork: cards grouped by species, in National Dex order. Forms (ex, Alolan, Mega, Team Rocket's, …) count as their base species.
import { queryOptions } from '@tanstack/react-query'
import { allCards } from '@/lib/CardsDB'
import { fetchJsonAsset } from '@/lib/fetchJsonAsset'
import { capitalize, pokemonTranslations } from '@/lib/utils'
import { type Card, type CardType, type Collection, type Rarity, rarities } from '@/types'
import evolutions from '../../assets/evolutions.json'
import formSprites from '../../assets/form-sprites.json'
import speciesGroups from '../../assets/species-groups.json'

// The first 1025 keys are the species in National Dex order (bulbasaur … pecharunt); forms are appended after them
const DEX_SIZE = 1025
const dexKeys = Object.keys(pokemonTranslations).slice(0, DEX_SIZE)
const dexNumbers = new Map(dexKeys.map((key, i) => [key, i + 1]))

export interface Generation {
  nr: number
  region: string
  first: number
  last: number
}

export const generations: Generation[] = (
  [
    ['Kanto', 1, 151],
    ['Johto', 152, 251],
    ['Hoenn', 252, 386],
    ['Sinnoh', 387, 493],
    ['Unova', 494, 649],
    ['Kalos', 650, 721],
    ['Alola', 722, 809],
    ['Galar', 810, 905],
    ['Paldea', 906, 1025],
  ] as const
).map(([region, first, last], i) => ({ nr: i + 1, region, first, last }))

/**
 * Official artwork by artwork id: a dex number (scripts/download-sprites.ts, every species including those with no card)
 * or a PokéAPI form id from 10001 up (scripts/download-form-sprites.ts). Shiny artwork exists for dex numbers only.
 */
export const spriteUrl = (artworkId: number, shiny = false) => `/images/sprites/${shiny ? 'shiny/' : ''}${artworkId}.webp`

/** Artwork id for a form's card name (Alolan Vulpix, Mega Charizard X ex); the species' own when PokéAPI has none for the form. */
export const formArtworkId = (species: Species, cardName: string) => (formSprites as Record<string, number>)[cardName.replace(/ ex$/, '')] ?? species.dexNr

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

// From scripts/generate-species-groups.ts (PokéAPI's flags); a species is in at most one
export const speciesGroupOptions = ['legendary', 'mythical', 'starter'] as const
export type SpeciesGroup = (typeof speciesGroupOptions)[number]
const groupOf = (dexNr: number) => speciesGroupOptions.find((group) => speciesGroups[group].includes(dexNr))

export const stageOptions = ['basic', 'stage1', 'stage2'] as const
export type Stage = (typeof stageOptions)[number]

export const featureOptions = ['ex', 'mega', 'regional'] as const
export type Feature = (typeof featureOptions)[number]

export const typesOf = (cards: Card[]): CardType[] => [...new Set(cards.flatMap((c) => (c.secondary_energy ? [c.energy, c.secondary_energy] : [c.energy])))]
export const stagesOf = (cards: Card[]): Stage[] => stageOptions.filter((stage) => cards.some((c) => c.evolution_type === stage))

const regionalPrefix = /^(Alolan|Galarian|Hisuian|Paldean) /

/** What a species (or form) has among its cards: an ex card, a Mega form, a regional form. */
export const featuresOf = (cards: Card[]): Feature[] =>
  featureOptions.filter((f) => cards.some((c) => (f === 'ex' ? c.ex : f === 'mega' ? c.name.startsWith('Mega ') : regionalPrefix.test(c.name))))

export interface Species {
  dexNr: number
  key: string
  cards: Card[] // every printing, in cards.json order
  forms: string[] // distinct card names (Charizard, Charizard ex, Mega Charizard X ex, …)
  types: CardType[]
  group?: SpeciesGroup
  stages: Stage[] // a species can have more than one (Mega Mewtwo X is Basic, Mewtwo too; Mega Charizard is Stage 2)
  features: Feature[]
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
      types: typesOf(cards),
      group: groupOf(dexNumbers.get(key) as number),
      stages: stagesOf(cards),
      features: featuresOf(cards),
    }))
    .sort((a, b) => a.dexNr - b.dexNr)
}

export const allSpecies: Species[] = buildSpecies()

export const getSpecies = (dexNr: number) => allSpecies.find((s) => s.dexNr === dexNr)

const shinyRarities: Rarity[] = ['✵', '✵✵']

/** The Shiny Pokédex: species with a ✵ or ✵✵ card, each narrowed to just those cards. */
export const shinySpecies: Species[] = allSpecies.flatMap((species) => {
  const cards = species.cards.filter((c) => shinyRarities.includes(c.rarity))
  return cards.length === 0
    ? []
    : [
        {
          ...species,
          cards,
          forms: [...new Set(cards.map((c) => c.name))],
          stages: stagesOf(cards),
          features: featuresOf(cards),
        },
      ]
})

/** Name of any dex number in the app language (also species with no cards, for evolution lines), falling back to English. */
export function dexName(dexNr: number, lang: string): string {
  const key = dexKeys[dexNr - 1]
  const translations = pokemonTranslations[key] as Record<string, string | null>
  return translations[lang] || translations['en-US'] || capitalize(key)
}

export const speciesName = (species: Species, lang: string) => dexName(species.dexNr, lang)

/** True when any language's name contains the query, so a French name finds the species in English too. `25` or `#25` matches Pikachu. */
export function speciesMatches(species: Species, query: string): boolean {
  const number = /^#?0*(\d+)$/.exec(query)
  if (number) {
    return species.dexNr === Number(number[1])
  }
  const translations = pokemonTranslations[species.key] as Record<string, string | null>
  return Object.values(translations).some((name) => name?.toLowerCase().includes(query))
}

export const ownedCount = (collection: Collection | undefined, cards: Card[]) =>
  cards.filter((c) => (collection?.get(c.internal_id)?.amount_owned ?? 0) > 0).length

const rarityIndex = (card: Card) => rarities.indexOf(card.rarity)

/** Art for a species or form tile: the most common owned printing, or the most common printing when none is owned. */
export function coverCard(cards: Card[], collection: Collection | undefined): Card {
  const owned = cards.filter((c) => (collection?.get(c.internal_id)?.amount_owned ?? 0) > 0)
  const pool = owned.length > 0 ? owned : cards
  return pool.reduce((best, c) => (rarityIndex(c) < rarityIndex(best) ? c : best))
}

// Evolution lines, from scripts/generate-evolutions.ts: dex number → the dex number it evolves from
const evolvesFrom = new Map(Object.entries(evolutions as Record<string, number>).map(([child, parent]) => [Number(child), parent]))
const evolvesInto = Map.groupBy(evolvesFrom.keys(), (child) => evolvesFrom.get(child) as number)

export interface EvolutionLine {
  root: number
  stages: number[][] // dex numbers by stage: [[Eevee], [Vaporeon, Jolteon, …]]; includes species with no cards in TCG Pocket
  species: Species[] // the members that are in TCG Pocket, in dex order
}

function rootOf(dexNr: number) {
  let nr = dexNr
  while (evolvesFrom.has(nr)) {
    nr = evolvesFrom.get(nr) as number
  }
  return nr
}

function buildLines(): Map<number, EvolutionLine> {
  const byRoot = new Map<number, EvolutionLine>()
  for (const species of allSpecies) {
    const root = rootOf(species.dexNr)
    const line = byRoot.get(root)
    if (line) {
      line.species.push(species)
      continue
    }
    const stages = [[root]]
    for (let next = evolvesInto.get(root) ?? []; next.length > 0; next = next.flatMap((nr) => evolvesInto.get(nr) ?? [])) {
      stages.push(next.toSorted((a, b) => a - b))
    }
    byRoot.set(root, { root, stages, species: [species] })
  }
  return byRoot
}

const linesByRoot = buildLines()

/** Evolution lines (2+ stages) with a species in TCG Pocket, ordered by their lowest dex number (so Pichu's line sits at Pikachu). */
export const allLines: EvolutionLine[] = [...linesByRoot.values()]
  .filter((line) => line.stages.length > 1)
  .sort((a, b) => a.species[0].dexNr - b.species[0].dexNr)

export const lineOf = (species: Species) => linesByRoot.get(rootOf(species.dexNr)) as EvolutionLine

// Pokédex entries, from scripts/generate-dex-entries.ts: one file per locale in public/pokedex, fetched by the species page only.
// g: category ("Seed Pokémon"), f: flavor text, h: height in decimetres, w: weight in hectograms (PokéAPI units)
export interface DexEntry {
  g: string
  f: string
  h: number
  w: number
}

export const dexEntriesQuery = (locale: string) =>
  queryOptions({
    queryKey: ['pokedex-entries', locale],
    queryFn: () => fetchJsonAsset<Record<string, DexEntry>>(`/pokedex/${locale}.json`),
    staleTime: Number.POSITIVE_INFINITY, // only changes on deploy
  })

const baseCardName = (name: string) => name.replace(/ ex$/, '')

// From each card's evolves_from (scraped from Limitless): card name → card name, so forms stay apart (Alolan Vulpix → Alolan Ninetales)
const formEvolvesFrom = new Map(allCards.flatMap((c) => (c.evolves_from ? [[baseCardName(c.name), c.evolves_from] as const] : [])))

export interface FormNode {
  name: string // card name without ` ex` (Alolan Vulpix, Mega Charizard X, Team Rocket's Rattata)
  species: Species
  cards: Card[]
  artworkId: number
}

export interface FormChain {
  from?: string // the plain card it evolves from, when that isn't a form itself (Charmeleon → Mega Charizard X)
  stage: number // 0 basic, 1 stage 1, 2 stage 2: where the chain starts, so it lines up under the species line
  stages: FormNode[][]
}

/**
 * A species' forms, the plain species first: those with artwork of their own (Alolan Vulpix, Mega Charizard X, Castform Rainy Form),
 * and Megas and regional forms PokéAPI has no artwork for (Mega Dragonite), which use the species'. Mega Charizard X ex counts as
 * Mega Charizard X; Charizard ex and Team Rocket's Raticate count as their plain species.
 */
export function speciesForms(species: Species): FormNode[] {
  const plain = capitalize(species.key)
  const formOf = (card: Card) => {
    const name = baseCardName(card.name)
    return formArtworkId(species, name) !== species.dexNr || name.startsWith('Mega ') || regionalPrefix.test(name) ? name : plain
  }
  // Mega Charizard X and Mega Charizard X ex have the same artwork, so they're grouped by artwork first
  const byForm = Map.groupBy(species.cards, (c) => {
    const form = formOf(c)
    const artworkId = formArtworkId(species, form)
    return artworkId === species.dexNr ? form : artworkId
  })
  return [...byForm.values()]
    .map((cards) => {
      const name = formOf(cards[0])
      return { name, species, cards, artworkId: formArtworkId(species, name) }
    })
    .sort((a, b) => Number(b.name === plain) - Number(a.name === plain))
}

/** Every species' forms, for the Pokédex's forms view. */
export const allForms: FormNode[] = allSpecies.flatMap(speciesForms)

/**
 * The line's forms as their own chains, since PokéAPI's evolution data is per species: Alolan Vulpix → Alolan Ninetales,
 * Team Rocket's Rattata → Team Rocket's Raticate, and Charmeleon → Mega Charizard X / Y (forms evolving from the same plain
 * card share a chain; basic forms each start their own).
 */
export function formChains(line: EvolutionLine): FormChain[] {
  const nodes = new Map<string, FormNode>()
  for (const species of line.species) {
    for (const card of species.cards) {
      const name = baseCardName(card.name)
      // the plain species card isn't a form (an ex counts as its plain card)
      if (name.toLowerCase() === species.key) {
        continue
      }
      const node = nodes.get(name) ?? { name, species, cards: [], artworkId: formArtworkId(species, name) }
      node.cards.push(card)
      nodes.set(name, node)
    }
  }
  const children = Map.groupBy(
    [...nodes.values()].filter((n) => nodes.has(formEvolvesFrom.get(n.name) ?? '')),
    (n) => formEvolvesFrom.get(n.name) as string,
  )
  const roots = Map.groupBy(
    [...nodes.values()].filter((n) => !nodes.has(formEvolvesFrom.get(n.name) ?? '')),
    (n) => formEvolvesFrom.get(n.name) ?? n.name,
  )
  return [...roots.values()].map((first) => {
    const stages = [first]
    for (let next = first.flatMap((n) => children.get(n.name) ?? []); next.length > 0; next = next.flatMap((n) => children.get(n.name) ?? [])) {
      stages.push(next)
    }
    const evolutionType = first[0].cards[0].evolution_type
    return { from: formEvolvesFrom.get(first[0].name), stage: evolutionType === 'stage2' ? 2 : evolutionType === 'stage1' ? 1 : 0, stages }
  })
}

// Where the species page's back link returns to: the Pokédex's filters (its query string) and scroll position
const returnKey = 'pokedex-return'
export interface Return {
  search: string
  y: number
}
// sessionStorage can throw (private mode, blocked storage); returning is a convenience
export const saveReturn = (r: Return) => {
  try {
    sessionStorage.setItem(returnKey, JSON.stringify(r))
  } catch {}
}
export const loadReturn = (): Return | undefined => {
  try {
    return JSON.parse(sessionStorage.getItem(returnKey) ?? 'null') ?? undefined
  } catch {
    return undefined
  }
}
