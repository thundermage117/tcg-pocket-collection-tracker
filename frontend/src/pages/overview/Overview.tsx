import { ChevronRight, Siren } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { DropdownFilter } from '@/components/Filters'
import Footer from '@/components/Footer.tsx'
import DeckbuildingFilter from '@/components/filters/DeckbuildingFilter'
import RarityFilter from '@/components/filters/RarityFilter'
import { RadialChart } from '@/components/RadialChart'
import { Spinner } from '@/components/Spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTitle } from '@/components/ui/alert.tsx'
import { useUrlFilters } from '@/hooks/useUrlFilters'
import { getFilteredCards } from '@/lib/filters'
import { getBoosterValues } from '@/lib/packValue'
import { CompletionHeatmap } from '@/pages/overview/components/CompletionHeatmap.tsx'
import { GradientCard } from '@/pages/overview/components/GradientCard.tsx'
import { bestChance, getPackChances } from '@/pages/overview/packChances'
import { oneIn } from '@/pages/packs/types'
import { useCollection } from '@/services/collection/useCollection'
import { type Card, type CollectionRow, type Rarity, rarities } from '@/types'

const copyOptions = [1, 2, 3, 4, 5]

function getUniqueCount(cards: Card[]) {
  return new Set(cards.map((c) => c.internal_id)).size
}

