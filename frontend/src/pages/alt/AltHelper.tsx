// Personal fork: what the alt account can hand to the main one. Gifts (◊–◊◊◊◊, one a day) and trades (☆ and up,
// main sends a spare of the same rarity back), each moved between the two collections with one click.
import { ArrowRight, Gift, Repeat } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CardThumb } from '@/components/CardThumb'
import { Spinner } from '@/components/Spinner'
import { Button } from '@/components/ui/button'
import { altCovers } from '@/lib/altSupport'
import { getCardByInternalId } from '@/lib/CardsDB'
import { getCardNameByLang, getExtraCards } from '@/lib/utils'
import { valueSortKey } from '@/lib/ValueDB'
import { useLoginDialog } from '@/services/auth/useAuth'
import { useSelectedCard } from '@/services/collection/useCollection'
import { useProfileAccount } from '@/services/profile/useProfile'
import { useProfileCollection, useTransferCards } from '@/services/profile/useProfileCollection'
import { type Card, defaultRaritySettings } from '@/types'

const GIFT_KEY = 'tcg_last_alt_gift'
const PREVIEW = 16

const today = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time

function readLastGift() {
  try {
    return localStorage.getItem(GIFT_KEY)
  } catch {
    return null
  }
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-sm text-neutral-300">{label}</div>
      {hint && <div className="text-xs text-neutral-500">{hint}</div>}
    </div>
  )
}

function Section({ icon, title, note, children }: { icon: ReactNode; title: string; note: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        {icon}
        {title}
      </h2>
      <p className="mt-1 mb-4 text-sm text-neutral-400">{note}</p>
      {children}
    </section>
  )
}

