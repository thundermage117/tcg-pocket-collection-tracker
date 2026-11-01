// Personal fork: card tier lists — ☆☆ community Elo and most-wanted by trade demand.
// Tab and filters live in the URL (?tab=wanted&set=B1&foils=1&q=…), so links, refresh and back keep the view.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { DropdownFilter, TabsFilter } from '@/components/Filters'
import RarityFilter from '@/components/filters/RarityFilter'
import SearchInput from '@/components/filters/SearchInput'
import { Spinner } from '@/components/Spinner'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ValueDataAge } from '@/components/ValueDataAge'
import { expansions, getExpansionById } from '@/lib/CardsDB'
import { ownsCard } from '@/lib/packValue'
import { getMostWanted, getTwoStarRanking, type RankedCard, tiers, wantedShares } from '@/lib/rankings'
import { getCardNameByLang } from '@/lib/utils'
import { isProvisional, kindLabel, PROVISIONAL_VOTES, type TwoStarKind } from '@/lib/ValueDB'
import { useCollection, useSelectedCard } from '@/services/collection/useCollection'
import { type ExpansionId, type Rarity, rarities } from '@/types'
import { TierSection } from './components/TierSection'

type Tab = 'elo' | 'wanted'
type KindOption = 'all' | TwoStarKind

// a filtered list this small opens every tier
const SMALL_LIST = 60
const kindOptions: KindOption[] = ['all', 'full_art', 'trainer', 'rainbow']

const rankings: Record<Tab, RankedCard[]> = { elo: getTwoStarRanking(), wanted: getMostWanted() }
const wantedWithFoils = getMostWanted(true)

const setOptions = (list: RankedCard[]): ('all' | ExpansionId)[] => {
  const present = new Set(list.map((e) => e.card.expansion))
  return ['all', ...expansions.filter((e) => present.has(e.id)).map((e) => e.id)]
}
const setsByTab: Record<Tab, ('all' | ExpansionId)[]> = { elo: setOptions(rankings.elo), wanted: setOptions(wantedWithFoils) }

const scores: Record<Tab, (e: RankedCard) => string> = {
  elo: ({ value }) => `${value.adj}${isProvisional(value) ? '*' : ''}`,
  wanted: ({ score }) => `×${score.toFixed(1)}`,
}

// ☆☆ tiers end where the Elo jumps, so they read as Elo ranges; most-wanted tiers are fixed shares
const eloRanges = tiers.map((_, i) => {
  const scores = rankings.elo.filter((e) => e.tier === i).map((e) => e.score)
  return scores.length === 0 ? '' : `Elo ${Math.min(...scores)}–${Math.max(...scores)}`
})
const tierRange = (tab: Tab, i: number) => {
  if (tab === 'elo') {
    return eloRanges[i]
  }
  const pct = (x: number) => Math.round(100 * x)
  if (i === 0) {
    return `Top ${pct(wantedShares[0])}%`
  }
  if (i === tiers.length - 1) {
    return `Bottom ${pct(1 - wantedShares[i - 1])}%`
  }
  return `Top ${pct(wantedShares[i - 1])}–${pct(wantedShares[i])}%`
}

const defaultOpen = new Set(['SSS', 'SS', 'S', 'A'])

