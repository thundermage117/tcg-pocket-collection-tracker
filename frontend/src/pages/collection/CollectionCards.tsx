import i18n from 'i18next'
import { ClipboardCopy, Share2, SlidersHorizontal } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMediaQuery } from 'react-responsive'
import { useSearchParams } from 'react-router'
import { z } from 'zod'
import { Card } from '@/components/Card'
import { CardsTable } from '@/components/CardsTable.tsx'
import FiltersPanel from '@/components/FiltersPanel'
import ActiveFilterChips from '@/components/filters/ActiveFilterChips'
import SearchInput from '@/components/filters/SearchInput'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import useSearchState from '@/hooks/use-search-state'
import { toast } from '@/hooks/use-toast'
import { useRemainingViewportHeight } from '@/hooks/useRemainingViewportHeight'
import {
  abilityOptions,
  cardTypeOptions,
  getFilteredCards,
  ownershipOptions,
  pokemonKindOptions,
  sortByOptions,
  stageOptions,
  tradingOptions,
  trainerSubtypeOptions,
} from '@/lib/filters'
import { getCardNameByLang } from '@/lib/utils.ts'
import { useProfileDialog } from '@/services/account/useAccount'
import { type Card as CardType, type Collection, expansionIds, type PublicAccountRow, rarities, type UserAccountRow } from '@/types'

const schema = z.object({
  search: z.string().default(''),
  expansion: z.union([z.enum(expansionIds), z.literal('all')]).default('all'),
  pack: z.string().default('all'),
  cardType: z.array(z.enum(cardTypeOptions)).default([]),
  rarity: z.array(z.enum(rarities)).default([]),
  ownership: z.enum(ownershipOptions).default('all'),
  trading: z.enum(tradingOptions).default('all'),
  sortBy: z.enum(sortByOptions).default('expansion-newest'),
  sortDesc: z.boolean().default(false),
  minNumber: z.number().default(0),
  maxNumber: z.union([z.number(), z.literal('∞')]).default('∞'),
  deckbuildingMode: z.boolean().default(false),
  allTextSearch: z.boolean().default(false),
  stage: z.array(z.enum(stageOptions)).default([]),
  pokemonKind: z.array(z.enum(pokemonKindOptions)).default([]),
  trainerSubtype: z.array(z.enum(trainerSubtypeOptions)).default([]),
  ability: z.enum(abilityOptions).default('all'),
  minHp: z.number().default(0),
  maxHp: z.union([z.number(), z.literal('∞')]).default('∞'),
  minRetreat: z.number().default(0),
  maxRetreat: z.union([z.number(), z.literal('∞')]).default('∞'),
})

interface Props {
  children?: ReactNode
  cards: Collection
  account: PublicAccountRow | UserAccountRow | undefined
}

