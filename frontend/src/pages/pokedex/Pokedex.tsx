// Personal fork: one tile per species in National Dex order, owned when any printing (any form) is owned.
// Filters live in the URL (?view=lines&q=…&gen=1&type=fire&show=missing&set=A1&sort=printings), so links, refresh and back keep the view.
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { DropdownFilter, TabsFilter } from '@/components/Filters'
import SearchInput from '@/components/filters/SearchInput'
import { Spinner } from '@/components/Spinner'
import { expansions, getExpansionById } from '@/lib/CardsDB'
import { allLines, allSpecies, generationOf, generations, ownedCount, type Species, speciesMatches, speciesName } from '@/lib/pokedex'
import { capitalize, cn } from '@/lib/utils'
import { useCollection } from '@/services/collection/useCollection'
import { type CardType, cardTypes, type ExpansionId } from '@/types'
import { EvolutionChain } from './EvolutionChain'
import { ProgressBar, SpeciesTile, type TileArt } from './SpeciesTile'

const viewOptions = ['dex', 'lines'] as const
const viewLabels = { dex: 'Dex', lines: 'Evolution lines' }

const artOptions: TileArt[] = ['sprite', 'card']
const artLabels: Record<TileArt, string> = { sprite: 'Sprites', card: 'Cards' }

const showOptions = ['all', 'missing', 'owned', 'incomplete'] as const
type ShowOption = (typeof showOptions)[number]
const showLabels: Record<ShowOption, string> = { all: 'All', missing: 'Missing', owned: 'Owned', incomplete: 'Incomplete' }

const sortOptions = ['dex', 'printings', 'completion'] as const
type SortOption = (typeof sortOptions)[number]
const sortLabels: Record<SortOption, string> = { dex: 'Dex number', printings: 'Most printings', completion: 'Closest to complete' }

const genOptions = ['all', ...generations.map((g) => String(g.nr))]
const typeOptions: ('all' | CardType)[] = ['all', ...cardTypes.filter((t) => t !== 'trainer' && allSpecies.some((s) => s.types.includes(t)))]
const setOptions: ('all' | ExpansionId)[] = [
  'all',
  ...expansions.filter((e) => allSpecies.some((s) => s.cards.some((c) => c.expansion === e.id))).map((e) => e.id),
]

