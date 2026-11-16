// Personal fork: logging the way it's actually done here, by filling gaps. Only the cards main is missing, small and
// close together, grouped by expansion and pack; one tap marks a card owned. A card tapped on this visit stays in
// place as "got it", so a mis-tap is one more tap to undo. Opened from the overview heatmap's cells
// (?set=B1&rarity=☆&pack=…); set=all lists every expansion.
import { Check } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SetLogo } from '@/components/CardThumb'
import { DropdownFilter } from '@/components/Filters'
import RarityFilter from '@/components/filters/RarityFilter'
import { CardGridSkeleton } from '@/components/Skeleton'
import { useUrlFilters } from '@/hooks/useUrlFilters'
import { latestExpansion } from '@/lib/altSupport'
import { allCards, expansions } from '@/lib/CardsDB'
import { getLocalizedImagePath } from '@/lib/imageLocales'
import { cn, getCardNameByLang } from '@/lib/utils'
import { useSelectedCard, useUpdateCards } from '@/services/collection/useCollection'
import { useProfileCollection } from '@/services/profile/useProfileCollection'
import { type Card, type Expansion, type ExpansionId, type Rarity, rarities } from '@/types'

const newestFirst = expansions.toReversed()
const setOptions: (ExpansionId | 'all')[] = [...newestFirst.map((e) => e.id), 'all']

interface Group {
  key: string
  expansion: Expansion
  pack?: string // undefined for an expansion with one pack, or its cards that come in every pack
  cards: Card[]
}