export default function CollectionCards({ children, cards, account }: Props) {
  const { ref: pageRef, height: pageHeight } = useRemainingViewportHeight()
  const { t } = useTranslation('pages/collection')
  const isMobile = useMediaQuery({ query: '(max-width: 767px)' }) // tailwind "md"

  const { setIsProfileDialogOpen } = useProfileDialog()
  const [isFiltersSheetOpen, setIsFiltersSheetOpen] = useState(false) // used only on mobile
  const isPublic = account !== undefined && !('email' in account)

  const [filters, setFilters, activeFilters] = useSearchState(schema)
  const [_, setSearchParams] = useSearchParams()
  const clearFilters = () => setSearchParams(new URLSearchParams())
  // Personal fork: the search box is uncontrolled, so clearing remounts it empty
  const [clearCount, setClearCount] = useState(0)
  const clear = () => {
    clearFilters()
    setClearCount((n) => n + 1)
  }
  const filterCount = activeFilters - (filters.search ? 1 : 0) // the phone's search box shows its own

  const filteredCards = getFilteredCards(filters, cards, account?.trade_rarity_settings)

  const getTradingMessage = () => {
    if (!account || isPublic) {
      throw new Error('Cannot copy trade message without account or of public accounts')
    }
    let cardValues = ''

    if (account.is_public) {
      cardValues += `${t('trade.publicTradePage')}: https://tcgpocketcollectiontracker.com/#/trade/${account?.friend_id}\n`
    }
    if (account.username) {
      cardValues += `${t('trade.friendID')}: ${account.friend_id} (${account.username})\n\n`
    }

    const putCards = (arr: CardType[]) => {
      arr.sort((a: CardType, b: CardType) => {
        const expansionComparison = a.expansion.localeCompare(b.expansion)
        if (expansionComparison !== 0) {
          return expansionComparison
        }
        return a.rarity.localeCompare(b.rarity)
      })

      for (let i = 0; i < arr.length; i++) {
        const prevExpansion = i > 0 ? arr[i - 1].expansion : ''
        if (prevExpansion !== arr[i].expansion) {
          cardValues += `\n${arr[i].expansion}:\n`
        }
        cardValues += `${arr[i].rarity} ${arr[i].card_id} - ${getCardNameByLang(arr[i], i18n.language)}\n`
      }
    }

    cardValues += `${t('trade.lookingForCards')}:\n`
    putCards(getFilteredCards({ ...filters, trading: 'wanted' }, cards, account.trade_rarity_settings))

    cardValues += `\n\n${t('trade.forTradeCards')}:\n`
    putCards(getFilteredCards({ ...filters, trading: 'extra' }, cards, account.trade_rarity_settings))

    return cardValues
  }

  async function onShare() {
    if (!account || isPublic) {
      throw new Error("Can't share collection: not logged in or not on own collection")
    }
    if (account.friend_id === '' || !account.is_public) {
      setIsProfileDialogOpen(true)
    } else {
      // @ts-expect-error: Experimental api https://developer.mozilla.org/en-US/docs/Web/API/NavigatorUAData/mobile
      if (navigator.share && (navigator.userAgentData?.mobile || /Mobi|Android/i.test(navigator.userAgent))) {
        await navigator.share({ title: 'My Pokemon TCG Pocket collection', url: window.location.href })
      } else {
        await navigator.clipboard.writeText(window.location.href)
        toast({ title: 'Copied to clipboard', variant: 'default' })
      }
    }
  }

  const totalOwned = () => {
    let total = 0
    const uniqueCardsByCardId = new Set<number>()
    for (const card of filteredCards) {
      if (card.collected && !uniqueCardsByCardId.has(card.internal_id)) {
        total += card.amount_owned || 0
        uniqueCardsByCardId.add(card.internal_id)
      }
    }
    return total
  }

  const stats = [
    { key: 'shown', value: filteredCards.length },
    { key: 'owned', value: filteredCards.filter((card) => Boolean(card.collected)).length },
    { key: 'copies', value: totalOwned() },
  ]

  // Personal fork: on desktop these sit above the cards instead of under the filters, since they aren't filters
  const shareButtons = !isPublic && (
    <>
      <Button variant="outline" size={isMobile ? 'default' : 'sm'} onClick={onShare}>
        <Share2 />
        {t('filters.share')}
      </Button>
      <Button
        variant="outline"
        size={isMobile ? 'default' : 'sm'}
        disabled={!account}
        onClick={() =>
          navigator.clipboard.writeText(getTradingMessage()).then(() => toast({ title: t('trade.copiedInClipboard'), variant: 'default', duration: 3000 }))
        }
      >
        <ClipboardCopy />
        {t('trade.button')}
      </Button>
    </>
  )

  const filtersPanel = (
    <div className="flex flex-col h-fit gap-2">
      <div className="grid grid-cols-3 gap-2 mb-1">
        {stats.map(({ key, value }) => (
          <div key={key} className="flex flex-col">
            <span className="text-lg font-semibold leading-tight text-neutral-200 tabular-nums">{value.toLocaleString(i18n.language)}</span>
            <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">{t(`stats.${key}`)}</span>
          </div>
        ))}
      </div>
      {/* Personal fork: on phones the search box lives above the cards, so the sheet leaves it out */}
      <FiltersPanel
        key={clearCount}
        className="flex flex-col gap-y-3"
        filters={isMobile ? { ...filters, search: undefined } : filters}
        setFilters={setFilters}
        clearFilters={clear}
        activeFilters={activeFilters}
      />
      {isMobile && <div className="flex flex-col mt-4 gap-2">{shareButtons}</div>}
    </div>
  )

  return (
    <div ref={pageRef} style={{ height: pageHeight }} className="flex min-h-0 justify-center gap-2 xl:gap-8 px-1">
      {isMobile ? (
        // Personal fork: a bottom sheet like the tab bar's "More", in reach of a thumb
        <Sheet open={isFiltersSheetOpen} onOpenChange={setIsFiltersSheetOpen}>
          <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-xl border-neutral-800 px-4 pb-8">
            <SheetHeader className="px-0">
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            {filtersPanel}
          </SheetContent>
        </Sheet>
      ) : (
        <div className="w-80 min-h-0 overflow-y-auto">{filtersPanel}</div>
      )}
      <div className="flex min-h-0 min-w-0 w-full max-w-[900px] flex-col">
        {/* Personal fork: on phones the search stays on screen, with the other filters as chips under it */}
        {isMobile && (
          <>
            <div className="flex shrink-0 gap-2">
              <SearchInput key={clearCount} className="flex-1" value={filters.search} setValue={(search) => setFilters({ search })} />
              <Button variant="outline" className="h-[38px] border-neutral-700" onClick={() => setIsFiltersSheetOpen(true)}>
                <SlidersHorizontal />
                Filters
                {filterCount > 0 && <span className="rounded-full bg-neutral-200 px-1.5 text-xs leading-5 text-neutral-900 tabular-nums">{filterCount}</span>}
              </Button>
            </div>
            <ActiveFilterChips filters={filters} setFilters={setFilters} omit={['search']} />
          </>
        )}
        {!isMobile && shareButtons && <div className="flex shrink-0 justify-end gap-2 pb-2">{shareButtons}</div>}
        {children && <div className="shrink-0">{children}</div>}
        <CardsTable
          cards={filteredCards}
          groupExpansions={filters.sortBy === 'expansion-newest'}
          render={(c) => <Card card={c} editable={!filters.deckbuildingMode && !isPublic} />}
        />
      </div>
    </div>
  )
}
