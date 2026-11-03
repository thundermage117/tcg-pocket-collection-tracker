// Personal fork: one tile per species in National Dex order, owned when any printing (any form) is owned.
// The forms view gives each form with artwork of its own (Alolan Vulpix, Mega Charizard X) a tile of its own, next to its species'.
// Filters live in the URL (?dex=shiny&view=forms&art=card&q=…&gen=1&group=legendary&stage=stage2&has=mega&type=fire&show=missing&set=A1&sort=printings), so links, refresh and back keep the view.
import { ChevronDown, PawPrint, RectangleVertical, Search, SlidersHorizontal, X } from 'lucide-react'
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigationType, useSearchParams } from 'react-router'
import { DropdownFilter, TabsFilter } from '@/components/Filters'
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
  saveReturn,
  speciesGroupOptions,
  speciesName,
  spriteUrl,
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
import { chainScroller, EvolutionChain } from './EvolutionChain'
import { FormTile, GroupIcon, groupLabels, ProgressBar, SpeciesTile, surface, type TileArt, typeColors } from './SpeciesTile'

export default function Pokedex() {
  const { t, i18n } = useTranslation(['common/sets', 'search-input'])
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
      return { owned: inGen.filter((form) => ownedCount(collection, form.cards) > 0).length, total: inGen.length, unit: 'forms caught' }
    }
    const inGen = list.filter((s) => generationOf(s.dexNr) === g)
    return { owned: inGen.filter((s) => ownedOf(s) > 0).length, total: inGen.length, unit: 'caught' }
  }
  const formsCaught = allForms.filter((form) => ownedCount(collection, form.cards) > 0).length
  const linesComplete = allLines.filter((line) => line.species.every((s) => ownedOf(s) > 0)).length

  return (
    <main className="mx-auto max-w-7xl px-4 pb-12">
      <header className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="dex-display text-2xl font-semibold sm:text-3xl">{shiny ? 'Shiny Pokédex' : 'Pokédex'}</h1>
          <TabsFilter options={dexOptions} value={dex} onChange={(x) => update({ dex: x })} show={(x) => dexLabels[x]} />
        </div>
        <p className="mt-1 text-sm text-neutral-400">
          {shiny
            ? 'Every species with a shiny (✵ or ✵✵) card. It counts as owned with any of its shiny cards.'
            : 'Every species in TCG Pocket. A species counts as owned with any card of it, in any form.'}
        </p>
      </header>

      <section className={cn('relative mb-6 overflow-hidden rounded-2xl p-4 sm:p-5', surface)}>
        <Pokeball className="pointer-events-none absolute -top-16 -right-16 size-56 text-neutral-700/50 sm:-top-20 sm:-right-12 sm:size-72" />
        <div className="relative">
          <h2 className="font-medium text-neutral-400 text-xs uppercase tracking-wider">{shiny ? 'Shiny species owned' : 'Species owned'}</h2>
          <p className="tabular-nums leading-tight">
            <span className="dex-display font-bold text-3xl sm:text-4xl">{speciesOwned}</span>
            <span className="text-lg text-neutral-500"> / {list.length}</span>
          </p>
          <ProgressBar value={speciesOwned} max={list.length} className="mt-3 h-1.5 max-w-xl" />
          <div className="mt-3 flex flex-wrap items-center gap-1.5 tabular-nums">
            {/* legendary / mythical / starters caught, each a shortcut to its filter */}
            {speciesGroupOptions.map((g) => {
              const inGroup = list.filter((s) => s.group === g)
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => update({ group: group === g ? undefined : g })}
                  title={groupLabels[g]}
                  className={cn(pill, group === g && 'border-neutral-400 text-white')}
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
                  className={cn(pill, view === 'forms' && 'border-neutral-400 text-white')}
                >
                  {formsCaught}/{allForms.length} forms
                </button>
                <span className={cn(pill, 'cursor-default hover:border-white/[0.06]')}>
                  {linesComplete}/{allLines.length} lines complete
                </span>
              </>
            )}
          </div>
        </div>
        {/* on phones the generation and type bars fold away, so the grid starts on the first screen */}
        <button
          type="button"
          onClick={() => setBreakdownOpen(!breakdownOpen)}
          aria-expanded={breakdownOpen}
          className="relative mt-4 flex w-full cursor-pointer items-center justify-center gap-1 border-white/[0.06] border-t pt-3 text-sm text-neutral-400 hover:text-white sm:hidden"
        >
          By generation and type
          <ChevronDown className={cn('size-4 transition-transform', breakdownOpen && 'rotate-180')} />
        </button>
        {/* lg:mt-9: room for the mascots that rise out of the region cards */}
        <div className={cn(breakdownOpen ? 'mt-3 block' : 'hidden', 'relative sm:mt-5 sm:block lg:mt-9')}>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
            {generations.map((g) => {
              const inGen = list.filter((s) => generationOf(s.dexNr).nr === g.nr)
              const ownedInGen = inGen.filter((s) => ownedOf(s) > 0).length
              const active = gen === String(g.nr)
              return (
                <li key={g.nr}>
                  <button
                    type="button"
                    onClick={() => update({ gen: active ? undefined : String(g.nr) })}
                    title={`Gen ${g.nr} · ${g.region}`}
                    // on one row (lg) the mascot rises out of the card; wrapped into rows it would cover the row above, so it stays in
                    className={cn(cell, 'bg-neutral-900/50 lg:overflow-visible', active && 'border-blue-300')}
                  >
                    {/* the region's mascot legendary, large and in colour behind the card's text, with a scrim so the text stays legible */}
                    <img
                      src={spriteUrl(regionMascots[g.nr - 1])}
                      alt=""
                      loading="lazy"
                      draggable={false}
                      className="pointer-events-none absolute -right-3 -bottom-3 -z-20 size-20 origin-bottom-right drop-shadow-[0_6px_10px_rgb(0_0_0/0.55)] transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none sm:size-24 lg:-right-3 lg:bottom-0 lg:size-24"
                    />
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 -z-10 rounded-lg bg-linear-to-r from-neutral-900/90 via-neutral-900/55 to-transparent"
                    />
                    <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Gen {g.nr}</span>
                    <span className="dex-display font-semibold text-sm leading-tight sm:text-[0.95rem]">{g.region}</span>
                    <Fraction value={ownedInGen} max={inGen.length} />
                    <ProgressBar value={ownedInGen} max={inGen.length} className="h-1" />
                  </button>
                </li>
              )
            })}
          </ul>
          {/* a dual-type species counts under both types */}
          <ul className="mt-2 grid grid-cols-5 gap-2 lg:grid-cols-10">
            {typeOptions
              .filter((x) => x !== 'all')
              .map((x) => {
                const ofType = list.filter((s) => s.types.includes(x))
                const ownedOfType = ofType.filter((s) => ownedOf(s) > 0).length
                const active = type === x
                return (
                  <li key={x}>
                    <button
                      type="button"
                      onClick={() => update({ type: active ? undefined : x })}
                      title={capitalize(x)}
                      className={cn(cell, active && 'border-blue-300')}
                      style={{ backgroundImage: `linear-gradient(135deg, ${typeColors[x]}40, ${typeColors[x]}0a 70%)` }}
                    >
                      {/* the energy symbol as a watermark */}
                      <img
                        src={`/images/energy/${x}.webp`}
                        alt=""
                        className="pointer-events-none absolute -right-2.5 -bottom-2.5 -z-10 size-9 opacity-10 transition-opacity group-hover:opacity-35 sm:size-12 sm:opacity-20"
                      />
                      <img src={`/images/energy/${x}.webp`} alt={x} className="size-5" />
                      <span className="dex-display hidden font-semibold text-sm leading-tight sm:block sm:text-[0.95rem]">{capitalize(x)}</span>
                      <Fraction value={ownedOfType} max={ofType.length} />
                      <ProgressBar value={ownedOfType} max={ofType.length} color={typeColors[x]} className="h-1" />
                    </button>
                  </li>
                )
              })}
          </ul>
        </div>
      </section>

      {/* search, filters and the generation jump stay on screen through ~1000 tiles */}
      <div ref={barRef} className="sticky top-0 z-20 -mx-4 mb-3 flex flex-col gap-3 bg-[#181818]/90 px-4 py-2 backdrop-blur">
        {/* one height, border and radius across the controls; on phones search and the tile art share a row */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex gap-2 sm:flex-1">
            <label className="relative flex grow items-center">
              <Search className="pointer-events-none absolute left-3 size-4 text-neutral-500" />
              <input
                type="search"
                placeholder={t('search', { ns: 'search-input' })}
                defaultValue={search}
                onChange={(e) => update({ q: e.target.value.trim() || undefined })}
                className={cn(control, 'w-full pr-3 pl-9 outline-none placeholder:text-neutral-500 focus:border-blue-300')}
              />
            </label>
            <ArtToggle value={art} onChange={(x) => update({ art: x })} className="sm:hidden" />
          </div>
          <div className="flex items-center gap-2">
            <TabsFilter
              options={showOptions}
              value={show}
              onChange={(x) => update({ show: x })}
              show={(x) => showLabels[x]}
              className="h-10 grow whitespace-nowrap rounded-lg"
            />
            <ArtToggle value={art} onChange={(x) => update({ art: x })} className="hidden sm:flex" />
            <Button variant="outline" onClick={() => setSheetOpen(true)} className={cn(control, 'shrink-0 hover:bg-neutral-700')}>
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
        {/* the generation jump, with what's shown at the end */}
        <div className="flex items-center gap-3">
          {sections.length > 1 && sections[0].g && (
            <nav
              ref={genNavRef}
              aria-label="Jump to generation"
              // fades out at the right where it scrolls on; the padding lets the last chip clear the fade
              className="-ml-4 flex min-w-0 grow gap-1.5 overflow-x-auto pr-12 pl-4 [mask-image:linear-gradient(to_right,black_calc(100%-3rem),transparent)]"
            >
              {sections.map(({ g, tiles }) =>
                g ? (
                  <button
                    key={g.nr}
                    type="button"
                    data-gen-chip={g.nr}
                    onClick={() => jumpTo(g.nr)}
                    title={`${genLabel(g)} · ${tiles.length} shown`}
                    className={cn(
                      'flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.04] py-0.5 pr-2.5 pl-0.5 text-xs text-neutral-400 transition-colors hover:border-white/20',
                      currentGen === g.nr && 'border-blue-300 text-white',
                    )}
                  >
                    <span
                      className={cn('rounded-full bg-neutral-700 px-1.5 font-bold text-neutral-200', currentGen === g.nr && 'bg-blue-300 text-neutral-900')}
                    >
                      {g.nr}
                    </span>
                    {g.region}
                  </button>
                ) : null,
              )}
            </nav>
          )}
          {/* a divider, so the count doesn't read as a chip cut off by the fade */}
          <span
            className={cn(
              'ml-auto flex shrink-0 items-center gap-2 text-neutral-500 text-xs tabular-nums',
              sections.length > 1 && sections[0].g && 'border-white/10 border-l pl-3',
            )}
          >
            {view === 'dex' ? `${filtered.length} species` : view === 'forms' ? `${forms.length} forms` : `${lines.length} lines`}
            {filtering && (
              <Link to={clearUrl} className="text-neutral-400 underline hover:text-white">
                Clear
              </Link>
            )}
          </span>
        </div>
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
          <Link to={clearUrl} className="rounded-md border-1 border-white/10 border-solid px-3 py-1.5 text-sm text-white hover:border-white/25">
            Clear filters
          </Link>
        </div>
      ) : view !== 'lines' ? (
        sections.map(({ g, tiles }) => (
          <Fragment key={g?.nr ?? 'all'}>
            {g && <GenBanner g={g} {...genCaught(g)} />}
            {/* four across on phones, so a screen shows a dozen species rather than six */}
            <ul className="mb-6 grid grid-cols-4 gap-2 sm:grid-cols-5 sm:gap-3 md:grid-cols-6 lg:grid-cols-8">
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
            const complete = ownedInLine === line.species.length
            return (
              // min-w-0: the chain is as wide as it is (w-max) and scrolls in here, rather than widening the card off a phone's screen
              <li key={line.root} className={cn('min-w-0 rounded-xl p-3', surface, complete && 'border-amber-300/60')}>
                <h2 className="mb-2 flex items-center gap-3">
                  <span className="dex-display shrink-0 font-semibold">{speciesName(line.species[0], i18n.language)} line</span>
                  <ProgressBar value={ownedInLine} max={line.species.length} color={complete ? '#fcd34d' : undefined} className="h-1 grow" />
                  <span className={cn('shrink-0 text-sm tabular-nums', complete ? 'text-amber-300' : 'text-neutral-400')}>
                    {ownedInLine}/{line.species.length} species
                  </span>
                </h2>
                <div className={chainScroller}>
                  <EvolutionChain line={line} collection={collection} lang={i18n.language} art={art} fromDex />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}

const genLabel = (g: Generation) => `Gen ${g.nr} · ${g.region}`

/** A generation's section header: its region, mascot and progress, gold once every one is caught. */
function GenBanner({ g, owned, total, unit }: { g: Generation; owned: number; total: number; unit: string }) {
  const complete = owned === total
  return (
    <h2
      data-gen={g.nr}
      className={cn(
        'relative isolate mb-3 flex items-center gap-3 overflow-hidden rounded-xl py-2 pr-20 pl-3 sm:gap-5 sm:pr-28',
        surface,
        complete && 'border-amber-300/60',
      )}
    >
      <img
        src={spriteUrl(regionMascots[g.nr - 1])}
        alt=""
        loading="lazy"
        draggable={false}
        className="pointer-events-none absolute -right-2 -bottom-7 -z-10 size-24 opacity-30 sm:right-2 sm:size-28"
      />
      <span className="flex shrink-0 flex-col leading-tight">
        <span className="font-normal text-[10px] text-neutral-500 uppercase tracking-wider">Gen {g.nr}</span>
        <span className="dex-display font-semibold text-[1.05rem]">{g.region}</span>
      </span>
      <ProgressBar value={owned} max={total} color={complete ? '#fcd34d' : undefined} className="h-1.5 grow" />
      <span className="shrink-0 font-normal text-sm tabular-nums">
        <span className={complete ? 'text-amber-300' : 'text-neutral-200'}>{owned}</span>
        <span className="text-neutral-500">
          /{total} {unit}
        </span>
      </span>
    </h2>
  )
}

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="flex cursor-pointer items-center gap-1 rounded-full border-1 border-white/[0.06] border-solid bg-white/[0.05] py-1 pr-2 pl-3 text-sm transition-colors hover:border-white/20"
    >
      {children}
      <X className="size-3.5 text-neutral-400" />
    </button>
  )
}

// the sticky bar's controls share a height, border and radius
const control = 'h-10 rounded-lg border-1 border-white/[0.08] border-solid bg-neutral-800/70 text-sm transition-colors hover:border-white/20'

/** Tile art as two icons: the Pokémon's artwork or its card. */
function ArtToggle({ value, onChange, className }: { value: TileArt; onChange: (x: TileArt) => void; className?: string }) {
  const icons = { sprite: PawPrint, card: RectangleVertical }
  return (
    <fieldset aria-label="Tile art" className={cn(control, 'm-0 flex shrink-0 items-center gap-0.5 p-1 hover:border-white/[0.08]', className)}>
      {artOptions.map((x) => {
        const Icon = icons[x]
        return (
          <button
            key={x}
            type="button"
            title={artLabels[x]}
            aria-label={artLabels[x]}
            aria-pressed={value === x}
            onClick={() => onChange(x)}
            className={cn(
              'flex h-full cursor-pointer items-center rounded-md px-2 text-neutral-400 transition-colors hover:text-white',
              value === x && 'bg-neutral-700 text-white',
            )}
          >
            <Icon className="size-4" />
          </button>
        )
      })}
    </fieldset>
  )
}

// summary panel pieces: pills for the counts, cards for the generation and type breakdown
const pill =
  'flex cursor-pointer items-center gap-1 rounded-full border-1 border-white/[0.06] border-solid bg-white/[0.04] px-2.5 py-0.5 text-neutral-300 text-sm transition-colors hover:border-white/20'
const cell =
  'group relative isolate flex w-full cursor-pointer flex-col gap-1 overflow-hidden rounded-lg border-1 border-white/[0.06] border-solid px-1.5 py-2 text-left shadow-[inset_0_1px_0_0_rgb(255_255_255/0.05)] transition-colors hover:border-white/20 sm:px-2.5'
// version mascots: Mewtwo, Lugia, Rayquaza, Dialga, Reshiram, Xerneas, Solgaleo, Zacian, Koraidon
const regionMascots = [150, 249, 384, 483, 643, 716, 791, 888, 1007]

function Fraction({ value, max }: { value: number; max: number }) {
  return (
    <span className="text-xs tabular-nums leading-none sm:text-sm">
      <span className="font-semibold text-neutral-100">{value}</span>
      <span className="text-[10px] text-neutral-500 sm:text-xs">/{max}</span>
    </span>
  )
}

/** The Pokédex panel's backdrop: a Poké Ball in outline. */
function Pokeball({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="5" className={className} aria-hidden>
      <circle cx="50" cy="50" r="45" />
      <path d="M5 50h30M65 50h30" />
      <circle cx="50" cy="50" r="15" />
      <circle cx="50" cy="50" r="7" />
    </svg>
  )
}