function Overview() {
  const { data: ownedCards = new Map<number, CollectionRow>(), isLoading } = useCollection()

  const { t } = useTranslation(['pages/overview', 'filters', 'common/sets', 'common/packs', 'expansion-overview'])

  // personal fork: filters live in the URL (?rarity=☆☆&copies=2&deck=1&cells=left) and are remembered for the next visit
  const { get, update } = useUrlFilters('overview-view', ['rarity', 'copies', 'deck', 'cells'])
  const rarityParam = get('rarity')
  const copies = Number(get('copies'))
  const number = copyOptions.includes(copies) ? copies : 1
  const deckbuildingMode = get('deck') === '1'
  const filters = useMemo(
    () => ({
      rarity: (rarityParam?.split(',') ?? []).filter((r): r is Rarity => (rarities as readonly string[]).includes(r)),
      number,
      deckbuildingMode,
    }),
    [rarityParam, number, deckbuildingMode],
  )

  // Memoized so the pack odds (a pullRate per pack) only rerun when the collection or filters change
  const { availableCards, collectedCards, totalOwned, chances } = useMemo(() => {
    const availableCards = getFilteredCards(filters, ownedCards)
    // Copies owned of the cards the filters show. Counted from the card database (same logic as CollectionCards.totalOwned)
    // so orphaned collection rows — card_ids no longer present in allCards — don't inflate the total.
    let totalOwned = 0
    const countedIds = new Set<number>()
    for (const card of availableCards) {
      if (card.collected && !countedIds.has(card.internal_id)) {
        totalOwned += card.amount_owned ?? 0
        countedIds.add(card.internal_id)
      }
    }
    const collectedCards = getFilteredCards({ ...filters, minNumber: filters.number }, ownedCards)
    const wantedCards = getFilteredCards({ ...filters, maxNumber: filters.number - 1 }, ownedCards)
    return { availableCards, collectedCards, totalOwned, chances: getPackChances(availableCards, collectedCards, wantedCards, filters.deckbuildingMode) }
  }, [filters, ownedCards])
  const bestPack = bestChance([...chances.values()].flat())
  // The ☆☆ pick ignores the filters, so only show it when ☆☆ cards are in view (deckbuilding mode hides alternate arts like ☆☆)
  const showTwoStarPick = !filters.deckbuildingMode && (filters.rarity.length === 0 || filters.rarity.includes('☆☆'))

  // same ranking as the packs page's "Cards I'm missing" goal
  const bestTwoStarPack = useMemo(
    () => (ownedCards.size === 0 ? undefined : getBoosterValues(ownedCards).toSorted((a, b) => b.perPackNew - a.perPackNew)[0]),
    [ownedCards],
  )

  if (isLoading) {
    return <Spinner size="lg" overlay />
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

        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <RarityFilter
            rarityFilter={filters.rarity}
            setRarityFilter={(rarity) => update({ rarity: rarity.join(',') || undefined })}
            deckbuildingMode={filters.deckbuildingMode}
          />
          <DropdownFilter
            label={t('f-number.numberCards', { ns: 'filters' })}
            options={copyOptions}
            value={filters.number}
            onChange={(number) => update({ copies: Number(number) === 1 ? undefined : String(number) })}
          />
          <div className="grow" />
          <DeckbuildingFilter
            deckbuildingMode={filters.deckbuildingMode}
            setDeckbuildingMode={(deckbuildingMode) => update({ deck: deckbuildingMode ? '1' : undefined })}
          />
        </div>

        {/* Personal fork: below md the two stat tiles share a row and the pick goes under them, so the heatmap starts higher */}
        <section className="grid grid-cols-8 gap-3 sm:gap-4">
          <div className="col-span-4 md:col-span-2 flex flex-col items-center justify-center rounded-lg border-1 border-neutral-700 bg-neutral-800 border-solid p-3 sm:p-6 md:p-8">
            <h2 className="font-bold mb-2 text-center text-base sm:mb-4 sm:text-lg md:text-3xl">{t('uniqueCards')}</h2>
            <RadialChart
              value={availableCards.length === 0 ? 0 : getUniqueCount(collectedCards) / getUniqueCount(availableCards)}
              label={String(getUniqueCount(collectedCards))}
              sublabel={`/ ${getUniqueCount(availableCards)}`}
              color="#92C5FD"
              strokeWidth={24}
              className="size-28 sm:size-45"
            />
            <h2 className="mt-2 text-balance text-center text-neutral-300 text-xs sm:mt-6 sm:text-sm sm:text-white">
              {filters.number === 1 ? t('numberOfCopies-single') : t('numberOfCopies-plural', { numberFilter: filters.number })}
            </h2>
          </div>
          {/* Personal fork: links to the packs page, and names its ☆☆ pick so the two answers can't silently disagree */}
          {bestPack && bestPack.pct > 0 ? (
            <Link to="/packs" className="order-last col-span-8 md:order-none md:col-span-4 md:col-start-3 flex rounded-lg transition-opacity hover:opacity-90">
              <GradientCard title={bestPack.pack.name} percentage={bestPack.pct / 100} className="w-full" backgroundColor={bestPack.pack.color}>
                {showTwoStarPick && bestTwoStarPack && bestTwoStarPack.perPackNew > 0 && (
                  // inline, not flex: flex made each text run its own column, which wrapped word by word on phones
                  <p className="mt-3 text-balance text-center text-sm text-slate-900/80">
                    For ☆☆ you're missing: <span className="font-semibold">{t(bestTwoStarPack.packName, { ns: 'common/packs' })}</span> ·{' '}
                    {oneIn(bestTwoStarPack.perPackNew)} packs
                    <ChevronRight className="ml-0.5 inline size-4 align-text-bottom" />
                  </p>
                )}
              </GradientCard>
            </Link>
          ) : (
            // Nothing missing in any openable pack: no pick to make
            <div className="order-last col-span-8 md:order-none md:col-span-4 md:col-start-3 flex flex-col items-center justify-center rounded-lg border-1 border-neutral-700 bg-neutral-800 border-solid p-4 sm:p-8">
              <p className="font-semibold text-center text-2xl sm:text-5xl">All caught up 🎉</p>
              <p className="mt-2 text-balance text-center text-neutral-300 text-md sm:text-xl">
                No booster pack has a card you're missing{filters.rarity.length > 0 || filters.number > 1 ? ' with these filters' : ''}.
              </p>
            </div>
          )}
          <div className="col-span-4 md:col-span-2 flex flex-col items-center justify-center rounded-lg border-1 border-neutral-700 bg-neutral-800 border-solid p-3 sm:p-6 md:p-8">
            <h2 className="mb-1 text-center text-base sm:text-lg md:text-2xl">{t('youHave')}</h2>
            <h1 className="mb-2 text-balance text-center font-semibold text-4xl sm:text-5xl md:text-7xl">{totalOwned}</h1>
            <h2 className="text-balance text-center text-base sm:text-lg md:text-2xl">{t('cardsTotal')}</h2>
            {/* Follows the rarity filter like the other tiles; say so, or the number looks wrong */}
            {filters.rarity.length > 0 && <p className="mt-1 text-center text-neutral-400 text-sm">{filters.rarity.join(' ')}</p>}
          </div>
        </section>

        <CompletionHeatmap
          availableCards={availableCards}
          collectedCards={collectedCards}
          chances={chances}
          cellMode={get('cells') === 'left' ? 'left' : 'pct'}
          setCellMode={(mode) => update({ cells: mode === 'left' ? 'left' : undefined })}
        />
      </article>

      <Footer />
    </main>
  )
}

export default Overview
