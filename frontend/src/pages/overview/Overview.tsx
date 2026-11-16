import { Siren, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMediaQuery } from 'react-responsive'
import { CountAltSwitch } from '@/components/CountAltSwitch'
import { DropdownFilter } from '@/components/Filters'
import Footer from '@/components/Footer.tsx'
import DeckbuildingFilter from '@/components/filters/DeckbuildingFilter'
import RarityFilter from '@/components/filters/RarityFilter'
import { Skeleton } from '@/components/Skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTitle } from '@/components/ui/alert.tsx'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useUrlFilters } from '@/hooks/useUrlFilters'
import { getFilteredCards } from '@/lib/filters'
import { getBoosterValues } from '@/lib/packValue'
import { CollectionRing } from '@/pages/overview/components/CollectionRing'
import { CompletionHeatmap } from '@/pages/overview/components/CompletionHeatmap.tsx'
import { LuckLine } from '@/pages/overview/components/LuckLine'
import { TierTile } from '@/pages/overview/components/TierTile'
import { TodayPanel } from '@/pages/overview/components/TodayPanel'
import { bestChance, getPackChances } from '@/pages/overview/packChances'
import { countByTier, inValue, type ValueOption, valueLabels, valueOptions } from '@/pages/overview/valueTiers'
import { useCountAlt } from '@/services/profile/useProfile'
import { useMainWithAlt } from '@/services/profile/useProfileCollection'
import { type Card, type CollectionRow, type Rarity, rarities } from '@/types'

