// Personal fork: one tile per species in National Dex order, owned when any printing (any form) is owned.
// Filters live in the URL (?q=…&gen=1&type=fire&show=missing&set=A1), so links, refresh and back keep the view.
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { DropdownFilter, TabsFilter } from '@/components/Filters'
import SearchInput from '@/components/filters/SearchInput'
import { Spinner } from '@/components/Spinner'
import { expansions, getExpansionById } from '@/lib/CardsDB'
import { getLocalizedImagePath } from '@/lib/imageLocales'
import { allSpecies, coverCard, generationOf, generations, ownedCount, type Species, speciesMatches, speciesName } from '@/lib/pokedex'
import { capitalize, cn } from '@/lib/utils'
import { useCollection } from '@/services/collection/useCollection'
import { type CardType, type Collection, cardTypes, type ExpansionId } from '@/types'

const showOptions = ['all', 'missing', 'owned', 'incomplete'] as const
type ShowOption = (typeof showOptions)[number]
const showLabels: Record<ShowOption, string> = { all: 'All', missing: 'Missing', owned: 'Owned', incomplete: 'Incomplete' }

const genOptions = ['all', ...generations.map((g) => String(g.nr))]
const typeOptions: ('all' | CardType)[] = ['all', ...cardTypes.filter((t) => t !== 'trainer' && allSpecies.some((s) => s.types.includes(t)))]
const setOptions: ('all' | ExpansionId)[] = [
  'all',
  ...expansions.filter((e) => allSpecies.some((s) => s.cards.some((c) => c.expansion === e.id))).map((e) => e.id),
]

export const dexLabel = (dexNr: number) => `#${String(dexNr).padStart(4, '0')}`

export default function Pokedex() {
  const { t, i18n } = useTranslation('common/sets')
  const { data: collection, isLoading } = useCollection()
  const [params, setParams] = useSearchParams()

  // defaults are left out of the URL; unknown values fall back to them
  const search = params.get('q') ?? ''
  const gen = genOptions.find((g) => g === params.get('gen')) ?? 'all'
  const type = typeOptions.find((x) => x === params.get('type')) ?? 'all'
  const show = showOptions.find((x) => x === params.get('show')) ?? 'all'
  const set = setOptions.find((x) => x === params.get('set')) ?? 'all'

  const update = (changes: Record<string, string | undefined>) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(changes)) {
          if (value && value !== 'all') {
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
  const query = search.trim().toLowerCase()
  const filtered = allSpecies.filter((s) => {
    const n = owned.get(s.dexNr) as number
    return (
      (gen === 'all' || generationOf(s.dexNr).nr === Number(gen)) &&
      (type === 'all' || s.types.includes(type)) &&
      (set === 'all' || s.cards.some((c) => c.expansion === set)) &&
      (show === 'all' || (show === 'missing' ? n === 0 : show === 'owned' ? n > 0 : n > 0 && n < s.cards.length)) &&
      (!query || speciesMatches(s, query))
    )
  })

  const speciesOwned = allSpecies.filter((s) => (owned.get(s.dexNr) as number) > 0).length

  return (
    <main className="mx-auto max-w-7xl px-4 pb-12">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold sm:text-3xl">Pokédex</h1>
        <p className="mt-1 text-sm text-neutral-400">Every species in TCG Pocket. A species counts as owned with any card of it, in any form.</p>
      </header>

      <section className="mb-6 rounded-lg border-1 border-neutral-700 border-solid bg-neutral-800 p-4">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="font-bold text-lg">Species owned</h2>
          <p className="tabular-nums">
            <span className="font-bold text-2xl">{speciesOwned}</span>
            <span className="text-neutral-400"> / {allSpecies.length}</span>
          </p>
        </div>
        <ProgressBar value={speciesOwned} max={allSpecies.length} className="mb-4 h-2" />
        <ul className="grid grid-cols-3 gap-x-4 gap-y-2 sm:grid-cols-5 lg:grid-cols-9">
          {generations.map((g) => {
            const inGen = allSpecies.filter((s) => generationOf(s.dexNr).nr === g.nr)
            const ownedInGen = inGen.filter((s) => (owned.get(s.dexNr) as number) > 0).length
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
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-neutral-400">No species match these filters.</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-neutral-400">{filtered.length} species</p>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
            {filtered.map((s) => (
              <li key={s.dexNr}>
                <SpeciesTile species={s} collection={collection} owned={owned.get(s.dexNr) as number} lang={i18n.language} />
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  )
}

export function ProgressBar({ value, max, className }: { value: number; max: number; className?: string }) {
  return (
    <span className={cn('block overflow-hidden rounded-full bg-neutral-700', className)}>
      <span className="block h-full rounded-full bg-blue-300" style={{ width: `${max === 0 ? 0 : (100 * value) / max}%` }} />
    </span>
  )
}

function SpeciesTile({ species, collection, owned, lang }: { species: Species; collection: Collection | undefined; owned: number; lang: string }) {
  const card = coverCard(species, collection)
  const name = speciesName(species, lang)
  const complete = owned === species.cards.length
  return (
    <Link
      to={`/pokedex/${species.dexNr}`}
      title={name}
      className={cn(
        'block rounded-md border-1 border-solid bg-neutral-800 p-1.5 transition-colors hover:border-neutral-400',
        complete ? 'border-green-600' : 'border-neutral-700',
      )}
    >
      <img
        src={getLocalizedImagePath(card, lang)}
        alt={name}
        loading="lazy"
        className={cn('aspect-[367/512] w-full rounded object-cover', owned === 0 && 'opacity-30 grayscale')}
      />
      <div className="mt-1.5 flex items-baseline justify-between gap-1 text-[11px] tabular-nums">
        <span className="text-neutral-500">{dexLabel(species.dexNr)}</span>
        <span className={cn(complete ? 'text-green-500' : owned > 0 ? 'text-neutral-300' : 'text-neutral-500')}>
          {owned}/{species.cards.length}
        </span>
      </div>
      <p className={cn('truncate text-sm', owned === 0 && 'text-neutral-500')}>{name}</p>
    </Link>
  )
}
