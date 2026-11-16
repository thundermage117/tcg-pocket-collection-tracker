// Personal fork: which booster to open, ranked by the chance one pack gives a ☆☆ you want (Value) or by how many cards
// you're missing one pack gives on average (Completion).

import { useQuery } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Skeleton, SkeletonGrid } from '@/components/Skeleton'
import { ValueDataAge } from '@/components/ValueDataAge'
import { useUrlFilters } from '@/hooks/useUrlFilters'
import { bestTierOf, getBoosterValues } from '@/lib/packValue'
import { PROVISIONAL_VOTES } from '@/lib/ValueDB'
import { useAccount } from '@/services/account/useAccount'
import { userQuery } from '@/services/auth/useAuth'
import { useMainWithAlt } from '@/services/profile/useProfileCollection'
import { PackCard } from './components/PackCard'
import { PackControls } from './components/PackControls'
import { PackOdds } from './components/PackOdds'
import { PackSummary } from './components/PackSummary'
import {
  describeTarget,
  goalOptions,
  kindOptions,
  type PackRow,
  type Range,
  rarityOptions,
  raritySlug,
  showRarity,
  sortLabels,
  sortOptions,
  type TargetFilters,
  tierMax,
  tierOptions,
} from './types'

export default function PackValue() {
  const { data: user, isLoading: userLoading } = useQuery(userQuery)
  const { isLoading: accountLoading } = useAccount()
  const { data: collection, isLoading: collectionLoading } = useMainWithAlt()
  // logged in, collection on its way: "only missing" has to wait for it
  const collectionPending = userLoading || (Boolean(user) && (accountLoading || collectionLoading))
  const hasCollection = Boolean(collection) || collectionPending
  // filters live in the URL (?rarity=3d&tier=hot&kind=trainer&owned=1&series=B&hide=1); rarity, tier and style are
  // remembered for the next visit
  const { get, update } = useUrlFilters('packs-view', ['goal', 'rarity', 'tier', 'kind', 'sort'])
  const goal = goalOptions.find((x) => x === get('goal')) ?? 'value'
  const completion = goal === 'complete'
  // each goal has its own default rarity (completion: every card), so switching goal drops the rarity back to it
  const defaultRarity = completion ? 'all' : '☆☆'
  const rarity = rarityOptions.find((r) => raritySlug[r] === get('rarity')) ?? defaultRarity
  // global tiers: a rarity can't be A+ or S+ when none of its cards reach them (no ◊ is above B)
  const bestTier = bestTierOf(rarity)
  const reachable = (key: (typeof tierOptions)[number]) => key === 'all' || (bestTier !== undefined && bestTier <= tierMax[key])
  // every pack of a set gives a rarity at the same rate, so "any" only ranks anything once owned cards drop out; across
  // every rarity it hardly ranks even then (a pack nearly always has some common you're missing), so All starts on A+
  const defaultTier = rarity === 'all' || (!hasCollection && reachable('top')) ? 'top' : 'all'
  const wantedTier = tierOptions.find((x) => x === get('tier')) ?? defaultTier
  const tier = reachable(wantedTier) ? wantedTier : 'all'
  // styles are a ☆☆ thing (full art / trainer / rainbow)
  const kind = rarity === '☆☆' ? (kindOptions.find((x) => x === get('kind')) ?? 'all') : 'all'
  // "best hits" weighs each card by its tier, so it needs a rarity that has tiers (☆☆☆ and Crown Rare don't)
  const sort = !completion && bestTier !== undefined ? (sortOptions.find((x) => x === get('sort')) ?? 'odds') : 'odds'
  // without a collection every pack gives about five new cards: nothing to rank
  const ranked = !completion || hasCollection
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
  const score = (b: PackRow) => (completion ? b.expectedNew : sort === 'quality' ? b.weighted : b.perPack)
  const seriesOptions = useMemo(() => ['All', ...new Set(all.map((b) => b.expansionId[0]))], [all])
  const series = seriesOptions.find((x) => x === get('series')) ?? 'All'

  const packs = all
    .filter((b) => series === 'All' || b.expansionId.startsWith(series))
    .filter((b) => !(hideComplete && collection && b.missing === 0))
    // unranked packs stay in release order
    .toSorted((a, b) => (ranked ? score(b) - score(a) : 0))
  // against the best pack on show; scores start at zero so "twice as likely" looks twice as long
  const range: Range = { min: 0, max: Math.max(0, ...packs.map(score)) }
  // where each pack stands under the other Value ranking, so the two can be compared without flipping "Rank by"
  const otherScore = (b: PackRow) => (sort === 'quality' ? b.perPack : b.weighted)
  const otherRanks = new Map(
    completion || bestTier === undefined
      ? []
      : packs
          .filter((b) => otherScore(b) > 0)
          .toSorted((a, b) => otherScore(b) - otherScore(a))
          .map((b, i) => [b.id, { rank: i + 1, label: sortLabels[sort === 'quality' ? 'odds' : 'quality'].toLowerCase() }]),
  )

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
          ) : sort === 'quality' ? (
            <>
              Which pack is worth most to open: the chance of <span className="text-neutral-100">{describeTarget(filters)}</span>, with higher tiers counting
              for more.
            </>
          ) : (
            <>
              Which pack most often gives <span className="text-neutral-100">{describeTarget(filters)}</span>.
            </>
          )}
          {!hasCollection && ranked && ' Log in to count only what you’re missing.'}{' '}
          <button type="button" onClick={openHowItWorks} className="cursor-pointer underline underline-offset-2 hover:text-neutral-200">
            How this works
          </button>
        </p>
      </header>

      <PackControls
        goal={goal}
        rarity={rarity}
        defaultRarity={defaultRarity}
        tier={tier}
        defaultTier={defaultTier}
        reachable={reachable}
        sort={sort}
        canSortByQuality={bestTier !== undefined}
        kind={kind}
        onlyMissing={onlyMissing}
        series={series}
        seriesOptions={seriesOptions}
        hideComplete={hideComplete}
        hasCollection={hasCollection}
        collectionLoaded={Boolean(collection)}
        update={update}
      />

      {!waiting && packs.length > 0 && ranked && (
        <PackSummary pack={packs[0]} filters={filters} goal={goal} sort={sort} other={otherRanks.get(packs[0].id)}>
          {/* the "≥1 hit within n packs" curve sits at 100% for nearly every pack with a missing ◊, so completion skips it */}
          {!completion && <PackOdds packs={packs} filters={filters} />}
        </PackSummary>
      )}
      {!ranked && (
        <p className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3 text-sm text-neutral-300">
          Without your collection, every pack gives about five new cards, so there's nothing to rank. Log in to see which pack fills in the most of what you're
          missing. Until then the packs are in release order.
        </p>
      )}

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
              position={ranked ? i + 1 : undefined}
              filters={filters}
              goal={goal}
              sort={sort}
              other={otherRanks.get(pack.id)}
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
        <dl className="mt-3 space-y-3">
          {completion ? (
            <>
              <Faq q="What does “≈1.8 new cards per pack” mean?">
                On average, one pack gives that many cards you don't have yet. It's each missing card's chance to be in a pack, added up, using the real pull
                odds of every slot, rare packs included. A pack where you miss 40 cards beats one where you miss 3, even if both nearly always give something
                new.
              </Faq>
              <Faq q="Why does it start on All?">
                It ranks almost exactly as ◊–◊◊◊◊ alone would: ☆ and up come so rarely they barely move the number. They do count toward "Complete" and the
                owned bar, though. Pick one rarity to chase it alone.
              </Faq>
              <Faq q="What's the bar under each pack?">How much of that pack you already own. Count alt's cards adds what your alt can give you.</Faq>
            </>
          ) : (
            <>
              <Faq q="What does “1 in 59 packs” mean?">
                On average, one pack in 59 gives at least one card that counts: the chosen rarity, tier and style, and only ones you're missing unless you turn
                that off. It uses the real pull odds of every slot, rare packs included.
              </Faq>
              <Faq q="What does “Best hits” rank by?">
                Most likely ranks by the chance of any card that counts, so an A counts the same as an SSS. Best hits ranks a pack higher the more of its hits
                are top tier, so a pack that hits less often can still come first. Each pack's “Top hits” line shows why: how often one pack gives an S+ (S or
                better) and an SS+, in packs; for rarities with nothing that high, their own two best tiers. Behind the order, each card's chance is weighed by
                its tier (an S counts as two A, an SS as four, an SSS as eight, each tier below A as half the one above); that doubling is a rule of thumb, not
                a market price.
              </Faq>
              <Faq q="What's the bar under the odds?">
                How the pack compares with the best pack on show, so you can see how close the ranking is: under Most likely its odds as a share of the best
                pack's, under Best hits the same with higher tiers counting for more. Beside it is the pack's rank under the other ranking.
              </Faq>
              <Faq q="What are A+ and S+?">
                Value tiers, as on{' '}
                <Link to="/rankings" className="underline underline-offset-2 hover:text-neutral-200">
                  Rankings
                </Link>
                . S+ is SSS–S (S or better), A+ is SSS–A (A or better). ☆☆ are tiered by community votes (an Elo score from pokemontcglivetrade); every other
                rarity by trade demand (wishlists per trade offer, eleet). Under All, each card uses its own scale.
              </Faq>
              <Faq q="Why are A+ or S+ greyed out?">
                No card of that rarity reaches those tiers: commons aren't in demand enough (no ◊ is above B, no ◊◊ above A), and ☆☆☆ and Crown Rare can't be
                traded, so they have no tier.
              </Faq>
              <Faq q="What's the coloured strip on each pack?">
                Its cards split by tier. The bright part is the cards that count for the odds (the chosen tiers and style, and only ones you're missing unless
                you turn that off); the faded part is the rest. Hover it for the numbers.
              </Faq>
              <Faq q="What does “new expansion” mean?">
                Some ☆☆ in that pack have fewer than {PROVISIONAL_VOTES} votes, so their tiers may still move. Usual in an expansion's first month.
              </Faq>
              <Faq q="Which packs are left out?">Packs that can no longer be opened (Deluxe Pack: ex) and promos.</Faq>
            </>
          )}
        </dl>
      </details>
    </main>
  )
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-medium text-neutral-300">{q}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  )
}
