import { ChevronRight, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMediaQuery } from 'react-responsive'
import { useNavigate } from 'react-router'
import { Tooltip } from 'react-tooltip'
import { expansions, getExpansionById } from '@/lib/CardsDB.ts'
import { pullRate } from '@/lib/stats'
import { type Card, type Expansion, type ExpansionId, type Pack, type Rarity, rarities } from '@/types'

interface Props {
  availableCards: Card[]
  collectedCards: Card[]
  wantedCards: Card[]
  deckbuildingMode: boolean
}

interface Cell {
  collected: number
  available: number
}

interface PackChance extends Cell {
  pack: Pack
  pct: number
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

// One hue (the overview's radial chart blue), dim to bright as completion rises
function cellStyle({ collected, available }: Cell) {
  const ratio = collected / available
  if (collected === 0) {
    return { backgroundColor: 'rgb(64 64 64 / 0.35)', color: 'rgb(163 163 163)' }
  }
  return {
    backgroundColor: `rgb(146 197 253 / ${(0.12 + 0.88 * ratio).toFixed(2)})`,
    color: ratio >= 0.55 ? 'rgb(23 23 23)' : 'rgb(245 245 245)',
  }
}

function formatPct({ collected, available }: Cell) {
  const pct = (100 * collected) / available
  if (collected === available) {
    return '100%'
  }
  // Never round a gap up to 100% or a single card down to 0%
  return `${collected > 0 ? Math.max(1, Math.min(99, Math.floor(pct))) : 0}%`
}

function chanceColor(pct: number) {
  return pct >= 10 ? 'text-green-400' : pct >= 3 ? 'text-yellow-400' : 'text-neutral-500'
}

const rarityLabel = (r: Rarity | 'all') => (r === 'all' ? 'all rarities' : r)

export function CompletionHeatmap({ availableCards, collectedCards, wantedCards, deckbuildingMode }: Props) {
  const { t } = useTranslation(['common/sets', 'common/packs'])
  const navigate = useNavigate()
  const isMobile = useMediaQuery({ query: '(max-width: 767px)' }) // tailwind "md"
  const [selected, setSelected] = useState<Selection | null>(null)

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
  const openableIds = new Set(openable.map((e) => e.id))
  const available = countByCell(availableCards.filter((c) => openableIds.has(c.expansion)))
  const collected = countByCell(collectedCards.filter((c) => openableIds.has(c.expansion)))

  const cell = (row: string, col: string): Cell | undefined => {
    const n = available.get(`${row}|${col}`) ?? 0
    return n === 0 ? undefined : { collected: collected.get(`${row}|${col}`) ?? 0, available: n }
  }

  const columns = rarities.filter((r) => available.has(`all|${r}`))
  const rows = openable.toReversed()

  const setName = (row: string) => (row === 'all' ? 'All sets' : t(getExpansionById(row as ExpansionId).name, { ns: 'common/sets' }))
  const packName = (pack: Pack) => t(pack.name, { ns: 'common/packs' })

  // Chance that one pack gives a card you're missing
  const packChances = (expansion: Expansion): PackChance[] =>
    expansion.packs
      .filter((p) => p.name !== 'everypack')
      .map((pack) => ({
        pack,
        pct: 100 * pullRate(wantedCards, expansion, pack, deckbuildingMode),
        available: availableCards.filter((c) => c.expansion === expansion.id && c.pack === pack.name).length,
        collected: collectedCards.filter((c) => c.expansion === expansion.id && c.pack === pack.name).length,
      }))
  const chances = new Map(rows.map((e) => [e.id, packChances(e)]))
  const bestChance = (row: ExpansionId) => (chances.get(row) ?? []).reduce<PackChance | undefined>((a, b) => (!a || b.pct > a.pct ? b : a), undefined)

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
    navigate(`/collection?${params}`)
  }
  const openPack = (row: ExpansionId, c: PackChance) => openCollection(row, 'all', (chances.get(row)?.length ?? 0) > 1 ? c.pack.name : undefined)

  const isSelected = (row: string, col: Selection['col']) => selected?.row === row && selected.col === col
  const toggle = (sel: Selection) => setSelected(isSelected(sel.row, sel.col) ? null : sel)
  const selectedRing = 'outline-2 outline-offset-1 outline-neutral-100'

  const stickyCol = `sticky left-0 z-10 bg-neutral-800 transition-shadow ${scroll.start ? 'shadow-[6px_0_6px_-4px_rgb(0_0_0/0.7)]' : ''}`

