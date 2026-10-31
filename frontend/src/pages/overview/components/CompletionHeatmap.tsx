import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Tooltip } from 'react-tooltip'
import { expansions } from '@/lib/CardsDB.ts'
import { type Card, type Rarity, rarities } from '@/types'

interface Props {
  availableCards: Card[]
  collectedCards: Card[]
}

interface Cell {
  collected: number
  available: number
}

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

export function CompletionHeatmap({ availableCards, collectedCards }: Props) {
  const { t } = useTranslation(['common/sets'])
  const navigate = useNavigate()

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

  const openCollection = (expansion: string, rarity: Rarity | 'all') => {
    const params = new URLSearchParams({ ownership: 'missing' })
    if (expansion !== 'all') {
      params.set('expansion', expansion)
    }
    if (rarity !== 'all') {
      params.set('rarity', rarity)
    }
    navigate(`/collection?${params}`)
  }

  const renderCell = (row: string, col: Rarity | 'all', label: string, isTotal = false) => {
    const c = cell(row, col)
    if (!c) {
      return <td key={col} className="p-0.5" />
    }
    const missing = c.available - c.collected
    return (
      <td key={col} className="p-0.5">
        <button
          type="button"
          className={`w-full min-w-11 rounded py-1.5 text-xs tabular-nums transition-[filter] hover:brightness-125 focus-visible:outline-2 focus-visible:outline-neutral-200 ${isTotal ? 'font-semibold' : ''}`}
          style={cellStyle(c)}
          onClick={() => openCollection(row, col)}
          data-tooltip-id="completion-heatmap"
          data-tooltip-content={`${label}: ${c.collected} / ${c.available}${missing > 0 ? ` · ${missing} missing` : ' · complete'}`}
          aria-label={`${label}: ${c.collected} of ${c.available} collected`}
        >
          {formatPct(c)}
        </button>
      </td>
    )
  }

  if (columns.length === 0) {
    return null
  }

  return (
    <section className="mt-4 rounded-lg border border-neutral-700 bg-neutral-800 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-semibold text-base sm:text-lg">Completion by rarity</h2>
        <p className="text-neutral-400 text-xs">Darker means more gaps. Click a cell to see the missing cards.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-neutral-800 pr-2 text-left font-semibold text-neutral-400 text-xs uppercase tracking-wider">Set</th>
              {columns.map((r) => (
                <th key={r} className="px-0.5 pb-1 text-center font-normal text-neutral-300 text-xs whitespace-nowrap">
                  {r === 'Crown Rare' ? '♛' : r}
                </th>
              ))}
              <th />
              <th className="px-0.5 pb-1 text-center font-semibold text-neutral-400 text-xs uppercase tracking-wider">All</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const name = t(e.name, { ns: 'common/sets' })
              return (
                <tr key={e.id}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 max-w-36 truncate bg-neutral-800 py-0.5 pr-2 text-left font-normal text-neutral-200 text-sm"
                    title={name}
                  >
                    <span className="mr-1.5 text-neutral-500 text-xs tabular-nums">{e.id}</span>
                    {name}
                  </th>
                  {columns.map((r) => renderCell(e.id, r, `${name} ${r}`))}
                  <td className="w-2" />
                  {renderCell(e.id, 'all', name, true)}
                </tr>
              )
            })}
            <tr>
              <th scope="row" className="sticky left-0 z-10 bg-neutral-800 pt-2 pr-2 text-left font-semibold text-neutral-400 text-xs uppercase tracking-wider">
                All sets
              </th>
              {columns.map((r) => renderCell('all', r, `All sets ${r}`, true))}
              <td />
              {renderCell('all', 'all', 'All sets', true)}
            </tr>
          </tbody>
        </table>
      </div>
      <Tooltip id="completion-heatmap" />
    </section>
  )
}
