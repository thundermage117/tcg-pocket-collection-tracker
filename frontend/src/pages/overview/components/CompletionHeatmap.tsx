import { ChevronRight, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMediaQuery } from 'react-responsive'
import { useNavigate } from 'react-router'
import { Tooltip } from 'react-tooltip'
import { SetLogo } from '@/components/CardThumb'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { formatRarity } from '@/components/utils'
import { expansions, getExpansionById } from '@/lib/CardsDB.ts'
import { tiers } from '@/lib/rankings'
import { MissingThumbs, previewCount } from '@/pages/overview/components/MissingThumbs'
import { type MapSet, PackValueMap, tierOf } from '@/pages/overview/components/PackValueMap'
import { bestChance, type PackChance } from '@/pages/overview/packChances'
import { getPackTierMap } from '@/pages/overview/packMap'
import { type Card, type ExpansionId, type Pack, type Rarity, rarities, tradableRarities } from '@/types'
import './heatmap.css'

interface Props {
  availableCards: Card[]
  collectedCards: Card[]
  chances: Map<ExpansionId, PackChance[]>
  cellMode: CellMode
  setCellMode: (mode: CellMode) => void
  sortByValue: boolean // the overview's Value filter is on: the collection can't filter by tier, so most valuable go first
  rarity: Rarity[] // the overview's rarity filter, carried to Rankings when a pack map block opens its tier
}

// What a cell shows: completion %, or how many cards are still missing
type CellMode = 'pct' | 'left'

interface Cell {
  collected: number
  available: number
}

// On mobile a tap selects a cell (or a set's pack chances) and shows it in the details bar
type Selection = { row: string; col: Rarity | 'all' } | { row: ExpansionId; col: 'packs' }

// Unique cards per "<expansion>|<rarity>", plus "<expansion>|all" and "all|<rarity>" totals
function countByCell(cards: Card[]) {
  const ids = new Map<string, Set<number>>()
  const add = (key: string, id: number) => {
    let set = ids.get(key)
    if (!set) {
      set = new Set()
      ids.set(key, set)
    }
    set.add(id)
  }
  for (const c of cards) {
    add(`${c.expansion}|${c.rarity}`, c.internal_id)
    add(`${c.expansion}|all`, c.internal_id)
    add(`all|${c.rarity}`, c.internal_id)
    add('all|all', c.internal_id)
  }
  return new Map([...ids].map(([key, set]) => [key, set.size]))
}

// The first missing cards per cell key (same keys as countByCell), in card order, for the thumbnail previews
function missingByCell(available: Card[], collected: Card[]) {
  const owned = new Set(collected.map((c) => c.internal_id))
  const cards = new Map<string, Card[]>()
  const seen = new Set<string>()
  for (const c of available) {
    if (owned.has(c.internal_id)) {
      continue
    }
    for (const key of [`${c.expansion}|${c.rarity}`, `${c.expansion}|all`, `all|${c.rarity}`, 'all|all']) {
      const list = cards.get(key) ?? []
      // a card can be in several packs (or listed twice), so dedupe per cell
      if (list.length < previewCount && !seen.has(`${key}|${c.internal_id}`)) {
        seen.add(`${key}|${c.internal_id}`)
        list.push(c)
        cards.set(key, list)
      }
    }
  }
  return cards
}

// Ordinal bands, one blue brighter as a cell nears done, and the reserved "good" green (always with its 100% / ✓
// label) once it's complete. Each step clears 2:1 against the neutral-800 card and its label clears APCA Lc 60.
const swatches = {
  none: { backgroundColor: 'rgb(64 64 64 / 0.35)', color: 'rgb(163 163 163)' },
  b1: { backgroundColor: '#1c5cab', color: '#ffffff' },
  b2: { backgroundColor: '#2a78d6', color: '#ffffff' },
  b3: { backgroundColor: '#5598e7', color: '#ffffff' },
  b4: { backgroundColor: '#9ec5f4', color: '#0b0b0b' },
  done: { backgroundColor: '#0ca30c', color: '#ffffff' },
}
type Swatch = keyof typeof swatches

