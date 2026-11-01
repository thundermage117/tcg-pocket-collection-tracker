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
import { expansions } from '@/lib/CardsDB.ts'
import { getFilteredCards } from '@/lib/filters'
import { getBoosterValues } from '@/lib/packValue'
import { pullRate } from '@/lib/stats'
import { CompletionHeatmap } from '@/pages/overview/components/CompletionHeatmap.tsx'
import { GradientCard } from '@/pages/overview/components/GradientCard.tsx'
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

  const ownedCardsCount = () => {
    // Count from the card database (same logic as CollectionCards.totalOwned) so orphaned
    // collection rows — card_ids no longer present in allCards — don't inflate the total.
    let total = 0
    const countedIds = new Set<number>()
    for (const card of getFilteredCards({}, ownedCards)) {
      if (card.collected && !countedIds.has(card.internal_id)) {
        total += card.amount_owned ?? 0
        countedIds.add(card.internal_id)
      }
    }
    return total
  }

  // personal fork: filters live in the URL (?rarity=☆☆&copies=2&deck=1) and are remembered for the next visit
  const { get, update } = useUrlFilters('overview-view', ['rarity', 'copies', 'deck'])
  const copies = Number(get('copies'))
  const filters: { rarity: Rarity[]; number: number; deckbuildingMode: boolean } = {
    rarity: (get('rarity')?.split(',') ?? []).filter((r): r is Rarity => (rarities as readonly string[]).includes(r)),
    number: copyOptions.includes(copies) ? copies : 1,
    deckbuildingMode: get('deck') === '1',
  }

  const availableCards = getFilteredCards(filters, ownedCards)
  const collectedCards = ownedCards && getFilteredCards({ ...filters, minNumber: filters.number }, ownedCards)
  const wantedCards = ownedCards && getFilteredCards({ ...filters, maxNumber: filters.number - 1 }, ownedCards)

  const getHighestProbabilityPack = () => {
    let newHighestProbabilityPack: { packName: string; percentage: number; fill: string } | undefined
    const filteredExpansions = expansions.filter((expansion) => expansion.openable)
    for (const expansion of filteredExpansions) {
      const pullRates = expansion.packs
        .filter((p) => p.name !== 'everypack')
        .map((pack) => ({
          packName: pack.name,
          percentage: pullRate(wantedCards, expansion, pack, filters.deckbuildingMode),
          fill: pack.color,
        }))
      const highestProbabilityPackCandidate = pullRates.sort((a, b) => b.percentage - a.percentage)[0]
      if (highestProbabilityPackCandidate.percentage > (newHighestProbabilityPack?.percentage ?? -1)) {
        newHighestProbabilityPack = highestProbabilityPackCandidate
      }
    }
    return newHighestProbabilityPack
  }
  const highestProbabilityPack = getHighestProbabilityPack()

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

        <section className="grid grid-cols-8 gap-4 sm:gap-4">
          <div className="col-span-8 md:col-span-2 flex flex-col items-center justify-center rounded-lg border-1 border-neutral-700 bg-neutral-800 border-solid p-3 sm:p-6 md:p-8">
            <h2 className="font-bold mb-4 text-center text-base sm:text-lg md:text-3xl">{t('uniqueCards')}</h2>
            <RadialChart
              value={availableCards.length === 0 ? 0 : getUniqueCount(collectedCards) / getUniqueCount(availableCards)}
              label={String(getUniqueCount(collectedCards))}
              sublabel={`/ ${getUniqueCount(availableCards)}`}
              color="#92C5FD"
              strokeWidth={24}
            />
            <h2 className="mt-6 text-balance text-center text-sm sm:text-md md:text-md">
              {filters.number === 1 ? t('numberOfCopies-single') : t('numberOfCopies-plural', { numberFilter: filters.number })}
            </h2>
          </div>
          {/* Personal fork: links to the packs page, and names its ☆☆ pick so the two answers can't silently disagree */}
          <Link to="/packs" className="col-span-8 md:col-span-4 col-start-1 md:col-start-3 flex rounded-lg transition-opacity hover:opacity-90">
            <GradientCard
              title={highestProbabilityPack?.packName ?? ''}
              percentage={highestProbabilityPack?.percentage ?? 0}
              className="w-full"
              backgroundColor={highestProbabilityPack?.fill}
            >
              {bestTwoStarPack && bestTwoStarPack.perPackNew > 0 && (
                <p className="mt-3 flex items-center gap-1 text-center text-sm text-slate-900/80">
                  For ☆☆ you're missing: <span className="font-semibold">{t(bestTwoStarPack.packName, { ns: 'common/packs' })}</span> ·{' '}
                  {oneIn(bestTwoStarPack.perPackNew)} packs
                  <ChevronRight className="size-4" />
                </p>
              )}
            </GradientCard>
          </Link>
          <div className="col-span-8 md:col-span-2 flex flex-col items-center justify-center rounded-lg border-1 border-neutral-700 bg-neutral-800 border-solid p-3 sm:p-6 md:p-8">
            <h2 className="mb-1 text-center text-base sm:text-lg md:text-2xl">{t('youHave')}</h2>
            <h1 className="mb-2 text-balance text-center font-semibold text-2xl sm:text-3xl md:text-7xl">{ownedCardsCount()}</h1>
            <h2 className="text-balance text-center text-base sm:text-lg md:text-2xl">{t('cardsTotal')}</h2>
          </div>
        </section>

        <CompletionHeatmap
          availableCards={availableCards}
          collectedCards={collectedCards}
          wantedCards={wantedCards}
          deckbuildingMode={filters.deckbuildingMode}
        />
      </article>

      <Footer />
    </main>
  )
}

export default Overview
