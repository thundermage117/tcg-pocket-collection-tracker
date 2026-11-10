// Personal fork: which booster to open if the pull were a guaranteed ☆☆.
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { CountAltSwitch } from '@/components/CountAltSwitch'
import { TabsFilter } from '@/components/Filters'
import { Spinner } from '@/components/Spinner'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ValueDataAge } from '@/components/ValueDataAge'
import { useUrlFilters } from '@/hooks/useUrlFilters'
import { getBoosterValues } from '@/lib/packValue'
import { PROVISIONAL_VOTES } from '@/lib/ValueDB'
import { useAccount } from '@/services/account/useAccount'
import { userQuery } from '@/services/auth/useAuth'
import { useMainWithAlt } from '@/services/profile/useProfileCollection'
import { PackCard } from './components/PackCard'
import { PackOdds } from './components/PackOdds'
import { PackSummary } from './components/PackSummary'
import { goals, type PackRow, personalSorts, type Range, type Ranges, type SortKey, sortOrder } from './types'

const rangeOf = (xs: number[]): Range => ({ min: Math.min(...xs), max: Math.max(...xs) })

export default function PackValue() {
  const { data: user, isLoading: userLoading } = useQuery(userQuery)
  const { isLoading: accountLoading } = useAccount()
  const { data: collection, isLoading: collectionLoading } = useMainWithAlt()
  // logged in, collection on its way: only the personal goal has to wait for it, the page renders now
  const collectionPending = userLoading || (Boolean(user) && (accountLoading || collectionLoading))
  // filters live in the URL (?goal=meanAdj&series=B&hide=1); the goal is remembered for the next visit
  const { get, update } = useUrlFilters('packs-view', ['goal'])
  const savedSort = sortOrder.find((key) => key === get('goal'))
  const hideComplete = get('hide') === '1'
  const [expanded, setExpanded] = useState<string | undefined>()

  // missing cards is the most useful goal once we know the collection; personal goals need one,
  // so fall back without forgetting the saved choice
  const hasCollection = Boolean(collection) || collectionPending
  const fallback: SortKey = hasCollection ? 'perPackNew' : 'perPackTop50'
  const sortKey: SortKey = !savedSort || (!hasCollection && personalSorts.includes(savedSort)) ? fallback : savedSort
  const waiting = collectionPending && personalSorts.includes(sortKey)

  const all: PackRow[] = useMemo(() => {
    const boosters = getBoosterValues(collection)
    const byValue = boosters.toSorted((a, b) => b.meanAdj - a.meanAdj)
    return boosters.map((b) => ({ ...b, id: `${b.expansionId}-${b.packName}`, valueRank: byValue.indexOf(b) + 1 }))
  }, [collection])

  const ranges: Ranges = useMemo(
    () => ({
      meanAdj: rangeOf(all.map((b) => b.meanAdj)),
      // odds and counts start at zero so "twice as likely" looks twice as long
      perPackTop50: rangeOf([0, ...all.map((b) => b.perPackTop50)]),
      perPackNew: rangeOf([0, ...all.map((b) => b.perPackNew)]),
      pTrainerOrRainbow: rangeOf([0, ...all.map((b) => b.pTrainerOrRainbow)]),
    }),
    [all],
  )
  const seriesOptions = useMemo(() => ['All', ...new Set(all.map((b) => b.expansionId[0]))], [all])
  const series = seriesOptions.find((x) => x === get('series')) ?? 'All'

  const packs = all
    .filter((b) => series === 'All' || b.expansionId.startsWith(series))
    .filter((b) => !(hideComplete && collection && b.pNew === 0))
    .toSorted((a, b) => b[sortKey] - a[sortKey])

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold sm:text-3xl">Best packs</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Which pack should you open? Pick what you're after and packs are ranked by how well they deliver it.
          {!hasCollection && ' Log in to rank packs by the ☆☆ you are still missing.'}
        </p>
        <ValueDataAge className="mt-2" />
      </header>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="px-0.5 text-[11px] font-medium uppercase tracking-wider text-neutral-400">I want…</span>
          <ToggleGroup
            type="single"
            value={sortKey}
            onValueChange={(v) => v && update({ goal: v === fallback ? undefined : v })}
            className="rounded-md border-1 border-neutral-700 bg-neutral-800"
          >
            {sortOrder.map((key) => (
              <ToggleGroupItem
                key={key}
                value={key}
                disabled={!hasCollection && personalSorts.includes(key)}
                title={!hasCollection && personalSorts.includes(key) ? 'Log in to use this' : undefined}
              >
                {goals[key].label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <TabsFilter label="Series" options={seriesOptions} value={series} onChange={(x) => update({ series: x === 'All' ? undefined : x })} />
          {collection && (
            <label htmlFor="packs-hide-complete" className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-neutral-300">
              <Switch id="packs-hide-complete" checked={hideComplete} onCheckedChange={(on) => update({ hide: on ? '1' : undefined })} />
              Hide fully owned
            </label>
          )}
          <CountAltSwitch id="packs-count-alt" className="pb-2" />
        </div>
      </div>

      {!waiting && packs.length > 0 && <PackSummary pack={packs[0]} sortKey={sortKey} total={all.length} />}
      {!waiting && <PackOdds packs={packs} sortKey={sortKey} />}

      {waiting ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : packs.length === 0 ? (
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
              total={all.length}
              expanded={expanded === pack.id}
              onToggle={() => setExpanded(expanded === pack.id ? undefined : pack.id)}
            />
          ))}
        </div>
      )}

      <details className="mt-8 rounded-lg border border-neutral-800 px-4 py-3 text-sm text-neutral-400">
        <summary className="cursor-pointer font-medium text-neutral-300">How this works</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Card value is an Elo score from community votes on pokemontcglivetrade. Cards with few votes are pulled toward the average so a handful of votes
            can't make them look great or terrible.
          </li>
          <li>"1 in N packs" uses the real pull odds of every slot, rare packs included. The more ☆☆ a pack shares its slots with, the rarer each one is.</li>
          <li>Counts like "12 top-50" are out of that pack's ☆☆ list. Every ☆☆ in a pack is equally likely to be pulled.</li>
          <li>
            "provisional" means at least one card has fewer than {PROVISIONAL_VOTES} votes, so its value may still move (usual in a set's first month). Packs
            that can no longer be opened (Deluxe Pack: ex) are left out.
          </li>
        </ul>
      </details>
    </main>
  )
}