// Bands follow what the cell shows: % complete (bunched where cells actually sit, 80–100), or cards left
function cellSwatch({ collected, available }: Cell, mode: CellMode): Swatch {
  const missing = available - collected
  if (missing === 0) {
    return 'done'
  }
  if (mode === 'left') {
    return missing <= 2 ? 'b4' : missing <= 5 ? 'b3' : missing <= 15 ? 'b2' : 'b1'
  }
  const pct = (100 * collected) / available
  return collected === 0 ? 'none' : pct < 50 ? 'b1' : pct < 80 ? 'b2' : pct < 95 ? 'b3' : 'b4'
}

const legend: Record<CellMode, [Swatch, string][]> = {
  pct: [
    ['none', '0%'],
    ['b1', '1–49%'],
    ['b2', '50–79%'],
    ['b3', '80–94%'],
    ['b4', '95–99%'],
    ['done', '100%'],
  ],
  left: [
    ['b1', '16+'],
    ['b2', '6–15'],
    ['b3', '3–5'],
    ['b4', '1–2'],
    ['done', 'complete'],
  ],
}

function formatPct({ collected, available }: Cell) {
  const pct = (100 * collected) / available
  if (collected === available) {
    return '100%'
  }
  // Never round a gap up to 100% or a single card down to 0%
  return `${collected > 0 ? Math.max(1, Math.min(99, Math.floor(pct))) : 0}%`
}

function formatLeft({ collected, available }: Cell) {
  return collected === available ? '✓' : String(available - collected)
}

// 1–2 cards from done: the easiest gaps to close with a trade, so only for rarities that can be traded
const isNearlyDone = (col: Rarity | 'all', { collected, available }: Cell) =>
  (tradableRarities as readonly string[]).includes(col) && available - collected > 0 && available - collected <= 2

// Columns of the same family (◊…◊◊◊◊, ☆…☆☆☆, ✵ ✵✵) sit together, with a gap before the next family
const rarityFamily = (r: Rarity) => ['◊', '☆', '✵'].find((f) => r.startsWith(f)) ?? r

const rarityLabel = (r: Rarity | 'all') => (r === 'all' ? 'all rarities' : r)

// One decimal, minus a trailing .0, so a column of 100% / 45% doesn't read as a wall of "100.0%"
const formatChance = (pct: number) => `${pct.toFixed(1).replace(/\.0$/, '')}%`

