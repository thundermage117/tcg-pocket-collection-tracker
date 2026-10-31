// Personal fork: which booster to open if the pull were a guaranteed ☆☆.
import { useMemo, useState } from 'react'
import { TabsFilter } from '@/components/Filters'
import { Spinner } from '@/components/Spinner'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ValueDataAge } from '@/components/ValueDataAge'
import { getBoosterValues } from '@/lib/packValue'
import { PROVISIONAL_VOTES } from '@/lib/ValueDB'
import { useCollection } from '@/services/collection/useCollection'
import { PackCard } from './components/PackCard'
import { PackSummary } from './components/PackSummary'
import { type PackRow, personalSorts, type Range, type Ranges, type SortKey } from './types'

const sortOptions: { key: SortKey; label: string }[] = [
  { key: 'meanAdj', label: 'Value' },
  { key: 'forMe', label: 'Value for me' },
  { key: 'perPackTop50', label: 'Top 50 per pack' },
  { key: 'perPackNew', label: 'New per pack' },
  { key: 'pTrainerOrRainbow', label: 'Trainer / rainbow' },
]

const SORT_STORAGE_KEY = 'pack-value-sort'

function loadSort(): SortKey {
  try {
    const saved = localStorage.getItem(SORT_STORAGE_KEY)
    return sortOptions.some((o) => o.key === saved) ? (saved as SortKey) : 'meanAdj'
  } catch {
    return 'meanAdj'
  }
}

const rangeOf = (xs: number[]): Range => ({ min: Math.min(...xs), max: Math.max(...xs) })

export default function PackValue() {
  const { data: collection, isLoading } = useCollection()
  const [savedSort, setSavedSort] = useState<SortKey>(loadSort)
  const [series, setSeries] = useState('All')
  const [hideComplete, setHideComplete] = useState(false)
  const [expanded, setExpanded] = useState<string | undefined>()

  // personal sorts need a collection; fall back without forgetting the saved choice
  const sortKey: SortKey = !collection && personalSorts.includes(savedSort) ? 'meanAdj' : savedSort

  const all: PackRow[] = useMemo(
    () =>
      getBoosterValues(collection).map((b) => ({
        ...b,
        id: `${b.expansionId}-${b.packName}`,
        forMe: b.pNew * (b.meanAdjNew ?? 0),
      })),
    [collection],
  )

  const ranges: Ranges = useMemo(
    () => ({
      meanAdj: rangeOf(all.map((b) => b.meanAdj)),
      forMe: rangeOf(all.map((b) => b.forMe).filter((x) => x > 0)),
      // odds bars start at zero so "twice as likely" looks twice as long
      perPackTop50: rangeOf([0, ...all.map((b) => b.perPackTop50)]),
      perPackNew: rangeOf([0, ...all.map((b) => b.perPackNew)]),
    }),
    [all],
  )
  const seriesOptions = useMemo(() => ['All', ...new Set(all.map((b) => b.expansionId[0]))], [all])

  const packs = all
    .filter((b) => series === 'All' || b.expansionId.startsWith(series))
    .filter((b) => !(hideComplete && collection && b.pNew === 0))
    .toSorted((a, b) => b[sortKey] - a[sortKey])

  const changeSort = (key: SortKey) => {
    setSavedSort(key)
    try {
      localStorage.setItem(SORT_STORAGE_KEY, key)
    } catch {
      // storage unavailable: keep the choice for this visit only
    }
  }

  if (isLoading) {
    return <Spinner size="lg" overlay />
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold sm:text-3xl">Best packs</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Which pack to open for the best ☆☆, ranked by the community value of the cards it can pull.
          {!collection && ' Log in to see which packs are best for your collection.'}
        </p>
        <ValueDataAge className="mt-2" />
      </header>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="px-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-500">Sort by</span>
          <ToggleGroup
            type="single"
            value={sortKey}
            onValueChange={(v) => v && changeSort(v as SortKey)}
            className="rounded-md border-1 border-neutral-700 bg-neutral-800"
          >
            {sortOptions.map((o) => (
              <ToggleGroupItem
                key={o.key}
                value={o.key}
                disabled={!collection && personalSorts.includes(o.key)}
                title={!collection && personalSorts.includes(o.key) ? 'Log in to use this sort' : undefined}
              >
                {o.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <TabsFilter label="Series" options={seriesOptions} value={series} onChange={setSeries} />
          {collection && (
            <label htmlFor="packs-hide-complete" className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-neutral-300">
              <Switch id="packs-hide-complete" checked={hideComplete} onCheckedChange={setHideComplete} />
              Hide fully owned
            </label>
          )}
        </div>
      </div>

      {packs.length > 0 && <PackSummary pack={packs[0]} sortKey={sortKey} />}

      {packs.length === 0 ? (
        <p className="py-12 text-center text-neutral-400">No packs match these filters.</p>
      ) : (
        <div className="grid grid-flow-row-dense gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packs.map((pack, i) => (
            <PackCard
              key={pack.id}
              pack={pack}
              position={i + 1}
              sortKey={sortKey}
              ranges={ranges}
              expanded={expanded === pack.id}
              onToggle={() => setExpanded(expanded === pack.id ? undefined : pack.id)}
            />
          ))}
        </div>
      )}

      <details className="mt-8 rounded-lg border border-neutral-800 px-4 py-3 text-sm text-neutral-400">
        <summary className="cursor-pointer font-medium text-neutral-300">How this works</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Value = community vote Elo from pokemontcglivetrade, shrunk toward the average for cards with few votes.</li>
          <li>
            Every ☆☆ in a pack is equally likely, so Value, Top 50 chance and Trainer / rainbow are plain averages over the pack's ☆☆ pool. Packs that can no
            longer be opened (Deluxe Pack: ex) are excluded.
          </li>
          <li>"Per pack opened" uses the real pull odds of every slot, rare packs included, so it also reflects how many ☆☆ share the pool.</li>
          <li>Value for me = chance the ☆☆ is new to you × average value of the ones you're missing. Duplicates count as worthless.</li>
          <li>
            Provisional / * = at least one card has fewer than {PROVISIONAL_VOTES} votes and its value is still settling (typical in a set's first month).
          </li>
        </ul>
      </details>
    </main>
  )
}