export default function Pokedex() {
  const { t, i18n } = useTranslation('common/sets')
  const { data: collection, isLoading } = useCollection()
  const [params, setParams] = useSearchParams()

  // defaults are left out of the URL; unknown values fall back to them
  const view = viewOptions.find((x) => x === params.get('view')) ?? 'dex'
  const search = params.get('q') ?? ''
  const gen = genOptions.find((g) => g === params.get('gen')) ?? 'all'
  const type = typeOptions.find((x) => x === params.get('type')) ?? 'all'
  const show = showOptions.find((x) => x === params.get('show')) ?? 'all'
  const set = setOptions.find((x) => x === params.get('set')) ?? 'all'
  const sort = sortOptions.find((x) => x === params.get('sort')) ?? 'dex'
  const art = artOptions.find((x) => x === params.get('art')) ?? 'sprite'
  const filtering = search !== '' || gen !== 'all' || type !== 'all' || show !== 'all' || set !== 'all'

  const update = (changes: Record<string, string | undefined>) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(changes)) {
          if (
            value &&
            value !== 'all' &&
            !(key === 'view' && value === 'dex') &&
            !(key === 'sort' && value === 'dex') &&
            !(key === 'art' && value === 'sprite')
          ) {
            next.set(key, value)
          } else {
            next.delete(key)
          }
        }
        return next
      },
      { replace: true },
    )
  }

  if (isLoading) {
    return <Spinner size="lg" overlay />
  }

  const owned = new Map(allSpecies.map((s) => [s.dexNr, ownedCount(collection, s.cards)]))
  const ownedOf = (s: Species) => owned.get(s.dexNr) as number
  const query = search.trim().toLowerCase()
  const matches = (s: Species) => {
    const n = ownedOf(s)
    return (
      (gen === 'all' || generationOf(s.dexNr).nr === Number(gen)) &&
      (type === 'all' || s.types.includes(type)) &&
      (set === 'all' || s.cards.some((c) => c.expansion === set)) &&
      (show === 'all' || (show === 'missing' ? n === 0 : show === 'owned' ? n > 0 : n > 0 && n < s.cards.length)) &&
      (!query || speciesMatches(s, query))
    )
  }

  const share = (s: Species) => ownedOf(s) / s.cards.length
  const sorters: Record<SortOption, (a: Species, b: Species) => number> = {
    dex: (a, b) => a.dexNr - b.dexNr,
    printings: (a, b) => b.cards.length - a.cards.length || a.dexNr - b.dexNr,
    // complete species go last: there's nothing left to chase
    completion: (a, b) => Number(share(a) === 1) - Number(share(b) === 1) || share(b) - share(a) || a.dexNr - b.dexNr,
  }
  const filtered = allSpecies.filter(matches).sort(sorters[sort])
  // a line shows when any member matches, and then shows whole
  const lines = allLines.filter((line) => line.species.some(matches))

  const speciesOwned = allSpecies.filter((s) => ownedOf(s) > 0).length
  const linesComplete = allLines.filter((line) => line.species.every((s) => ownedOf(s) > 0)).length

  return (
    <main className="mx-auto max-w-7xl px-4 pb-12">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold sm:text-3xl">Pokédex</h1>
        <p className="mt-1 text-sm text-neutral-400">Every species in TCG Pocket. A species counts as owned with any card of it, in any form.</p>
      </header>

      <section className="mb-6 rounded-lg border-1 border-neutral-700 border-solid bg-neutral-800 p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="font-bold text-lg">Species owned</h2>
          <p className="flex items-baseline gap-4 tabular-nums">
            <span className="text-sm text-neutral-400">
              {linesComplete}/{allLines.length} lines complete
            </span>
            <span>
              <span className="font-bold text-2xl">{speciesOwned}</span>
              <span className="text-neutral-400"> / {allSpecies.length}</span>
            </span>
          </p>
        </div>
        <ProgressBar value={speciesOwned} max={allSpecies.length} className="mb-4 h-2" />
        <ul className="grid grid-cols-3 gap-x-4 gap-y-2 sm:grid-cols-5 lg:grid-cols-9">
          {generations.map((g) => {
            const inGen = allSpecies.filter((s) => generationOf(s.dexNr).nr === g.nr)
            const ownedInGen = inGen.filter((s) => ownedOf(s) > 0).length
            const active = gen === String(g.nr)
            return (
              <li key={g.nr}>
                <button
                  type="button"
                  onClick={() => update({ gen: active ? undefined : String(g.nr) })}
                  className={cn('w-full cursor-pointer rounded px-1 py-0.5 text-left transition-colors hover:bg-neutral-700', active && 'bg-neutral-700')}
                >
                  <span className="flex justify-between text-xs">
                    <span className="text-neutral-300">Gen {g.nr}</span>
                    <span className="text-neutral-400 tabular-nums">
                      {ownedInGen}/{inGen.length}
                    </span>
                  </span>
                  <ProgressBar value={ownedInGen} max={inGen.length} className="mt-1 h-1.5" />
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <SearchInput value={search} setValue={(q) => update({ q: q.trim() || undefined })} className="sm:flex-1" />
          <DropdownFilter
            label="Set"
            options={setOptions}
            value={set}
            onChange={(id) => update({ set: id })}
            show={(id) => (id === 'all' ? 'All sets' : `${id} · ${t(getExpansionById(id).name)}`)}
            className="sm:w-64"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <TabsFilter options={viewOptions} value={view} onChange={(x) => update({ view: x })} show={(x) => viewLabels[x]} />
          <TabsFilter options={artOptions} value={art} onChange={(x) => update({ art: x })} show={(x) => artLabels[x]} />
          <TabsFilter options={showOptions} value={show} onChange={(x) => update({ show: x })} show={(x) => showLabels[x]} />
          <DropdownFilter
            label="Generation"
            options={genOptions}
            value={gen}
            onChange={(g) => update({ gen: g })}
            show={(g) => (g === 'all' ? 'All' : `Gen ${g}`)}
          />
          <DropdownFilter
            label="Type"
            options={typeOptions}
            value={type}
            onChange={(x) => update({ type: x })}
            show={(x) => (x === 'all' ? 'All' : capitalize(x))}
          />
          {view === 'dex' && (
            <DropdownFilter label="Sort" options={sortOptions} value={sort} onChange={(x) => update({ sort: x })} show={(x) => sortLabels[x]} />
          )}
        </div>
      </div>

      {(view === 'dex' ? filtered : lines).length === 0 ? (
        <p className="py-12 text-center text-neutral-400">No species match these filters.</p>
      ) : (
        <>
          <p className="mb-3 flex gap-3 text-sm text-neutral-400">
            {view === 'dex' ? `${filtered.length} species` : `${lines.length} evolution lines`}
            {filtering && (
              <Link to={view === 'dex' ? '/pokedex' : '/pokedex?view=lines'} className="underline hover:text-white">
                Clear filters
              </Link>
            )}
          </p>
          {view === 'dex' ? (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
              {filtered.map((s) => (
                <li key={s.dexNr}>
                  <SpeciesTile species={s} collection={collection} lang={i18n.language} art={art} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {lines.map((line) => {
                const ownedInLine = line.species.filter((s) => ownedOf(s) > 0).length
                return (
                  <li key={line.root} className="rounded-lg border-1 border-neutral-700 border-solid bg-neutral-800/40 p-3">
                    <h2 className="mb-2 flex items-baseline justify-between gap-3">
                      <span className="font-semibold">{speciesName(line.species[0], i18n.language)} line</span>
                      <span className={cn('text-sm tabular-nums', ownedInLine === line.species.length ? 'text-green-500' : 'text-neutral-400')}>
                        {ownedInLine}/{line.species.length} species
                      </span>
                    </h2>
                    <div className="overflow-x-auto">
                      <EvolutionChain line={line} collection={collection} lang={i18n.language} art={art} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </main>
  )
}
