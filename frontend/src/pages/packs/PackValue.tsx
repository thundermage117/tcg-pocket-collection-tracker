// Personal fork: which booster to open, ranked by the chance one pack gives a ☆☆ you want (Value) or by how many cards
// you're missing one pack gives on average (Completion).

import { useQuery } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { CountAltSwitch } from '@/components/CountAltSwitch'
import { TabsFilter } from '@/components/Filters'
import { Skeleton, SkeletonGrid } from '@/components/Skeleton'
import { TierChip } from '@/components/TierChip'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ValueDataAge } from '@/components/ValueDataAge'
import { useUrlFilters } from '@/hooks/useUrlFilters'
import { bestTierOf, getBoosterValues } from '@/lib/packValue'
import { tiers } from '@/lib/rankings'
import { PROVISIONAL_VOTES } from '@/lib/ValueDB'
import { useAccount } from '@/services/account/useAccount'
import { userQuery } from '@/services/auth/useAuth'
import { useMainWithAlt } from '@/services/profile/useProfileCollection'
import { PackCard } from './components/PackCard'
import { PackOdds } from './components/PackOdds'
import { PackSummary } from './components/PackSummary'
import {
  completionRarityOptions,
  describeTarget,
  goalLabels,
  goalOptions,
  kindOptions,
  type PackRow,
  type Range,
  rarityOptions,
  raritySlug,
  scaleName,
  showKind,
  showRarity,
  type TargetFilters,
  tierLabel,
  tierMax,
  tierOptions,
} from './types'

const countOptions = ['missing', 'any'] as const
const countLabels = { missing: "I'm missing", any: 'Every card' }