export default function Rankings() {
  const { t, i18n } = useTranslation('common/sets')
  const { data: collection, isLoading } = useCollection()
  const { setSelectedCardId } = useSelectedCard()
  const [params, setParams] = useSearchParams()
  const [open, setOpen] = useState(defaultOpen)
  const [showAll, setShowAll] = useState(new Set<string>())

  // defaults are left out of the URL; unknown values fall back to them
  const tab: Tab = params.get('tab') === 'wanted' ? 'wanted' : 'elo'
  const search = params.get('q') ?? ''
  const set = setsByTab[tab].find((id) => id === params.get('set')) ?? 'all'
  const kind = kindOptions.find((k) => k === params.get('kind')) ?? 'all'
  const rarityFilter = (params.get('rarity')?.split(',') ?? []).filter((r): r is Rarity => (rarities as readonly string[]).includes(r))
  const missingOnly = params.get('missing') === '1'
  const foils = tab === 'wanted' && params.get('foils') === '1'
  const ranking = foils ? wantedWithFoils : rankings[tab]

  // every filter change collapses tiers back to their previews
  const update = (changes: Record<string, string | undefined>) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(changes)) {
          if (value) {
            next.set(key, value)
          } else {
            next.delete(key)
          }
        }
        return next
      },
      { replace: true },
    )
    setShowAll(new Set())
  }
  const toggle = (set: Set<string>, name: string) => (set.has(name) ? new Set([...set].filter((n) => n !== name)) : new Set([...set, name]))

  if (isLoading) {
    return <Spinner size="lg" overlay />
  }

  const owned = (card: RankedCard['card']) => ownsCard(collection, card)
  const query = search.trim().toLowerCase()
  const filtered = ranking.filter(
    (e) =>
      (set === 'all' || e.card.expansion === set) &&
      (tab !== 'elo' || kind === 'all' || e.value.kind === kind) &&
      (tab !== 'wanted' || rarityFilter.length === 0 || rarityFilter.includes(e.card.rarity)) &&
      (!missingOnly || !collection || !owned(e.card)) &&
      (!query || getCardNameByLang(e.card, i18n.language).toLowerCase().includes(query)),
  )
  const byTier = tiers.map((_, i) => filtered.filter((e) => e.tier === i))
  const openAll = filtered.length <= SMALL_LIST

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold sm:text-3xl">Card rankings</h1>
        <p className="mt-1 text-sm text-neutral-400">
          {tab === 'elo'
            ? 'All ☆☆ cards by community vote Elo (pokemontcglivetrade), adjusted for vote count. Tiers split where the Elo jumps.'
            : 'Every rarity by trade demand: wishlists per trade-list offer (eleet), adjusted for how many are listed. Reprints count as their original.'}
        </p>
        <ValueDataAge className="mt-2" />
      </header>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          update({ tab: v === 'wanted' ? 'wanted' : undefined, set: undefined, kind: undefined, rarity: undefined, foils: undefined })
          setOpen(defaultOpen)
        }}
        className="mb-4"
      >
        <TabsList className="inline-flex rounded-md border-1 border-neutral-700 bg-neutral-800">
          <TabsTrigger className="rounded-sm" value="elo">
            ☆☆ Elo
          </TabsTrigger>
          <TabsTrigger className="rounded-sm" value="wanted">
            Most wanted
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <SearchInput value={search} setValue={(q) => update({ q: q.trim() || undefined })} className="sm:flex-1" />
          <DropdownFilter
            label="Set"
            options={setsByTab[tab]}
            value={set}
            onChange={(id) => update({ set: id === 'all' ? undefined : id })}
            show={(id) => (id === 'all' ? 'All sets' : t(getExpansionById(id).name))}
            className="sm:w-64"
          />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {tab === 'elo' ? (
            <TabsFilter
              options={kindOptions}
              value={kind}
              onChange={(k) => update({ kind: k === 'all' ? undefined : k })}
              show={(k) => (k === 'all' ? 'All kinds' : kindLabel[k])}
            />
          ) : (
            <>
              <RarityFilter rarityFilter={rarityFilter} setRarityFilter={(r) => update({ rarity: r.join(',') || undefined })} />
              <label htmlFor="rankings-foils" className="flex cursor-pointer items-center gap-2 text-sm text-neutral-300">
                <Switch id="rankings-foils" checked={foils} onCheckedChange={(on) => update({ foils: on ? '1' : undefined })} />
                Deluxe foils
              </label>
            </>
          )}
          {collection && (
            <label htmlFor="rankings-missing-only" className="flex cursor-pointer items-center gap-2 text-sm text-neutral-300">
              <Switch id="rankings-missing-only" checked={missingOnly} onCheckedChange={(on) => update({ missing: on ? '1' : undefined })} />
              Missing only
            </label>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-neutral-400">No cards match these filters.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {tiers.map((tier, i) =>
            byTier[i].length === 0 ? null : (
              <TierSection
                key={tier.name}
                tier={tier}
                range={tierRange(tab, i)}
                entries={byTier[i]}
                score={scores[tab]}
                owned={owned}
                showOwned={collection !== undefined && !missingOnly}
                open={openAll || open.has(tier.name)}
                showAll={showAll.has(tier.name)}
                onToggle={() => setOpen(toggle(open, tier.name))}
                onShowAll={() => setShowAll(toggle(showAll, tier.name))}
                onSelect={(c) => setSelectedCardId(c.internal_id)}
              />
            ),
          )}
          {tab === 'elo' && <p className="text-xs text-neutral-500">* fewer than {PROVISIONAL_VOTES} votes, still settling.</p>}
        </div>
      )}
    </main>
  )
}