function Gaps() {
  const { t, i18n } = useTranslation(['common/sets', 'common/packs'])
  const { data: collection, isLoading } = useProfileCollection('main')
  const { setIsLoginDialogOpen } = useSelectedCard()
  const updateCards = useUpdateCards()

  const { get, update } = useUrlFilters('gaps-view')
  const set = setOptions.find((s) => s === get('set')) ?? latestExpansion.id
  const rarityParam = get('rarity')
  const rarity = useMemo(() => (rarityParam?.split(',') ?? []).filter((r): r is Rarity => (rarities as readonly string[]).includes(r)), [rarityParam])
  const pack = get('pack')

  // Cards marked on this visit, with the card dex flag each had before, which the undo puts back
  const [marked, setMarked] = useState<ReadonlyMap<number, boolean>>(new Map())

  const groups = useMemo(() => {
    const result: Group[] = []
    for (const expansion of newestFirst) {
      if (set !== 'all' && expansion.id !== set) {
        continue
      }
      const cards = allCards.filter(
        (c) =>
          c.expansion === expansion.id &&
          (rarity.length === 0 || rarity.includes(c.rarity)) &&
          (!pack || c.pack === pack || c.pack === 'everypack') &&
          // a card marked on this visit is owned now, and stays where it was
          ((collection?.get(c.internal_id)?.amount_owned ?? 0) === 0 || marked.has(c.internal_id)),
      )
      const packs = expansion.packs.filter((p) => p.name !== 'everypack')
      if (packs.length < 2) {
        result.push({ key: expansion.id, expansion, cards })
        continue
      }
      for (const p of packs) {
        result.push({ key: `${expansion.id}-${p.name}`, expansion, pack: p.name, cards: cards.filter((c) => c.pack === p.name) })
      }
      result.push({ key: `${expansion.id}-every`, expansion, cards: cards.filter((c) => !packs.some((p) => p.name === c.pack)) })
    }
    return result.filter((g) => g.cards.length > 0)
  }, [collection, set, rarity, pack, marked])

  const stillMissing = (cards: Card[]) => cards.filter((c) => !marked.has(c.internal_id)).length
  const left = groups.reduce((n, g) => n + stillMissing(g.cards), 0)

  const setMark = (id: number, before: boolean | undefined) =>
    setMarked((prev) => {
      const next = new Map(prev)
      if (before === undefined) {
        next.delete(id)
      } else {
        next.set(id, before)
      }
      return next
    })

  // mutateAsync, not mutate's per-call callbacks: with several taps in flight those only fire for the last one
  const tap = async (card: Card) => {
    if (!collection) {
      setIsLoginDialogOpen(true)
      return
    }
    const id = card.internal_id
    const row = collection.get(id)
    const wasCollected = marked.get(id)
    const got = wasCollected === undefined
    // marks at once; the hook toasts a failed save and the mark is put back as it was
    setMark(id, got ? (row?.collected ?? false) : undefined)
    try {
      await updateCards.mutateAsync([
        got ? { internal_id: id, amount_owned: 1, collected: true } : { internal_id: id, amount_owned: 0, collected: wasCollected },
      ])
    } catch {
      setMark(id, got ? undefined : wasCollected)
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold sm:text-3xl">Fill the gaps</h1>
        <p className="mt-1 text-neutral-400 text-sm">
          Tap a card you got. Tap it again if that was a mistake.{' '}
          <span className="text-neutral-200 tabular-nums">
            {left} missing{pack ? ` in ${t(pack, { ns: 'common/packs' })}` : ''}
          </span>
        </p>
      </header>

      <div className="sticky top-0 z-20 -mx-4 mb-4 flex flex-wrap items-center gap-2 bg-neutral-900/95 px-4 py-2 backdrop-blur">
        <DropdownFilter
          label="Expansion"
          options={setOptions}
          value={set}
          show={(id) => (id === 'all' ? 'All expansions' : `${id} · ${t(expansions.find((e) => e.id === id)?.name ?? id, { ns: 'common/sets' })}`)}
          onChange={(next) => update({ set: next, pack: undefined })}
        />
        <div className="max-sm:-mx-4 max-sm:basis-full max-sm:overflow-x-auto max-sm:px-4 max-sm:[&_[role=toolbar]]:w-max max-sm:[&_[role=toolbar]]:flex-nowrap">
          <RarityFilter rarityFilter={rarity} setRarityFilter={(r) => update({ rarity: r.join(',') || undefined })} />
        </div>
        {pack && (
          <button
            type="button"
            onClick={() => update({ pack: undefined })}
            className="cursor-pointer rounded-full border border-neutral-700 px-3 py-1 text-neutral-300 text-sm hover:border-neutral-500"
          >
            {t(pack, { ns: 'common/packs' })} ✕
          </button>
        )}
      </div>

      {isLoading ? (
        <CardGridSkeleton count={24} className="grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10" />
      ) : groups.length === 0 ? (
        <p className="py-16 text-center text-neutral-400">No gaps here.</p>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="mb-6">
            <h2 className="mb-2 flex items-center gap-2 text-neutral-300 text-sm">
              <SetLogo expansionId={group.expansion.id} className="h-6 max-w-[72px]" />
              <span className="font-medium">
                {group.pack ? t(group.pack, { ns: 'common/packs' }) : t(group.expansion.name, { ns: 'common/sets' })}
                {!group.pack && group.expansion.packs.filter((p) => p.name !== 'everypack').length > 1 && ' · any pack'}
              </span>
              <span className="text-neutral-500 tabular-nums">{stillMissing(group.cards)}</span>
            </h2>
            <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
              {group.cards.map((card) => {
                const got = marked.has(card.internal_id)
                const name = getCardNameByLang(card, i18n.language)
                return (
                  <li key={card.card_id}>
                    <button
                      type="button"
                      onClick={() => tap(card)}
                      aria-pressed={got}
                      title={got ? `${name}: got it. Tap to undo` : `${name}: tap when you have it`}
                      className={cn(
                        'relative block w-full cursor-pointer overflow-hidden rounded-md transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 ring-neutral-300',
                        got && 'ring-2 ring-emerald-500',
                      )}
                    >
                      <img
                        src={getLocalizedImagePath(card, i18n.language)}
                        alt={name}
                        loading="lazy"
                        decoding="async"
                        className={cn('aspect-[367/512] w-full object-cover transition-opacity', got && 'opacity-45')}
                      />
                      {got && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="rounded-full bg-emerald-600 p-1.5 text-white shadow-lg">
                            <Check className="size-5" strokeWidth={3} />
                          </span>
                        </span>
                      )}
                    </button>
                    <p className="mt-0.5 truncate text-center text-[11px] text-neutral-400 leading-tight">
                      <span className="tabular-nums">{card.card_id.split('-')[1]}</span> {name}
                    </p>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
    </main>
  )
}

export default Gaps
