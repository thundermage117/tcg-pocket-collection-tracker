// Personal fork: the Pokédex's URL filters, parsed and applied here so the species page can step through the same list.
import { expansions } from '@/lib/CardsDB'
import {
  allForms,
  allSpecies,
  type Feature,
  type FormNode,
  featureOptions,
  featuresOf,
  generationOf,
  generations,
  ownedCount,
  type Species,
  type SpeciesGroup,
  type Stage,
  shinySpecies,
  speciesGroupOptions,
  speciesMatches,
  stageOptions,
  stagesOf,
  typesOf,
} from '@/lib/pokedex'
import { type Card, type CardType, type Collection, cardTypes, type ExpansionId } from '@/types'
import type { TileArt } from './SpeciesTile'

export const dexOptions = ['all', 'shiny'] as const
export const dexLabels = { all: 'Pokédex', shiny: '✵ Shiny' }

export const viewOptions = ['dex', 'forms', 'lines'] as const
export const viewLabels = { dex: 'Dex', forms: 'Forms', lines: 'Evolution lines' }

export const artOptions: TileArt[] = ['sprite', 'card']
export const artLabels: Record<TileArt, string> = { sprite: 'Sprites', card: 'Cards' }

export const showOptions = ['all', 'missing', 'owned', 'incomplete'] as const
type ShowOption = (typeof showOptions)[number]
export const showLabels: Record<ShowOption, string> = { all: 'All', missing: 'Missing', owned: 'Owned', incomplete: 'Incomplete' }

export const sortOptions = ['dex', 'printings', 'completion'] as const
type SortOption = (typeof sortOptions)[number]
export const sortLabels: Record<SortOption, string> = { dex: 'Dex number', printings: 'Most printings', completion: 'Closest to complete' }

export const groupOptions = ['all', ...speciesGroupOptions] as const
export const stageFilterOptions = ['all', ...stageOptions] as const
export const stageLabels: Record<Stage, string> = { basic: 'Basic', stage1: 'Stage 1', stage2: 'Stage 2' }
export const hasOptions = ['all', ...featureOptions] as const
export const hasLabels: Record<Feature, string> = { ex: 'An ex card', mega: 'A Mega form', regional: 'A regional form' }

export const genOptions = ['all', ...generations.map((g) => String(g.nr))]
export const typeOptions: ('all' | CardType)[] = ['all', ...cardTypes.filter((t) => t !== 'trainer' && allSpecies.some((s) => s.types.includes(t)))]
export const setOptions: ('all' | ExpansionId)[] = [
  'all',
  ...expansions.filter((e) => allSpecies.some((s) => s.cards.some((c) => c.expansion === e.id))).map((e) => e.id),
]

export type DexFilters = ReturnType<typeof parseDexFilters>

/** Defaults are left out of the URL; unknown values fall back to them. */
export function parseDexFilters(params: URLSearchParams) {
  const dex = dexOptions.find((x) => x === params.get('dex')) ?? 'all'
  const shiny = dex === 'shiny'
  return {
    dex,
    shiny,
    // lines are about catching every member, which doesn't carry over to shinies
    view: shiny ? 'dex' : (viewOptions.find((x) => x === params.get('view')) ?? 'dex'),
    search: params.get('q') ?? '',
    gen: genOptions.find((g) => g === params.get('gen')) ?? 'all',
    type: typeOptions.find((x) => x === params.get('type')) ?? 'all',
    show: showOptions.find((x) => x === params.get('show')) ?? 'all',
    set: setOptions.find((x) => x === params.get('set')) ?? 'all',
    group: groupOptions.find((x) => x === params.get('group')) ?? 'all',
    stage: stageFilterOptions.find((x) => x === params.get('stage')) ?? 'all',
    has: hasOptions.find((x) => x === params.get('has')) ?? 'all',
    sort: sortOptions.find((x) => x === params.get('sort')) ?? 'dex',
    art: artOptions.find((x) => x === params.get('art')) ?? 'sprite',
  }
}

/** What the filters look at, for a species or one of its forms (whose types, stages and features are its own cards'). */
interface Entry {
  dexNr: number
  cards: Card[]
  types: CardType[]
  stages: Stage[]
  features: Feature[]
  group?: SpeciesGroup
}

export interface DexForm extends Entry {
  form: FormNode
}

// in dex order, a species' forms keep the order speciesForms gives them (the plain species first)
const formEntries: DexForm[] = allForms.map((form) => ({
  form,
  dexNr: form.species.dexNr,
  cards: form.cards,
  types: typesOf(form.cards),
  stages: stagesOf(form.cards),
  features: featuresOf(form.cards),
  group: form.species.group,
}))

/** The mode's species, which of them match the filters, and the sort order; in the forms view, the matching forms too. */
export function dexMatcher(f: DexFilters, collection: Collection | undefined) {
  const list = f.shiny ? shinySpecies : allSpecies
  const owned = new Map(list.map((s) => [s.dexNr, ownedCount(collection, s.cards)]))
  const ownedOf = (s: Species) => owned.get(s.dexNr) as number
  const query = f.search.trim().toLowerCase()
  const entryMatches = (e: Entry, n: number) =>
    (f.gen === 'all' || generationOf(e.dexNr).nr === Number(f.gen)) &&
    (f.type === 'all' || e.types.includes(f.type)) &&
    (f.set === 'all' || e.cards.some((c) => c.expansion === f.set)) &&
    (f.group === 'all' || e.group === f.group) &&
    (f.stage === 'all' || e.stages.includes(f.stage)) &&
    (f.has === 'all' || e.features.includes(f.has)) &&
    (f.show === 'all' || (f.show === 'missing' ? n === 0 : f.show === 'owned' ? n > 0 : n > 0 && n < e.cards.length))
  const matches = (s: Species) => entryMatches(s, ownedOf(s)) && (!query || speciesMatches(s, query))
  const sorter = (ownedIn: (e: Entry) => number) => {
    const share = (e: Entry) => ownedIn(e) / e.cards.length
    const sorters: Record<SortOption, (a: Entry, b: Entry) => number> = {
      dex: (a, b) => a.dexNr - b.dexNr,
      printings: (a, b) => b.cards.length - a.cards.length || a.dexNr - b.dexNr,
      // complete species go last: there's nothing left to chase
      completion: (a, b) => Number(share(a) === 1) - Number(share(b) === 1) || share(b) - share(a) || a.dexNr - b.dexNr,
    }
    // the lines view has no sort: it's in dex order
    return f.view === 'lines' ? sorters.dex : sorters[f.sort]
  }
  const filtered = list.filter(matches).sort(sorter((e) => ownedOf(e as Species)))

  // each form is filtered on its own (a missing Alolan Vulpix shows under Missing though Vulpix is owned); a search also finds
  // a form by its card name (alolan, mega)
  const formOwned = new Map<DexForm, number>()
  const formOwnedOf = (e: DexForm) => formOwned.get(e) as number
  const forms =
    f.view === 'forms'
      ? formEntries
          .filter((e) => {
            formOwned.set(e, ownedCount(collection, e.cards))
            return entryMatches(e, formOwnedOf(e)) && (!query || speciesMatches(e.form.species, query) || e.form.name.toLowerCase().includes(query))
          })
          .sort(sorter((e) => formOwnedOf(e as DexForm)))
      : []
  return { list, ownedOf, matches, filtered, forms }
}