  // Desktop: every pack's chance as a chip at the end of the row
  const renderChances = (row: ExpansionId) => {
    const packs = chances.get(row) ?? []
    const best = bestChance(row)
    return (
      <td className="hidden pl-2 md:table-cell">
        <div className="flex gap-1">
          {packs.map((c) => {
            const owned = packs.length > 1 ? ` · ${c.collected} / ${c.available} owned` : ''
            return (
              <button
                key={c.pack.name}
                type="button"
                className={`flex items-center gap-1 rounded bg-neutral-700/50 px-1.5 py-1.5 text-xs tabular-nums whitespace-nowrap hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-neutral-200 ${c === best && c.pct > 0 ? 'font-semibold' : ''}`}
                onClick={() => openPack(row, c)}
                data-tooltip-id="completion-heatmap"
                data-tooltip-content={`${packName(c.pack)}: ${c.pct.toFixed(1)}% chance of a new card${owned}`}
                aria-label={`${packName(c.pack)}: ${c.pct.toFixed(1)}% chance of a new card`}
              >
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: c.pack.color }} />
                <span className={chanceColor(c.pct)}>{c.pct.toFixed(1)}%</span>
              </button>
            )
          })}
        </div>
      </td>
    )
  }

  // Mobile: only the best pack's chance, right next to the set code; tap for every pack
  const renderBestChance = (row: ExpansionId) => {
    const best = bestChance(row)
    return (
      <td className="p-0.5 md:hidden">
        {best && (
          <button
            type="button"
            className={`flex min-h-10 w-full items-center justify-center gap-1 rounded bg-neutral-700/50 px-1.5 text-xs tabular-nums whitespace-nowrap ${isSelected(row, 'packs') ? selectedRing : ''}`}
            onClick={() => toggle({ row, col: 'packs' })}
            aria-label={`${setName(row)}: best pack ${best.pct.toFixed(1)}% chance of a new card`}
          >
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: best.pack.color }} />
            <span className={chanceColor(best.pct)}>{best.pct.toFixed(1)}%</span>
          </button>
        )}
      </td>
    )
  }

  const renderCell = (row: string, col: Rarity | 'all', isTotal = false) => {
    const c = cell(row, col)
    if (!c) {
      return <td key={col} className="p-0.5" />
    }
    const missing = c.available - c.collected
    const label = col === 'all' ? setName(row) : `${setName(row)} ${col}`
    return (
      <td key={col} className="p-0.5">
        <button
          type="button"
          className={`min-h-10 w-full min-w-11 rounded text-xs tabular-nums transition-[filter] md:hover:brightness-125 focus-visible:outline-2 focus-visible:outline-neutral-200 md:min-h-0 md:py-1.5 ${isTotal ? 'font-semibold' : ''} ${isSelected(row, col) ? selectedRing : ''}`}
          style={cellStyle(c)}
          onClick={() => (isMobile ? toggle({ row, col }) : openCollection(row, col))}
          data-tooltip-id={isMobile ? undefined : 'completion-heatmap'}
          data-tooltip-content={`${label}: ${c.collected} / ${c.available}${missing > 0 ? ` · ${missing} missing` : ' · complete'}`}
          aria-label={`${label}: ${c.collected} of ${c.available} collected`}
        >
          {formatPct(c)}
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
      const best = bestChance(row)
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
                  <span className={`w-12 text-right tabular-nums ${chanceColor(c.pct)}`}>{c.pct.toFixed(1)}%</span>
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
        </>
      )
    }

    return <div className="sticky bottom-3 z-20 mt-3 rounded-lg border border-neutral-600 bg-neutral-900/95 p-3 shadow-lg backdrop-blur">{body}</div>
  }

  if (columns.length === 0) {
    return null
  }

  return (
    <section className="mt-4 rounded-lg border border-neutral-700 bg-neutral-800 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-semibold text-base sm:text-lg">Completion by rarity</h2>
        <p className="text-neutral-400 text-xs">
          Darker means more gaps. "New card" is the chance one pack gives a card you're missing. <span className="md:hidden">Tap for details.</span>
          <span className="hidden md:inline">Click to see them.</span>
        </p>
      </div>
      <div className="relative">
        <div ref={scrollRef} className="overflow-x-auto" onScroll={updateScroll}>
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th className={`${stickyCol} pr-2 text-left font-semibold text-neutral-400 text-xs uppercase tracking-wider`}>Set</th>
                <th className="px-0.5 pb-1 text-center font-semibold text-[10px] text-neutral-400 uppercase leading-tight md:hidden">New card</th>
                {columns.map((r) => (
                  <th key={r} className="px-0.5 pb-1 text-center font-normal text-neutral-300 text-xs whitespace-nowrap">
                    {r === 'Crown Rare' ? '♛' : r}
                  </th>
                ))}
                <th />
                <th className="px-0.5 pb-1 text-center font-semibold text-neutral-400 text-xs uppercase tracking-wider">All</th>
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
                    <th scope="row" className={`${stickyCol} py-0.5 pr-2 text-left font-normal text-sm md:max-w-36 md:truncate`} title={name}>
                      <span className="text-neutral-200 text-xs tabular-nums md:mr-1.5 md:text-neutral-500">{e.id}</span>
                      <span className="hidden text-neutral-200 md:inline">{name}</span>
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
                  <span className="hidden md:inline">All sets</span>
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
      <Tooltip id="completion-heatmap" />
    </section>
  )
}