export function CompletionHeatmap({ availableCards, collectedCards, chances, cellMode, setCellMode, sortByValue, rarity }: Props) {
  const { t } = useTranslation(['common/sets', 'common/packs'])
  const navigate = useNavigate()
  const isMobile = useMediaQuery({ query: '(max-width: 767px)' }) // tailwind "md"
  const [selected, setSelected] = useState<Selection | null>(null)
  // Desktop: the hovered cell lights up its set and rarity headers, so a cell 15 columns in is easy to place
  const [hovered, setHovered] = useState<{ row: string; col: string } | null>(null)
  const headerLit = 'rounded bg-neutral-600/70 text-white'
  // The pack value map is local: Overview owns cellMode (it lives in the URL) and only knows 'pct' | 'left'. Phones keep
  // the grid, where thirty-odd packs would shrink the smaller ones' tiles to slivers below a usable tap target.
  const [mapOn, setMapOn] = useState(false)
  const showMap = mapOn && !isMobile
  // The map's key picks out one tier across every pack: hovering previews it, a click pins it until clicked again
  const [hoverTier, setHoverTier] = useState<number>()
  const [pinnedTier, setPinnedTier] = useState<number>()
  const focusTier = hoverTier ?? pinnedTier

  // Scroll state drives the right-edge fade and the pinned column's shadow
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scroll, setScroll] = useState({ start: false, end: false })
  const updateScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) {
      return
    }
    const next = { start: el.scrollLeft > 0, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 }
    setScroll((prev) => (prev.start === next.start && prev.end === next.end ? prev : next))
  }, [])
  useEffect(() => {
    const el = scrollRef.current
    if (!el) {
      return
    }
    updateScroll()
    const observer = new ResizeObserver(updateScroll)
    observer.observe(el)
    if (el.firstElementChild) {
      observer.observe(el.firstElementChild)
    }
    return () => observer.disconnect()
  }, [updateScroll])

  const openable = expansions.filter((e) => e.openable)
  // Memoized: scrolling and selecting re-render the table
  const { available, collected, missingCards, packGaps } = useMemo(() => {
    const openableIds = new Set(expansions.filter((e) => e.openable).map((e) => e.id))
    const openableAvailable = availableCards.filter((c) => openableIds.has(c.expansion))
    const openableCollected = collectedCards.filter((c) => openableIds.has(c.expansion))
    return {
      available: countByCell(openableAvailable),
      collected: countByCell(openableCollected),
      missingCards: missingByCell(openableAvailable, openableCollected),
      packGaps: getPackTierMap(availableCards, collectedCards),
    }
  }, [availableCards, collectedCards])

  const cell = (row: string, col: string): Cell | undefined => {
    const n = available.get(`${row}|${col}`) ?? 0
    return n === 0 ? undefined : { collected: collected.get(`${row}|${col}`) ?? 0, available: n }
  }

  const columns = rarities.filter((r) => available.has(`all|${r}`))
  const familyStarts = new Set(columns.filter((r, i) => i > 0 && rarityFamily(columns[i - 1]) !== rarityFamily(r)))
  const cellPad = (col: Rarity | 'all') => (col !== 'all' && familyStarts.has(col) ? 'py-0.5 pr-0.5 pl-2' : 'p-0.5')
  const rows = openable.toReversed()

  const mapSets = (): MapSet[] => rows.map((e) => ({ id: e.id, name: setName(e.id), packs: packGaps.get(e.id) ?? [] }))
  // the tiers the map has blocks for, for its key
  const mapTiers = [...new Set([...packGaps.values()].flat().flatMap((p) => p.byTier.map((t) => t.tier)))].toSorted((a, b) => a - b)

  const setName = (row: string) => (row === 'all' ? 'All sets' : t(getExpansionById(row as ExpansionId).name, { ns: 'common/sets' }))
  const packName = (pack: Pack) => t(pack.name, { ns: 'common/packs' })

  const bestInRow = (row: ExpansionId) => bestChance(chances.get(row) ?? [])

  const openCollection = (expansion: string, rarity: Rarity | 'all', pack?: string) => {
    const params = new URLSearchParams({ ownership: 'missing' })
    if (expansion !== 'all') {
      params.set('expansion', expansion)
    }
    if (pack) {
      params.set('pack', pack)
    }
    if (rarity !== 'all') {
      params.set('rarity', rarity)
    }
    if (sortByValue) {
      params.set('sortBy', 'value')
    }
    navigate(`/collection?${params}`)
  }
  // Rankings has no pack filter, so a tier block opens the set's missing cards of that tier (like the Value tiers tile)
  const openTier = (expansion: ExpansionId, tier: number) => {
    const params = new URLSearchParams({ tab: 'wanted', missing: '1', set: expansion, tier: tiers[tier].name })
    if (rarity.length > 0) {
      params.set('rarity', rarity.join(','))
    }
    navigate(`/rankings?${params}`)
  }
  const openPack = (row: ExpansionId, c: PackChance) => openCollection(row, 'all', (chances.get(row)?.length ?? 0) > 1 ? c.pack.name : undefined)

  const isSelected = (row: string, col: Selection['col']) => selected?.row === row && selected.col === col
  const toggle = (sel: Selection) => setSelected(isSelected(sel.row, sel.col) ? null : sel)
  const selectedRing = 'outline-2 outline-offset-1 outline-neutral-100'

  const stickyCol = `sticky left-0 z-10 bg-neutral-800 transition-shadow ${scroll.start ? 'shadow-[6px_0_6px_-4px_rgb(0_0_0/0.7)]' : ''}`

  // Desktop: every pack's chance as a chip at the end of the row
  const renderChances = (row: ExpansionId) => {
    const packs = chances.get(row) ?? []
    const best = bestInRow(row)
    return (
      <td className="hidden pl-2 md:table-cell">
        <div className="flex gap-1">
          {packs.map((c) => {
            const owned = packs.length > 1 ? ` · ${c.collected} / ${c.available} owned` : ''
            // With a choice of packs, the best one glows in its pack colour and the rest step back
            const isBest = c === best && c.pct > 0
            const choice = packs.length > 1
            return (
              <button
                key={c.pack.name}
                type="button"
                className={`flex items-center gap-1 rounded bg-neutral-700/50 px-1.5 py-1.5 text-xs tabular-nums whitespace-nowrap hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-neutral-200 ${isBest ? 'font-semibold' : ''} ${choice && !isBest ? 'text-neutral-400' : ''}`}
                style={choice && isBest ? { boxShadow: `inset 0 0 0 1px ${c.pack.color}99, 0 0 10px -3px ${c.pack.color}` } : undefined}
                onClick={() => openPack(row, c)}
                data-tooltip-id="completion-heatmap"
                data-tooltip-content={`${packName(c.pack)}: ${formatChance(c.pct)} chance of a new card${owned}`}
                aria-label={`${packName(c.pack)}: ${formatChance(c.pct)} chance of a new card`}
              >
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: c.pack.color }} />
                <span>{formatChance(c.pct)}</span>
              </button>
            )
          })}
        </div>
      </td>
    )
  }

  // Mobile: only the best pack's chance, right next to the set code; tap for every pack
  const renderBestChance = (row: ExpansionId) => {
    const best = bestInRow(row)
    return (
      <td className="p-0.5 md:hidden">
        {best && (
          <button
            type="button"
            className={`flex min-h-10 w-full items-center justify-center gap-1 rounded bg-neutral-700/50 px-1.5 text-xs tabular-nums whitespace-nowrap ${isSelected(row, 'packs') ? selectedRing : ''}`}
            onClick={() => toggle({ row, col: 'packs' })}
            aria-label={`${setName(row)}: best pack ${formatChance(best.pct)} chance of a new card`}
          >
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: best.pack.color }} />
            <span>{formatChance(best.pct)}</span>
          </button>
        )}
      </td>
    )
  }

  const renderCell = (row: string, col: Rarity | 'all', isTotal = false) => {
    const c = cell(row, col)
    if (!c) {
      // No cards of this rarity in the set, which a blank would make look like missing data
      return (
        <td key={col} className={`${cellPad(col)} text-center text-neutral-600 text-xs`}>
          –
        </td>
      )
    }
    const missing = c.available - c.collected
    const label = col === 'all' ? setName(row) : `${setName(row)} ${col}`
    const swatch = cellSwatch(c, cellMode)
    // Finished cells get the foil; its sweeps run as a wave from the top-left corner down to the totals
    const wave = (row === 'all' ? rows.length : rows.findIndex((e) => e.id === row)) + (col === 'all' ? columns.length : columns.indexOf(col))
    return (
      <td key={col} className={cellPad(col)}>
        <button
          type="button"
          className={`relative min-h-10 w-full min-w-11 rounded text-xs tabular-nums transition-[filter] md:hover:brightness-125 focus-visible:outline-2 focus-visible:outline-neutral-200 md:min-h-0 md:py-1.5 ${isTotal ? 'font-semibold' : ''} ${isSelected(row, col) ? selectedRing : ''} ${swatch === 'done' ? 'heat-foil' : ''} heat-in`}
          style={{ ...swatches[swatch], ['--foil-delay' as string]: `${wave * 0.12}s`, ['--in-delay' as string]: `${wave * 0.02}s` }}
          onClick={() => (isMobile ? toggle({ row, col }) : openCollection(row, col))}
          onMouseEnter={isMobile ? undefined : () => setHovered({ row, col })}
          onMouseLeave={isMobile ? undefined : () => setHovered(null)}
          data-tooltip-id={isMobile ? undefined : 'completion-heatmap'}
          data-tooltip-content={`${label}: ${c.collected} / ${c.available}${missing > 0 ? ` · ${missing} missing` : ' · complete'}`}
          data-cell={`${row}|${col}`}
          aria-label={`${label}: ${c.collected} of ${c.available} collected`}
        >
          {cellMode === 'left' ? formatLeft(c) : formatPct(c)}
          {isNearlyDone(col, c) && <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-amber-400" />}
        </button>
      </td>
    )
  }

  const renderDetails = () => {
    if (!isMobile || !selected) {
      return null
    }
    const header = (title: string) => (
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="font-semibold text-sm">
          {selected.row !== 'all' && <span className="mr-1.5 text-neutral-400 tabular-nums">{selected.row}</span>}
          {title}
        </p>
        <button type="button" className="-m-1.5 p-1.5 text-neutral-400" onClick={() => setSelected(null)} aria-label="Close">
          <X className="size-4" />
        </button>
      </div>
    )

    let body: React.ReactNode
    if (selected.col === 'packs') {
      const row = selected.row
      const packs = chances.get(row) ?? []
      const best = bestInRow(row)
      body = (
        <>
          {header(`${setName(row)} · chance of a new card`)}
          <ul className="flex flex-col gap-1">
            {packs.map((c) => (
              <li key={c.pack.name}>
                <button
                  type="button"
                  className="flex min-h-10 w-full items-center gap-2 rounded bg-neutral-800 px-2 text-left text-sm"
                  onClick={() => openPack(row, c)}
                >
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.pack.color }} />
                  <span className={`grow truncate ${c === best && c.pct > 0 ? 'font-semibold' : ''}`}>{packName(c.pack)}</span>
                  {packs.length > 1 && (
                    <span className="text-neutral-400 text-xs tabular-nums">
                      {c.collected} / {c.available}
                    </span>
                  )}
                  <span className="w-12 text-right tabular-nums">{formatChance(c.pct)}</span>
                  <ChevronRight className="size-4 shrink-0 text-neutral-500" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )
    } else {
      const c = cell(selected.row, selected.col)
      if (!c) {
        return null
      }
      const missing = c.available - c.collected
      const { row, col } = selected
      const thumbs = missingCards.get(`${row}|${col}`) ?? []
      body = (
        <>
          {header(`${setName(row)} · ${rarityLabel(col)}`)}
          <div className="flex items-center justify-between gap-3">
            <p className="text-neutral-300 text-sm tabular-nums">
              {c.collected} / {c.available} owned · {missing > 0 ? `${missing} missing` : 'complete'}
            </p>
            {missing > 0 && (
              <button
                type="button"
                className="flex min-h-10 shrink-0 items-center gap-1 rounded bg-neutral-100 px-3 font-semibold text-neutral-900 text-sm"
                onClick={() => openCollection(row, col)}
              >
                View missing
                <ChevronRight className="size-4" />
              </button>
            )}
          </div>
          {thumbs.length > 0 && <MissingThumbs cards={thumbs} missing={missing} className="mt-2" />}
        </>
      )
    }

    return (
      <div className="sticky bottom-19 z-20 lg:bottom-3 mt-3 rounded-lg border border-neutral-600 bg-neutral-900/95 p-3 shadow-lg backdrop-blur">{body}</div>
    )
  }

  if (columns.length === 0) {
    return null
  }

  return (
    <section className="mt-4 rounded-lg border border-neutral-700 bg-neutral-800 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-base sm:text-lg">{showMap ? "What's left, by pack" : 'Completion by rarity'}</h2>
          <ToggleGroup
            type="single"
            value={showMap ? 'map' : cellMode}
            onValueChange={(v) => {
              if (!v) {
                return
              }
              setMapOn(v === 'map')
              if (v !== 'map') {
                setCellMode(v as CellMode)
              }
            }}
            className="gap-0.5 rounded-md border-1 border-neutral-700 p-0.5"
            aria-label="Cells show"
          >
            <ToggleGroupItem value="pct" className="h-7 px-2 text-xs">
              %
            </ToggleGroupItem>
            <ToggleGroupItem value="left" className="h-7 px-2 text-xs">
              Cards left
            </ToggleGroupItem>
            {!isMobile && (
              <ToggleGroupItem value="map" className="h-7 px-2 text-xs" aria-label="Pack value map">
                Packs
              </ToggleGroupItem>
            )}
          </ToggleGroup>
        </div>
        <p className="text-neutral-400 text-xs">
          {showMap ? (
            "A pack's size is how many cards you're missing from it, coloured by value tier. Click a block to open that tier on Rankings; point at a tier below to find it in every pack."
          ) : (
            <>
              "New card" is the chance one pack gives a card you're missing. <span className="md:hidden">Tap for details.</span>
              <span className="hidden md:inline">Click to see them.</span>
            </>
          )}
        </p>
      </div>
      <ul className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-neutral-400 text-xs" aria-label="Colour key">
        {showMap ? (
          mapTiers.map((i) => (
            <li key={i}>
              <button
                type="button"
                className={`-mx-1 flex items-center gap-1 rounded px-1 py-0.5 transition-[opacity,background-color] hover:bg-neutral-700/60 ${pinnedTier === i ? 'bg-neutral-700 text-neutral-100' : ''} ${focusTier !== undefined && focusTier !== i ? 'opacity-50' : ''}`}
                onMouseEnter={() => setHoverTier(i)}
                onMouseLeave={() => setHoverTier(undefined)}
                onFocus={() => setHoverTier(i)}
                onBlur={() => setHoverTier(undefined)}
                onClick={() => setPinnedTier(pinnedTier === i ? undefined : i)}
                aria-pressed={pinnedTier === i}
                aria-label={`Highlight ${tierOf(i).name} in every pack`}
              >
                <span className="size-3 rounded-sm" style={{ backgroundColor: tierOf(i).color }} />
                {tierOf(i).name}
              </button>
            </li>
          ))
        ) : (
          <>
            {legend[cellMode].map(([swatch, label]) => (
              <li key={swatch} className="flex items-center gap-1">
                <span className="size-3 rounded-sm" style={{ backgroundColor: swatches[swatch].backgroundColor }} />
                {label}
              </li>
            ))}
            <li className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-amber-400" />
              1–2 tradable cards left
            </li>
          </>
        )}
      </ul>
      {showMap && (
        <PackValueMap
          sets={mapSets()}
          chances={chances}
          best={bestChance([...chances.values()].flat())?.pack}
          focusTier={focusTier}
          fadeLow={!sortByValue}
          packName={packName}
          onOpen={(expansion, pack) => openCollection(expansion, 'all', (chances.get(expansion)?.length ?? 0) > 1 ? pack.name : undefined)}
          onOpenTier={openTier}
        />
      )}
      {/* Hidden rather than unmounted under the map, so the scroll observer keeps watching the same element */}
      <div className={showMap ? 'hidden' : 'relative'}>
        <div ref={scrollRef} className="overflow-x-auto" onScroll={updateScroll}>
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th className={`${stickyCol} pr-2 text-left font-semibold text-neutral-400 text-xs uppercase tracking-wider`}>Set</th>
                <th className="px-0.5 pb-1 text-center font-semibold text-[10px] text-neutral-400 uppercase leading-tight md:hidden">New card</th>
                {columns.map((r) => (
                  <th
                    key={r}
                    className={`${familyStarts.has(r) ? 'pr-0.5 pl-2' : 'px-0.5'} pb-1 text-center font-normal text-neutral-300 text-xs whitespace-nowrap`}
                  >
                    {/* coloured like the rarity filter above, so ◊ / ☆ / ✵ read as groups */}
                    <span className={`px-1.5 py-0.5 transition-colors ${hovered?.col === r ? headerLit : ''}`}>{formatRarity(r)}</span>
                  </th>
                ))}
                <th />
                <th className="px-0.5 pb-1 text-center font-semibold text-neutral-400 text-xs uppercase tracking-wider">
                  <span className={`px-1.5 py-0.5 transition-colors ${hovered?.col === 'all' ? headerLit : ''}`}>All</span>
                </th>
                <th className="hidden pl-2 pb-1 text-left font-semibold text-neutral-400 text-xs uppercase tracking-wider whitespace-nowrap md:table-cell">
                  New card
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const name = setName(e.id)
                return (
                  <tr key={e.id}>
                    <th scope="row" className={`${stickyCol} py-0.5 pr-2 text-left font-normal text-sm`} title={name}>
                      {/* Mobile: set logo with the code underneath; desktop: logo, then code and full name */}
                      <span className="flex w-15 flex-col items-center md:hidden">
                        <SetLogo expansionId={e.id} className="h-7 w-full" />
                        <span className="text-[11px] text-neutral-400 leading-tight tabular-nums">{e.id}</span>
                      </span>
                      <span className={`-mx-1 hidden items-center gap-2 px-1 transition-colors md:flex ${hovered?.row === e.id ? headerLit : ''}`}>
                        <SetLogo expansionId={e.id} className="h-7 w-16 shrink-0" />
                        <span className="max-w-44 truncate">
                          <span className="mr-1.5 text-neutral-500 text-xs tabular-nums">{e.id}</span>
                          <span className="text-neutral-200">{name}</span>
                        </span>
                      </span>
                    </th>
                    {renderBestChance(e.id)}
                    {columns.map((r) => renderCell(e.id, r))}
                    <td className="w-2" />
                    {renderCell(e.id, 'all', true)}
                    {renderChances(e.id)}
                  </tr>
                )
              })}
              <tr>
                <th scope="row" className={`${stickyCol} pt-2 pr-2 text-left font-semibold text-neutral-400 text-xs uppercase tracking-wider`}>
                  <span className="md:hidden">All</span>
                  <span className={`-mx-1 hidden px-1 py-0.5 transition-colors md:inline ${hovered?.row === 'all' ? headerLit : ''}`}>All sets</span>
                </th>
                <td className="md:hidden" />
                {columns.map((r) => renderCell('all', r, true))}
                <td />
                {renderCell('all', 'all', true)}
              </tr>
            </tbody>
          </table>
        </div>
        <div
          className={`pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-neutral-800 to-transparent transition-opacity ${scroll.end ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>
      {renderDetails()}
      <Tooltip
        id="completion-heatmap"
        className="z-30"
        opacity={1}
        // Cells add a preview of the cards they're missing under the text; the pack chips keep plain text
        render={({ content, activeAnchor }) => {
          const key = activeAnchor?.getAttribute('data-cell')
          const [row, col] = key?.split('|') ?? []
          const c = key ? cell(row, col) : undefined
          const thumbs = key ? (missingCards.get(key) ?? []) : []
          return (
            <div className={c && thumbs.length > 0 ? 'w-64' : undefined}>
              <p>{content}</p>
              {c && thumbs.length > 0 && <MissingThumbs cards={thumbs} missing={c.available - c.collected} className="mt-1.5" />}
            </div>
          )
        }}
      />
    </section>
  )
}