function Overview() {
  const { data: ownedCards = new Map<number, CollectionRow>(), isLoading, covered } = useMainWithAlt()
  const countAlt = useCountAlt()
  const isPhone = useMediaQuery({ query: '(max-width: 639px)' }) // below tailwind "sm"
  const [sheetOpen, setSheetOpen] = useState(false)

  const { t } = useTranslation(['pages/overview', 'filters', 'common/sets', 'common/packs', 'expansion-overview'])

  // personal fork: filters live in the URL (?rarity=☆☆&deck=1&value=top&cells=left) and are remembered for the next visit.
  // No copies filter: a card counts as collected with one copy.
  const { get, update } = useUrlFilters('overview-view', ['rarity', 'deck', 'value', 'cells'])
  const rarityParam = get('rarity')
  const deckbuildingMode = get('deck') === '1'
  const value = valueOptions.find((v) => v === get('value')) ?? 'all'
  const filters = useMemo(
    () => ({
      rarity: (rarityParam?.split(',') ?? []).filter((r): r is Rarity => (rarities as readonly string[]).includes(r)),
      deckbuildingMode,
      value,
    }),
    [rarityParam, deckbuildingMode, value],
  )

  // Memoized so the pack odds (a pullRate per pack) only rerun when the collection or filters change
  const { availableCards, collectedCards, tierCounts, chances } = useMemo(() => {
    const allAvailable = getFilteredCards(filters, ownedCards)
    const allCollected = getFilteredCards({ ...filters, minNumber: 1 }, ownedCards)
    // Value keeps only cards in the chosen Most wanted tiers, so the ring, the pick and the heatmap count just those
    const valued = (cards: Card[]) => (filters.value === 'all' ? cards : cards.filter((c) => inValue(filters.value, c.internal_id)))
    const availableCards = valued(allAvailable)
    const collectedCards = valued(allCollected)
    const wantedCards = valued(getFilteredCards({ ...filters, maxNumber: 0 }, ownedCards))
    return {
      availableCards,
      collectedCards,
      // before the Value filter, so the tier tile always shows every tier and just dims the ones left out
      tierCounts: countByTier(allAvailable, allCollected),
      chances: getPackChances(availableCards, collectedCards, wantedCards, filters.deckbuildingMode),
    }
  }, [filters, ownedCards])
  const bestPack = bestChance([...chances.values()].flat())
  // The ☆☆ pick ignores the filters, so only show it when ☆☆ cards are in view (deckbuilding mode hides alternate arts like ☆☆)
  const showTwoStarPick = !filters.deckbuildingMode && filters.value === 'all' && (filters.rarity.length === 0 || filters.rarity.includes('☆☆'))

  // same ranking as the packs page by default: any ☆☆ you are missing
  const bestTwoStarPack = useMemo(
    () => (ownedCards.size === 0 ? undefined : getBoosterValues(ownedCards).toSorted((a, b) => b.perPack - a.perPack)[0]),
    [ownedCards],
  )

  const toggles = (
    <>
      <CountAltSwitch id="overview-count-alt" />
      <DeckbuildingFilter
        deckbuildingMode={filters.deckbuildingMode}
        setDeckbuildingMode={(deckbuildingMode) => update({ deck: deckbuildingMode ? '1' : undefined })}
      />
    </>
  )
  // how many of them are on, for the phone button's badge (the alt switch only shows when the alt covers something)
  const togglesOn = Number(filters.deckbuildingMode) + Number(countAlt && covered > 0)

  if (isLoading) {
    // Personal fork: the page's shape (filters, the three tiles, the heatmap) instead of a spinner
    return (
      <main role="status" aria-label="Loading" className="mx-auto max-w-7xl px-4">
        <Skeleton className="mb-4 h-20" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          <Skeleton className="h-56 rounded-lg md:h-64" />
          <Skeleton className="order-last col-span-2 h-72 rounded-lg md:order-none md:col-span-3 md:row-span-2 md:h-auto" />
          <Skeleton className="h-56 rounded-lg md:h-40" />
        </div>
        <Skeleton className="mt-4 h-56" />
      </main>
    )
  }

  return (
    <main>
      <article className="mx-auto max-w-7xl px-4">
        {ownedCards.size === 0 && (
          <Alert className="mb-8 border-1 border-neutral-700 shadow-none">
            <Siren className="h-4 w-4" />
            <AlertTitle>{t('dontHaveCards.title')}</AlertTitle>
            <AlertDescription>{t('dontHaveCards.description')}</AlertDescription>
          </Alert>
        )}

        {/* Personal fork: on phones the rarities are one sideways-scrolling row, and the two toggles sit behind "More" (a
            bottom sheet, like the Packs page's filters) beside Value, instead of four stacked rows of controls above the tiles */}
        <div className="mb-4 flex flex-wrap items-center gap-2 max-sm:[&_label]:text-sm">
          <div className="max-sm:-mx-4 max-sm:basis-full max-sm:overflow-x-auto max-sm:px-4 max-sm:[&_[role=toolbar]]:w-max max-sm:[&_[role=toolbar]]:flex-nowrap">
            <RarityFilter
              rarityFilter={filters.rarity}
              setRarityFilter={(rarity) => update({ rarity: rarity.join(',') || undefined })}
              deckbuildingMode={filters.deckbuildingMode}
            />
          </div>
          <DropdownFilter
            label="Value"
            options={valueOptions}
            value={filters.value}
            show={(v) => valueLabels[v]}
            onChange={(v: ValueOption) => update({ value: v === 'all' ? undefined : v })}
          />
          <div className="grow" />
          {isPhone ? (
            <Button variant="outline" className="h-[38px] border-neutral-700" onClick={() => setSheetOpen(true)}>
              <SlidersHorizontal />
              More
              {togglesOn > 0 && <span className="rounded-full bg-neutral-100 px-1.5 text-neutral-900 text-xs tabular-nums">{togglesOn}</span>}
            </Button>
          ) : (
            toggles
          )}
        </div>
        {/* one copy of the toggles at a time: DeckbuildingFilter's checkbox has a fixed id */}
        <Sheet open={isPhone && sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="bottom" className="rounded-t-xl border-neutral-800 px-4 pb-8">
            <SheetHeader className="px-0">
              <SheetTitle>More filters</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-4">{toggles}</div>
          </SheetContent>
        </Sheet>

        {/* Personal fork: the two stat tiles are one column beside the today panel, which gets three quarters of the width
            so each row's reason fits on a line. Below md they share a row and the panel goes under them. */}
        <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {/* Personal fork: heading sized like the tier tile's and a muted footnote, so the ring gets the room */}
          <div className="flex flex-col items-center justify-center rounded-lg border-1 border-neutral-700 border-solid bg-neutral-800 p-3 sm:p-5 md:row-start-1">
            <h2 className="font-bold mb-2 text-center text-base sm:mb-3 sm:text-lg md:text-xl">{t('uniqueCards')}</h2>
            {/* Personal fork: upstream's RadialChart plus an inner ring for the newest set */}
            <CollectionRing availableCards={availableCards} collectedCards={collectedCards} className="size-36 sm:size-48 md:size-32 lg:size-40" />
            <p className="mt-2 text-balance text-center text-neutral-400 text-xs sm:mt-3">
              {t('numberOfCopies-single')}
              {filters.value !== 'all' && ` · ${valueLabels[filters.value]}`}
            </p>
          </div>
          {/* Personal fork: upstream's every-rarity pick as the headline of a "today" panel, with the Wonder Pick unlock's
              progress, the ☆☆ pick and the alt's next gift / trade listed under it */}
          <TodayPanel
            best={bestPack}
            twoStar={showTwoStarPick ? bestTwoStarPack : undefined}
            filtered={filters.rarity.length > 0 || filters.value !== 'all'}
            className="order-last col-span-2 md:order-none md:col-span-3 md:col-start-2 md:row-span-2 md:row-start-1"
          />
          {/* Personal fork: replaces upstream's "You have N cards in total" */}
          <TierTile counts={tierCounts} value={filters.value} rarity={filters.rarity} className="md:col-start-1 md:row-start-2" />
        </section>

        {/* Personal fork: the luck report's headline and the way to the chase wall */}
        <LuckLine className="mt-3 sm:mt-4" />

        <CompletionHeatmap
          availableCards={availableCards}
          collectedCards={collectedCards}
          chances={chances}
          cellMode={get('cells') === 'left' ? 'left' : 'pct'}
          sortByValue={filters.value !== 'all'}
          rarity={filters.rarity}
          value={filters.value}
          setCellMode={(mode) => update({ cells: mode === 'left' ? 'left' : undefined })}
        />
      </article>

      <Footer />
    </main>
  )
}

export default Overview
