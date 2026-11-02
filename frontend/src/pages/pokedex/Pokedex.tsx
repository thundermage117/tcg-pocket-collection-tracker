// Personal fork: one tile per species in National Dex order, owned when any printing (any form) is owned.
// The forms view gives each form with artwork of its own (Alolan Vulpix, Mega Charizard X) a tile of its own, next to its species'.
// Filters live in the URL (?dex=shiny&view=forms&art=card&q=…&gen=1&group=legendary&stage=stage2&has=mega&type=fire&show=missing&set=A1&sort=printings), so links, refresh and back keep the view.
import { Check, ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigationType, useSearchParams } from 'react-router'
import { DropdownFilter, TabsFilter } from '@/components/Filters'
import SearchInput from '@/components/filters/SearchInput'
import { Spinner } from '@/components/Spinner'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { getExpansionById } from '@/lib/CardsDB'
import {
  allForms,
  allLines,
  type Generation,
  generationOf,
  generations,
  loadReturn,
  ownedCount,
  type SpeciesGroup,
  saveReturn,
  speciesGroupOptions,
  speciesName,
} from '@/lib/pokedex'
import { capitalize, cn } from '@/lib/utils'
import { useCollection } from '@/services/collection/useCollection'
import {
  artLabels,
  artOptions,
  dexLabels,
  dexMatcher,
  dexOptions,
  genOptions,
  groupOptions,
  hasLabels,
  hasOptions,
  parseDexFilters,
  setOptions,
  showLabels,
  showOptions,
  sortLabels,
  sortOptions,
  stageFilterOptions,
  stageLabels,
  typeOptions,
  viewLabels,
  viewOptions,
} from './dexFilters'
import { EvolutionChain } from './EvolutionChain'
import { FormTile, GroupIcon, groupLabels, ProgressBar, SpeciesTile, typeColors, typeGlow } from './SpeciesTile'