export default function AltHelper() {
  const { i18n } = useTranslation()
  const { setSelectedCardId } = useSelectedCard()
  const { setIsLoginDialogOpen } = useLoginDialog()
  const { data: mainAccount, isLoading: isLoadingAccount } = useProfileAccount('main')
  const { data: main } = useProfileCollection('main')
  const { data: alt } = useProfileCollection('alt')
  const transfer = useTransferCards()
  const [lastGift, setLastGift] = useState(readLastGift)
  const [showAllGifts, setShowAllGifts] = useState(false)
  const name = (card: Card) => getCardNameByLang(card, i18n.language)

  const cover = useMemo(() => (main && alt && mainAccount ? altCovers(main, mainAccount.trade_rarity_settings, alt) : undefined), [main, alt, mainAccount])

  // For each trade, the card main sends back: its least valuable spare of that rarity, each spare copy used once.
  const trades = useMemo(() => {
    if (!cover || !main || !mainAccount) {
      return []
    }
    const keep = Object.fromEntries(mainAccount.trade_rarity_settings.map((s) => [s.rarity, s.to_keep]))
    const spares = getExtraCards(main, mainAccount.trade_rarity_settings)
      .map((id) => getCardByInternalId(id))
      .filter((card): card is Card => card !== undefined)
      .map((card) => {
        const row = main.get(card.internal_id)
        return { card, left: (row?.amount_owned ?? 0) - (row?.amount_wanted ?? keep[card.rarity] ?? defaultRaritySettings.to_keep) }
      })
      .sort((a, b) => valueSortKey(a.card.card_id) - valueSortKey(b.card.card_id))
    return cover.trade.map((card) => {
      const spare = spares.find((s) => s.card.rarity === card.rarity && s.left > 0)
      if (spare) {
        spare.left--
      }
      return { card, back: spare?.card }
    })
  }, [cover, main, mainAccount])

  const giftedToday = lastGift === today()

  const gift = (card: Card) =>
    transfer.mutate([{ internal_id: card.internal_id, from: 'alt', to: 'main' }], {
      onSuccess: () => {
        const date = today()
        setLastGift(date)
        try {
          localStorage.setItem(GIFT_KEY, date)
        } catch {
          // only a reminder
        }
      },
    })

  if (!mainAccount && !isLoadingAccount) {
    return (
      <main className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-12 text-neutral-400">
        <p>Log in to track your alt account.</p>
        <Button onClick={() => setIsLoginDialogOpen(true)}>Log in</Button>
      </main>
    )
  }

  const gifts = showAllGifts ? (cover?.gift ?? []) : (cover?.gift.slice(0, PREVIEW) ?? [])

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold sm:text-3xl">Alt account</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Cards your main account still needs that the alt already has. Switch to <span className="font-medium text-amber-400">Alt</span> in the header to add
          the alt's cards on the Collection, Scan or Import pages.
        </p>
      </header>

      {!cover ? (
        <Spinner size="md" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Main needs" value={cover.gift.length + cover.trade.length + cover.rest} hint="tradable sets, by your collect settings" />
            <Stat label="Alt can gift" value={cover.gift.length} hint="◊ to ◊◊◊◊" />
            <Stat label="Alt can trade" value={cover.trade.length} hint="☆ and up" />
            <Stat label="Still to find" value={cover.rest} hint="packs or other people" />
          </div>

          <Section
            icon={<Gift className="size-5 text-emerald-400" />}
            title="Gift to main"
            note={
              giftedToday ? (
                <span className="text-emerald-400">Today's gift is marked as sent; the next one is tomorrow.</span>
              ) : (
                'One gift a day. Rarest first, then most wanted. "Gifted" moves one copy from the alt to main.'
              )
            }
          >
            {cover.gift.length === 0 ? (
              <p className="py-6 text-center text-neutral-500">The alt has no ◊–◊◊◊◊ cards that main needs.</p>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-6 md:grid-cols-8">
                  {gifts.map((card) => (
                    <div key={card.internal_id} className="flex min-w-0 flex-col gap-1">
                      <CardThumb card={card} label={card.rarity} onClick={() => setSelectedCardId(card.internal_id)} />
                      <Button
                        size="sm"
                        variant={giftedToday ? 'ghost' : 'outline'}
                        className="h-7 text-xs"
                        disabled={transfer.isPending}
                        onClick={() => gift(card)}
                      >
                        Gifted
                      </Button>
                    </div>
                  ))}
                </div>
                {cover.gift.length > PREVIEW && (
                  <Button variant="ghost" size="sm" className="mt-3" onClick={() => setShowAllGifts((all) => !all)}>
                    {showAllGifts ? 'Show fewer' : `Show all ${cover.gift.length}`}
                  </Button>
                )}
              </>
            )}
          </Section>

          <Section
            icon={<Repeat className="size-5 text-sky-400" />}
            title="Trade to main"
            note="Main sends back its least valuable spare of the same rarity. &quot;Traded&quot; swaps both cards between the collections."
          >
            {trades.length === 0 ? (
              <p className="py-6 text-center text-neutral-500">The alt has no ☆-and-up cards that main needs.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {trades.map(({ card, back }) => (
                  <div key={card.internal_id} className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-2">
                    <CardThumb className="w-16 shrink-0" card={card} onClick={() => setSelectedCardId(card.internal_id)} />
                    <ArrowRight className="size-4 shrink-0 rotate-180 text-neutral-500" aria-label="for" />
                    {back ? (
                      <CardThumb className="w-16 shrink-0" card={back} onClick={() => setSelectedCardId(back.internal_id)} />
                    ) : (
                      <div className="flex aspect-[367/512] w-16 shrink-0 items-center justify-center rounded-md border border-dashed border-neutral-700 text-center text-[10px] text-neutral-500">
                        no spare
                      </div>
                    )}
                    <div className="flex min-w-0 grow flex-col gap-1.5 text-sm">
                      <span className="truncate font-medium">
                        {name(card)} <span className="text-neutral-400">{card.rarity}</span>
                      </span>
                      <span className="truncate text-xs text-neutral-400">
                        {back ? `main gives ${name(back)}` : `main has no spare ${card.rarity} to send back`}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 self-start text-xs"
                        disabled={!back || transfer.isPending}
                        onClick={() =>
                          back &&
                          transfer.mutate([
                            { internal_id: card.internal_id, from: 'alt', to: 'main' },
                            { internal_id: back.internal_id, from: 'main', to: 'alt' },
                          ])
                        }
                      >
                        Traded
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </>
      )}
    </main>
  )
}