export default function PackValue() {
  const { data: user, isLoading: userLoading } = useQuery(userQuery)
  const { isLoading: accountLoading } = useAccount()
  const { data: collection, isLoading: collectionLoading } = useMainWithAlt()
  // logged in, collection on its way: "only missing" has to wait for it
  const collectionPending = userLoading || (Boolean(user) && (accountLoading || collectionLoading))
  const hasCollection = Boolean(collection) || collectionPending
  // filters live in the URL (?rarity=3d&tier=hot&kind=trainer&owned=1&series=B&hide=1); rarity, tier and style are
  // remembered for the next visit
  const { get, update } = useUrlFilters('packs-view', ['goal', 'rarity', 'tier', 'kind'])
  const goal = goalOptions.find((x) => x === get('goal')) ?? 'value'
  const completion = goal === 'complete'
  // each goal has its own default rarity, so switching goal drops the rarity back to it
  const defaultRarity = completion ? 'diamonds' : '☆☆'
  const rarity = (completion ? completionRarityOptions : rarityOptions).find((r) => raritySlug[r] === get('rarity')) ?? defaultRarity
  // global tiers: a rarity can't be Top or Hot when none of its cards reach them (no ◊ is above B)
  const bestTier = bestTierOf(rarity)
  const reachable = (key: (typeof tierOptions)[number]) => key === 'all' || (bestTier !== undefined && bestTier <= tierMax[key])
  // every pack of a set gives a rarity at the same rate, so "any" only ranks anything once owned cards drop out; across
  // every rarity it hardly ranks even then (a pack nearly always has some common you're missing), so All starts on Top
  const defaultTier = rarity === 'all' || (!hasCollection && reachable('top')) ? 'top' : 'all'
  const wantedTier = tierOptions.find((x) => x === get('tier')) ?? defaultTier
  const tier = reachable(wantedTier) ? wantedTier : 'all'
  // styles are a ☆☆ thing (full art / trainer / rainbow)
  const kind = rarity === '☆☆' ? (kindOptions.find((x) => x === get('kind')) ?? 'all') : 'all'
  // completion counts every card you're missing, whatever its tier or style
  const onlyMissing = hasCollection && (completion || get('owned') !== '1')
  const hideComplete = get('hide') === '1'
  const waiting = collectionPending && onlyMissing
  const [expanded, setExpanded] = useState<string | undefined>()
  const howItWorks = useRef<HTMLDetailsElement>(null)
  const openHowItWorks = () => {
    if (howItWorks.current) {
      howItWorks.current.open = true
      howItWorks.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const filters: TargetFilters = useMemo(
    () =>
      completion
        ? { rarity, tier: 'all', maxTier: tierMax.all, onlyMissing, everyCard: true }
        : { rarity, tier, maxTier: tierMax[tier], kind: kind === 'all' ? undefined : kind, onlyMissing },
    [completion, rarity, tier, kind, onlyMissing],
  )

  const all: PackRow[] = useMemo(
    () => getBoosterValues(collection, filters).map((b) => ({ ...b, id: `${b.expansionId}-${b.packName}` })),
    [collection, filters],
  )
  const score = (b: PackRow) => (completion ? b.expectedNew : b.perPack)
  // odds start at zero so "twice as likely" looks twice as long
  const range: Range = useMemo(() => ({ min: 0, max: Math.max(0, ...all.map((b) => (completion ? b.expectedNew : b.perPack))) }), [all, completion])
  const seriesOptions = useMemo(() => ['All', ...new Set(all.map((b) => b.expansionId[0]))], [all])
  const series = seriesOptions.find((x) => x === get('series')) ?? 'All'

  const packs = all
    .filter((b) => series === 'All' || b.expansionId.startsWith(series))
    .filter((b) => !(hideComplete && collection && b.missing === 0))
    .toSorted((a, b) => score(b) - score(a))

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold sm:text-3xl">Best packs</h1>
        {/* the question the page answers, in the words of the current filters; the details live in "How this works" */}
        <p className="mt-1 text-sm text-neutral-400">
          {completion ? (
            <>
              Which pack fills in <span className="text-neutral-100">{rarity === 'all' ? 'your collection' : `your ${showRarity(rarity)} cards`}</span> fastest.
            </>
          ) : (
            <>
              Which pack most often gives <span className="text-neutral-100">{describeTarget(filters)}</span>.
            </>
          )}
          {!hasCollection && ' Log in to count only what you’re missing.'}{' '}
          <button type="button" onClick={openHowItWorks} className="cursor-pointer underline underline-offset-2 hover:text-neutral-200">
            How this works
          </button>
        </p>
      </header>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-4">
          <TabsFilter
            label="Goal"
            options={goalOptions}
            value={goal}
            show={(x) => goalLabels[x]}
            onChange={(x) => update({ goal: x === 'value' ? undefined : x, rarity: undefined, owned: undefined })}
          />
          {/* what every number on the page counts, so it comes first */}
          {hasCollection && !completion && (
            <TabsFilter
              label="Cards"
              options={countOptions}
              value={onlyMissing ? 'missing' : 'any'}
              show={(x) => countLabels[x]}
              onChange={(x) => update({ owned: x === 'missing' ? undefined : '1' })}
            />
          )}
          <TabsFilter
            label="Rarity"
            options={completion ? completionRarityOptions : rarityOptions}
            value={rarity}
            show={showRarity}
            onChange={(r) => update({ rarity: r === defaultRarity ? undefined : raritySlug[r] })}
          />
          {!completion && (
            <div className="flex flex-col gap-1">
              <span className="px-0.5 text-[11px] font-medium uppercase tracking-wider text-neutral-400">Rank by chance of pulling…</span>
              <ToggleGroup
                type="single"
                value={tier}
                onValueChange={(v) => v && update({ tier: v === defaultTier ? undefined : v })}
                className="rounded-md border-1 border-neutral-700 bg-neutral-800"
              >
                {tierOptions.map((key) => (
                  <ToggleGroupItem
                    key={key}
                    value={key}
                    disabled={!reachable(key)}
                    title={reachable(key) ? tierLabel(key, rarity) : `No ${rarity} is in ${key === 'hot' ? 'SSS–S' : 'SSS–A'} (${scaleName(rarity)} tiers)`}
                    className="gap-1.5 px-3"
                  >
                    {key === 'all' ? (
                      tierLabel('all', rarity)
                    ) : (
                      <>
                        <span className="flex gap-0.5">
                          {tiers.slice(0, tierMax[key] + 1).map((t) => (
                            <TierChip key={t.name} tier={t} />
                          ))}
                        </span>
                        {key === 'hot' ? 'Hot' : 'Top'}
                      </>
                    )}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          )}
          {rarity === '☆☆' && !completion && (
            <TabsFilter label="Style" options={kindOptions} value={kind} show={showKind} onChange={(x) => update({ kind: x === 'all' ? undefined : x })} />
          )}
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

      {!waiting && packs.length > 0 && <PackSummary pack={packs[0]} filters={filters} goal={goal} />}
      {/* the "≥1 hit within n packs" curve sits at 100% for nearly every pack with a missing ◊, so completion skips it */}
      {!waiting && !completion && <PackOdds packs={packs} filters={filters} />}

      {waiting ? (
        <>
          <Skeleton className="mb-6 h-36" />
          <SkeletonGrid count={6} className="gap-4 sm:grid-cols-2 lg:grid-cols-3" itemClassName="h-80" />
        </>
      ) : packs.length === 0 ? (
        <p className="py-12 text-center text-neutral-400">No packs match these filters.</p>
      ) : (
        <div className="grid grid-flow-row-dense gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packs.map((pack, i) => (
            <PackCard
              key={pack.id}
              pack={pack}
              position={i + 1}
              filters={filters}
              goal={goal}
              range={range}
              expanded={expanded === pack.id}
              onToggle={() => setExpanded(expanded === pack.id ? undefined : pack.id)}
            />
          ))}
        </div>
      )}

      <details ref={howItWorks} className="mt-8 scroll-mt-20 rounded-lg border border-neutral-800 px-4 py-3 text-sm text-neutral-400">
        <summary className="cursor-pointer font-medium text-neutral-300">How this works</summary>
        {!completion && <ValueDataAge className="mt-2" />}
        {completion ? (
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Completion ranks packs by how many cards you're missing one pack gives on average: each missing card's chance to be in a pack, added up, using the
              real pull odds of every slot, rare packs included. Unlike "chance of a new card", it keeps telling packs apart while you still miss commons: a
              pack with 40 missing ◊ beats one with 3.
            </li>
            <li>
              It starts on ◊–◊◊◊◊, what "complete" usually means. Pick a single rarity to chase it alone, or All to count ☆ and up too (they barely move the
              number: a pack gives one so rarely).
            </li>
            <li>The bar under each pack is how much of it you own. Count alt's cards adds what your alt can give you.</li>
          </ul>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Two scales, as on{' '}
              <Link to="/rankings" className="underline underline-offset-2 hover:text-neutral-200">
                Rankings
              </Link>
              . ☆☆ use the vote tiers: an Elo score from community votes on pokemontcglivetrade, with few-vote cards pulled toward the average, split where the
              Elo jumps. Every other rarity uses the Most wanted tiers: wishlists per trade-list offer (eleet), split by share (SSS is the top 1% of every
              traded card).
            </li>
            <li>
              Most wanted tiers are shared by every rarity, so a common rarity can't reach the top ones: no ◊ is above B and no ◊◊ above A, so Top or Hot is
              switched off there. ☆☆☆ and Crown Rare can't be traded and have no tier. Hot is SSS–S, Top is SSS–A.
            </li>
            <li>
              All counts every rarity at once, each card on its own scale (☆☆ by vote, the rest by Most wanted), so "Top" means any card in its scale's SSS–A.
              It starts on Top: with every rarity, nearly every pack has some common you're missing.
            </li>
            <li>
              "1 in N packs" uses the real pull odds of every slot, rare packs included, for the cards that match the rarity, tier, style and "only missing"
              choice. The more cards of a rarity a pack shares its slots with, the rarer each one is.
            </li>
            <li>The strip on each pack shows how many of its cards fall in each tier (grey: no tier); the faded part is what you already own.</li>
            <li>
              "provisional" (☆☆ only) means at least one card has fewer than {PROVISIONAL_VOTES} votes, so its value and tier may still move (usual in a set's
              first month). Packs that can no longer be opened (Deluxe Pack: ex) are left out.
            </li>
          </ul>
        )}
      </details>
    </main>
  )
}