export default function Pokedex() {
  const { t, i18n } = useTranslation('common/sets')
  const { data: collection, isLoading } = useCollection()
  const [params, setParams] = useSearchParams()

  const filters = parseDexFilters(params)
  const { dex, shiny, view, search, gen, type, show, set, group, stage, has, sort, art } = filters
  const sheetFiltering = gen !== 'all' || type !== 'all' || set !== 'all' || group !== 'all' || stage !== 'all' || has !== 'all'
  const filtering = search !== '' || show !== 'all' || sheetFiltering
  const sheetFilterCount = [gen, type, set, group, stage, has].filter((x) => x !== 'all').length
  const [sheetOpen, setSheetOpen] = useState(false)
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  // clearing keeps the mode, view and tile art: those aren't filters
  const clearUrl = `/pokedex?${new URLSearchParams([...(shiny ? [['dex', 'shiny']] : []), ...(view !== 'dex' ? [['view', view]] : []), ...(art === 'card' ? [['art', 'card']] : [])])}`

  // the species page links back with these filters; coming back (that link or browser back) restores the scroll position
  const location = useLocation()
  const returning = useNavigationType() === 'POP' || location.state?.returning === true
  // saved now, not only on leaving: the species page renders before this unmounts. A layout cleanup, so the scroll
  // position is read before the species page's layout effect scrolls to the top
  useLayoutEffect(() => {
    const search = location.search
    if (loadReturn()?.search !== search) {
      saveReturn({ search, y: 0 })
    }
    return () => saveReturn({ search, y: window.scrollY })
  }, [location.search])
  const restored = useRef(false)
  useLayoutEffect(() => {
    if (isLoading || restored.current) {
      return
    }
    restored.current = true
    const saved = loadReturn()
    if (returning && saved && saved.search === location.search) {
      window.scrollTo(0, saved.y)
    }
  }, [isLoading, returning, location.search])

  // the generation chip for the section under the sticky bar lights up, and jumping lands a section just below it
  const barRef = useRef<HTMLDivElement>(null)
  const genNavRef = useRef<HTMLElement>(null)
  const [currentGen, setCurrentGen] = useState<number>()
  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const barBottom = barRef.current?.getBoundingClientRect().bottom ?? 0
        const headers = [...document.querySelectorAll<HTMLElement>('[data-gen]')]
        const current = headers.findLast((h) => h.getBoundingClientRect().top <= barBottom + 24) ?? headers[0]
        setCurrentGen(current ? Number(current.dataset.gen) : undefined)
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [isLoading, location.search])
  // keep the current chip in view on phones; scrolling only the chip row, so a smooth page scroll isn't interrupted
  useEffect(() => {
    const nav = genNavRef.current
    const chip = nav?.querySelector<HTMLElement>(`[data-gen-chip="${currentGen}"]`)
    if (nav && chip) {
      nav.scrollTo({ left: chip.offsetLeft - nav.clientWidth / 2 + chip.offsetWidth / 2, behavior: 'smooth' })
    }
  }, [currentGen])
  const jumpTo = (nr: number) => {
    const header = document.querySelector(`[data-gen="${nr}"]`)
    if (header) {
      const barHeight = barRef.current?.offsetHeight ?? 0
      window.scrollTo({ top: header.getBoundingClientRect().top + window.scrollY - barHeight - 8, behavior: 'smooth' })
    }
  }

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

  const { list, ownedOf, matches, filtered, forms } = dexMatcher(filters, collection)
  // the grid's tiles: species, or in the forms view each form
  const tiles: { dexNr: number }[] = view === 'forms' ? forms : filtered
  // in dex order the grid splits by generation, so ~1000 tiles have landmarks; other sorts stay one list
  const sections = (
    view !== 'lines' && sort === 'dex' ? generations.map((g) => ({ g, tiles: tiles.filter((x) => generationOf(x.dexNr) === g) })) : [{ g: undefined, tiles }]
  ).filter((section) => section.tiles.length > 0)
  // a line shows when any member matches, and then shows whole
  const lines = allLines.filter((line) => line.species.some(matches))

  const speciesOwned = list.filter((s) => ownedOf(s) > 0).length
  const genCaught = (g: Generation) => {
    if (view === 'forms') {
      const inGen = allForms.filter((form) => generationOf(form.species.dexNr) === g)
      return `${inGen.filter((form) => ownedCount(collection, form.cards) > 0).length}/${inGen.length} forms caught`
    }
    const inGen = list.filter((s) => generationOf(s.dexNr) === g)
    return `${inGen.filter((s) => ownedOf(s) > 0).length}/${inGen.length} caught`
  }
  const formsCaught = allForms.filter((form) => ownedCount(collection, form.cards) > 0).length
  const linesComplete = allLines.filter((line) => line.species.every((s) => ownedOf(s) > 0)).length

  return (
    <main className="mx-auto max-w-7xl px-4 pb-12">
      <header className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold sm:text-3xl">{shiny ? 'Shiny Pokédex' : 'Pokédex'}</h1>
          <TabsFilter options={dexOptions} value={dex} onChange={(x) => update({ dex: x })} show={(x) => dexLabels[x]} />
        </div>
        <p className="mt-1 text-sm text-neutral-400">
          {shiny
            ? 'Every species with a shiny (✵ or ✵✵) card. It counts as owned with any of its shiny cards.'
            : 'Every species in TCG Pocket. A species counts as owned with any card of it, in any form.'}
        </p>
      </header>

      <section className="mb-6 rounded-xl border-1 border-neutral-700 border-solid bg-gradient-to-br from-neutral-800 to-neutral-900 p-4 sm:p-5">
        <div className="flex items-center gap-4 sm:gap-5">
          <Ring value={speciesOwned} max={list.length} className="size-20 shrink-0 sm:size-24" />
          <div className="min-w-0">
            <h2 className="font-medium text-neutral-400 text-xs uppercase tracking-wider">{shiny ? 'Shiny species owned' : 'Species owned'}</h2>
            <p className="tabular-nums leading-tight">
              <span className="font-bold text-3xl sm:text-4xl">{speciesOwned}</span>
              <span className="text-lg text-neutral-500"> / {list.length}</span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 tabular-nums">
              {/* legendary / mythical / starters caught, each a shortcut to its filter */}
              {speciesGroupOptions.map((g) => {
                const inGroup = list.filter((s) => s.group === g)
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => update({ group: group === g ? undefined : g })}
                    title={groupLabels[g]}
                    className={cn(pill, groupPills[g], group === g && 'ring-1 ring-current')}
                  >
                    <GroupIcon group={g} />
                    {inGroup.filter((s) => ownedOf(s) > 0).length}/{inGroup.length}
                  </button>
                )
              })}
              {!shiny && (
                <>
                  {/* a shortcut to the forms view */}
                  <button
                    type="button"
                    onClick={() => update({ view: view === 'forms' ? undefined : 'forms' })}
                    className={cn(pill, 'border-neutral-600 bg-neutral-700/40 text-neutral-300 hover:text-white', view === 'forms' && 'ring-1 ring-current')}
                  >
                    {formsCaught}/{allForms.length} forms
                  </button>
                  <span className={cn(pill, 'cursor-default border-neutral-600 bg-neutral-700/40 text-neutral-300')}>
                    {linesComplete}/{allLines.length} lines complete
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        {/* on phones the generation and type bars fold away, so the grid starts on the first screen */}
        <button
          type="button"
          onClick={() => setBreakdownOpen(!breakdownOpen)}
          aria-expanded={breakdownOpen}
          className="mt-4 flex w-full cursor-pointer items-center justify-center gap-1 border-neutral-700 border-t pt-3 text-sm text-neutral-400 hover:text-white sm:hidden"
        >
          By generation and type
          <ChevronDown className={cn('size-4 transition-transform', breakdownOpen && 'rotate-180')} />
        </button>
        <div className={cn(breakdownOpen ? 'mt-3 block' : 'hidden', 'sm:mt-5 sm:block')}>
          <h3 className={blockLabel}>Generations</h3>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
            {generations.map((g) => {
              const inGen = list.filter((s) => generationOf(s.dexNr).nr === g.nr)
              const ownedInGen = inGen.filter((s) => ownedOf(s) > 0).length
              const done = inGen.length > 0 && ownedInGen === inGen.length
              const active = gen === String(g.nr)
              return (
                <li key={g.nr}>
                  <button
                    type="button"
                    onClick={() => update({ gen: active ? undefined : String(g.nr) })}
                    title={`Gen ${g.nr} · ${g.region}`}
                    className={cn(cell, done && 'border-amber-300/40 bg-amber-300/5', active && 'border-blue-300 ring-1 ring-blue-300')}
                  >
                    <span className="flex items-center gap-1.5 text-xs">
                      <span className={cn('rounded-full px-1.5 font-bold', done ? 'bg-amber-300 text-neutral-900' : 'bg-neutral-700 text-neutral-200')}>
                        {g.nr}
                      </span>
                      <span className="truncate text-neutral-300">{g.region}</span>
                    </span>
                    <Fraction value={ownedInGen} max={inGen.length} done={done} />
                    <ProgressBar value={ownedInGen} max={inGen.length} color={done ? doneColor : undefined} className="h-1" />
                  </button>
                </li>
              )
            })}
          </ul>
          {/* a dual-type species counts under both types */}
          <h3 className={cn(blockLabel, 'mt-4')}>Types</h3>
          <ul className="grid grid-cols-5 gap-2 lg:grid-cols-10">
            {typeOptions
              .filter((x) => x !== 'all')
              .map((x) => {
                const ofType = list.filter((s) => s.types.includes(x))
                const ownedOfType = ofType.filter((s) => ownedOf(s) > 0).length
                const done = ofType.length > 0 && ownedOfType === ofType.length
                const active = type === x
                return (
                  <li key={x}>
                    <button
                      type="button"
                      onClick={() => update({ type: active ? undefined : x })}
                      title={capitalize(x)}
                      className={cn(cell, done && 'border-amber-300/40', active && 'border-blue-300 ring-1 ring-blue-300')}
                      style={{ backgroundImage: typeGlow([x], '26') }}
                    >
                      <img src={`/images/energy/${x}.webp`} alt={x} className="size-5" />
                      <Fraction value={ownedOfType} max={ofType.length} done={done} />
                      <ProgressBar value={ownedOfType} max={ofType.length} color={done ? doneColor : typeColors[x]} className="h-1" />
                    </button>
                  </li>
                )
              })}
          </ul>
        </div>
      </section>

      {/* search, filters and the generation jump stay on screen through ~1000 tiles */}
      <div ref={barRef} className="sticky top-0 z-20 -mx-4 mb-3 flex flex-col gap-2 bg-[#181818]/90 px-4 py-2 backdrop-blur">
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <SearchInput value={search} setValue={(q) => update({ q: q.trim() || undefined })} className="sm:flex-1" />
          <div className="flex items-center gap-3">
            <TabsFilter options={showOptions} value={show} onChange={(x) => update({ show: x })} show={(x) => showLabels[x]} className="whitespace-nowrap" />
            <Button variant="outline" onClick={() => setSheetOpen(true)} className="h-[38px] shrink-0 border-neutral-700 bg-neutral-800">
              <SlidersHorizontal />
              <span className="hidden sm:inline">Filters</span>
              {sheetFilterCount > 0 && (
                <span className="flex size-5 items-center justify-center rounded-full bg-blue-300 font-semibold text-neutral-900 text-xs tabular-nums">
                  {sheetFilterCount}
                </span>
              )}
            </Button>
          </div>
        </div>
        {sections.length > 1 && sections[0].g && (
          <nav ref={genNavRef} aria-label="Jump to generation" className="-mx-4 flex gap-1.5 overflow-x-auto px-4">
            {sections.map(({ g, tiles }) =>
              g ? (
                <button
                  key={g.nr}
                  type="button"
                  data-gen-chip={g.nr}
                  onClick={() => jumpTo(g.nr)}
                  title={`${genLabel(g)} · ${tiles.length} shown`}
                  className={cn(
                    'flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-900 py-0.5 pr-2.5 pl-0.5 text-xs text-neutral-400 transition-colors hover:border-neutral-500',
                    currentGen === g.nr && 'border-blue-300 text-white',
                  )}
                >
                  <span className={cn('rounded-full bg-neutral-700 px-1.5 font-bold text-neutral-200', currentGen === g.nr && 'bg-blue-300 text-neutral-900')}>
                    {g.nr}
                  </span>
                  {g.region}
                </button>
              ) : null,
            )}
          </nav>
        )}
      </div>

      {/* what the sheet and the generation bars have set, each removable on its own */}
      {sheetFiltering && (
        <div className="mb-3 flex flex-wrap gap-2">
          {gen !== 'all' && <Chip onRemove={() => update({ gen: undefined })}>{genLabel(generations[Number(gen) - 1])}</Chip>}
          {type !== 'all' && <Chip onRemove={() => update({ type: undefined })}>{capitalize(type)}</Chip>}
          {group !== 'all' && <Chip onRemove={() => update({ group: undefined })}>{groupLabels[group]}</Chip>}
          {stage !== 'all' && <Chip onRemove={() => update({ stage: undefined })}>{stageLabels[stage]}</Chip>}
          {has !== 'all' && (
            <Chip onRemove={() => update({ has: undefined })}>{`Has ${hasLabels[has].charAt(0).toLowerCase()}${hasLabels[has].slice(1)}`}</Chip>
          )}
          {set !== 'all' && <Chip onRemove={() => update({ set: undefined })}>{`${set} · ${t(getExpansionById(set).name)}`}</Chip>}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto border-neutral-800 sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-5 px-4 pb-6">
            {!shiny && <TabsFilter label="View" options={viewOptions} value={view} onChange={(x) => update({ view: x })} show={(x) => viewLabels[x]} />}
            {view !== 'lines' && (
              <DropdownFilter label="Sort" options={sortOptions} value={sort} onChange={(x) => update({ sort: x })} show={(x) => sortLabels[x]} />
            )}
            <DropdownFilter
              label="Generation"
              options={genOptions}
              value={gen}
              onChange={(g) => update({ gen: g })}
              show={(g) => (g === 'all' ? 'All' : genLabel(generations[Number(g) - 1]))}
            />
            <DropdownFilter
              label="Group"
              options={groupOptions}
              value={group}
              onChange={(x) => update({ group: x })}
              show={(x) => (x === 'all' ? 'All' : groupLabels[x])}
            />
            <DropdownFilter
              label="Stage"
              options={stageFilterOptions}
              value={stage}
              onChange={(x) => update({ stage: x })}
              show={(x) => (x === 'all' ? 'All' : stageLabels[x])}
            />
            <DropdownFilter
              label="Has"
              options={hasOptions}
              value={has}
              onChange={(x) => update({ has: x })}
              show={(x) => (x === 'all' ? 'Anything' : hasLabels[x])}
            />
            <DropdownFilter
              label="Type"
              options={typeOptions}
              value={type}
              onChange={(x) => update({ type: x })}
              show={(x) => (x === 'all' ? 'All' : capitalize(x))}
            />
            <DropdownFilter
              label="Set"
              options={setOptions}
              value={set}
              onChange={(id) => update({ set: id })}
              show={(id) => (id === 'all' ? 'All sets' : `${id} · ${t(getExpansionById(id).name)}`)}
            />
            {sheetFiltering && (
              <Button
                variant="outline"
                onClick={() => update({ gen: undefined, type: undefined, set: undefined, group: undefined, stage: undefined, has: undefined })}
                className="border-neutral-700"
              >
                Reset filters
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {(view === 'lines' ? lines : tiles).length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-neutral-400">
          No {view === 'forms' ? 'forms' : 'species'} match these filters.
          <Link to={clearUrl} className="rounded-md border-1 border-neutral-700 border-solid px-3 py-1.5 text-sm text-white hover:border-neutral-500">
            Clear filters
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-3 text-sm text-neutral-400">
            {view === 'dex' ? `${filtered.length} species` : view === 'forms' ? `${forms.length} forms` : `${lines.length} evolution lines`}
            {filtering && (
              <Link to={clearUrl} className="underline hover:text-white">
                Clear filters
              </Link>
            )}
            <TabsFilter options={artOptions} value={art} onChange={(x) => update({ art: x })} show={(x) => artLabels[x]} className="ml-auto" />
          </div>
          {view !== 'lines' ? (
            sections.map(({ g, tiles }) => (
              <Fragment key={g?.nr ?? 'all'}>
                {g && (
                  <h2 data-gen={g.nr} className="mb-3 flex items-baseline justify-between gap-3 border-neutral-800 border-b pb-2">
                    <span className="font-semibold">{genLabel(g)}</span>
                    <span className="text-sm text-neutral-400 tabular-nums">{genCaught(g)}</span>
                  </h2>
                )}
                <ul className="mb-6 grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
                  {view === 'forms'
                    ? (tiles as typeof forms).map((x) => (
                        <li key={`${x.dexNr} ${x.form.name}`}>
                          <FormTile form={x.form} collection={collection} lang={i18n.language} art={art} showDex fromDex className="h-full" />
                        </li>
                      ))
                    : (tiles as typeof filtered).map((s) => (
                        <li key={s.dexNr}>
                          <SpeciesTile species={s} collection={collection} lang={i18n.language} art={art} shiny={shiny} fromDex />
                        </li>
                      ))}
                </ul>
              </Fragment>
            ))
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
                      <EvolutionChain line={line} collection={collection} lang={i18n.language} art={art} fromDex />
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

const genLabel = (g: Generation) => `Gen ${g.nr} · ${g.region}`

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="flex cursor-pointer items-center gap-1 rounded-full border-1 border-neutral-700 border-solid bg-neutral-800 py-1 pr-2 pl-3 text-sm transition-colors hover:border-neutral-500"
    >
      {children}
      <X className="size-3.5 text-neutral-400" />
    </button>
  )
}

// summary panel pieces: pills for the counts, cards for the generation and type breakdown; finished ones go gold
const pill = 'flex cursor-pointer items-center gap-1 rounded-full border-1 border-solid px-2.5 py-0.5 text-sm transition-colors'
const groupPills: Record<SpeciesGroup, string> = {
  legendary: 'border-amber-300/30 bg-amber-300/10 text-amber-100 hover:border-amber-300/60',
  mythical: 'border-violet-300/30 bg-violet-300/10 text-violet-100 hover:border-violet-300/60',
  starter: 'border-sky-300/30 bg-sky-300/10 text-sky-100 hover:border-sky-300/60',
}
const cell =
  'flex w-full cursor-pointer flex-col gap-1.5 rounded-lg border-1 border-neutral-700/70 border-solid bg-neutral-900/40 px-1.5 py-2 text-left sm:px-2.5 transition-colors hover:border-neutral-500'
const blockLabel = 'mb-2 font-medium text-[10px] text-neutral-500 uppercase tracking-wider'
const doneColor = '#fcd34d' // amber-300

function Fraction({ value, max, done }: { value: number; max: number; done: boolean }) {
  return (
    <span className="flex items-center gap-0.5 text-xs tabular-nums leading-none sm:gap-1 sm:text-sm">
      <span className={cn('font-semibold', done ? 'text-amber-200' : 'text-neutral-100')}>{value}</span>
      <span className="text-[10px] text-neutral-500 sm:text-xs">/{max}</span>
      {done && <Check className="ml-auto size-3.5 text-amber-300" strokeWidth={3} />}
    </span>
  )
}

/** Completion ring with the percentage inside; gold once complete. */
function Ring({ value, max, className }: { value: number; max: number; className?: string }) {
  const share = max === 0 ? 0 : value / max
  const done = max > 0 && value === max
  const r = 42
  const length = 2 * Math.PI * r
  return (
    <span className={cn('relative block', className)}>
      <svg viewBox="0 0 100 100" className="-rotate-90 size-full" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" className="stroke-neutral-700" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${share * length} ${length}`}
          stroke={done ? doneColor : '#93c5fd'}
          className={cn(
            'transition-[stroke-dasharray] duration-700',
            done ? 'drop-shadow-[0_0_6px_rgba(252,211,77,0.5)]' : 'drop-shadow-[0_0_6px_rgba(147,197,253,0.45)]',
          )}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-semibold text-sm tabular-nums sm:text-base">{Math.floor(share * 100)}%</span>
    </span>
  )
}
