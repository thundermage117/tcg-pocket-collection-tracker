// Personal fork: how the alt account helps the main one (see lib/altSupport.ts). The latest set's unlock for both
// accounts, gifts both ways (◊–◊◊◊◊, one received a day) and trades to main (☆ and up), each moved between the two
// collections with one click.
import { ArrowRight, Gift, Repeat, Sparkles } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CardThumb } from '@/components/CardThumb'
import { Spinner } from '@/components/Spinner'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { altCovers, bestUnlockPack, canMoveToMain, countsForUnlock, giftsToAlt, latestExpansion, type UnlockProgress, unlockProgress } from '@/lib/altSupport'
import { getCardByInternalId } from '@/lib/CardsDB'
import { shinedustCost } from '@/lib/tradeFairness'
import { getCardNameByLang, getExtraCards } from '@/lib/utils'
import { valueSortKey } from '@/lib/ValueDB'
import { oneIn } from '@/pages/packs/types'
import { useLoginDialog } from '@/services/auth/useAuth'
import { useSelectedCard } from '@/services/collection/useCollection'
import type { Profile } from '@/services/profile/useProfile'
import { useProfileAccount } from '@/services/profile/useProfile'
import { useProfileCollection, useTransferCards } from '@/services/profile/useProfileCollection'
import { type Card, type Collection, defaultRaritySettings, type TradableRarity } from '@/types'

const PREVIEW = 16

const today = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time
const giftKey = (to: Profile) => `tcg_last_gift_to_${to}`

function readGiftDate(to: Profile) {
  try {
    return localStorage.getItem(giftKey(to))
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

function Bar({ label, have, total }: { label: string; have: number; total: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-neutral-400 tabular-nums">
          {have} / {total}
        </span>
      </div>
      <Progress value={total === 0 ? 100 : (100 * have) / total} />
    </div>
  )
}

/** One account's progress towards ☆☆-only 24-hour Wonder Picks in the latest set. */
function UnlockCard({ title, progress, covered, pending }: { title: string; progress: UnlockProgress; covered: number; pending: Card[] }) {
  const { t } = useTranslation(['common/packs'])
  const diamondsLeft = progress.diamonds.total - progress.diamonds.have
  const starsLeft = progress.star.total - progress.star.have
  const best = bestUnlockPack(pending)
  const status =
    diamondsLeft > 0
      ? `${diamondsLeft} ◊ to go before 24-hour Wonder Picks show its missing ☆ / ☆☆.`
      : starsLeft > 0
        ? `24-hour Wonder Picks show missing ☆ or ☆☆; ${starsLeft} ☆ to go for ☆☆ only.`
        : 'Unlocked: 24-hour Wonder Picks show ☆☆ it is missing.'

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <h3 className="font-semibold">{title}</h3>
      <Bar label="◊ – ◊◊◊◊" have={progress.diamonds.have} total={progress.diamonds.total} />
      <Bar label="☆" have={progress.star.have} total={progress.star.total} />
      <p className="text-sm text-neutral-300">{status}</p>
      {progress.missing.length > 0 && (
        <p className="text-xs text-neutral-400">
          {covered > 0 && <>{covered} can come from the other account. </>}
          {pending.length > 0 ? (
            <>
              {pending.length} only from packs or Wonder Picks
              {best && (
                <>
                  : best pack <span className="text-neutral-200">{t(best.pack.name, { ns: 'common/packs' })}</span>, {oneIn(best.chance)} packs gives one.
                </>
              )}
            </>
          ) : (
            'The rest can all come from the other account.'
          )}
        </p>
      )}
    </div>
  )
}

const UnlockBadge = () => (
  <span title="Counts towards the latest set's Wonder Pick unlock" className="flex rounded-full bg-violet-500 p-0.5 text-white shadow">
    <Sparkles className="size-3" />
  </span>
)

function GiftGrid({
  cards,
  receiver,
  sentToday,
  disabled,
  onGift,
}: {
  cards: Card[]
  receiver: Collection
  sentToday: boolean
  disabled: boolean
  onGift: (card: Card) => void
}) {
  const { setSelectedCardId } = useSelectedCard()
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? cards : cards.slice(0, PREVIEW)
  return (
    <>
      <div className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-6 md:grid-cols-8">
        {shown.map((card) => (
          <div key={card.internal_id} className="flex min-w-0 flex-col gap-1">
            <CardThumb
              card={card}
              label={card.rarity}
              badge={countsForUnlock(receiver, card) && <UnlockBadge />}
              onClick={() => setSelectedCardId(card.internal_id)}
            />
            <Button size="sm" variant={sentToday ? 'ghost' : 'outline'} className="h-7 text-xs" disabled={disabled} onClick={() => onGift(card)}>
              Gifted
            </Button>
          </div>
        ))}
      </div>
      {cards.length > PREVIEW && (
        <Button variant="ghost" size="sm" className="mt-3" onClick={() => setShowAll((all) => !all)}>
          {showAll ? 'Show fewer' : `Show all ${cards.length}`}
        </Button>
      )}
    </>
  )
}

export default function AltHelper() {
  const { t, i18n } = useTranslation(['common/sets'])
  const { setSelectedCardId } = useSelectedCard()
  const { setIsLoginDialogOpen } = useLoginDialog()
  const { data: mainAccount, isLoading: isLoadingAccount } = useProfileAccount('main')
  const { data: main } = useProfileCollection('main')
  const { data: alt } = useProfileCollection('alt')
  const transfer = useTransferCards()
  const [giftDates, setGiftDates] = useState({ main: readGiftDate('main'), alt: readGiftDate('alt') })
  const name = (card: Card) => getCardNameByLang(card, i18n.language)

  const data = useMemo(() => {
    if (!main || !alt || !mainAccount) {
      return undefined
    }
    const settings = mainAccount.trade_rarity_settings
    const cover = altCovers(main, settings, alt)
    const toAlt = giftsToAlt(main, settings, alt)
    const mainUnlock = unlockProgress(main)
    const altUnlock = unlockProgress(alt)
    const altCanGive = (c: Card) => canMoveToMain(c) && (alt.get(c.internal_id)?.amount_owned ?? 0) > 0
    const toAltIds = new Set(toAlt.map((c) => c.internal_id))

    // For each trade, the card main sends back: its least valuable spare of that rarity, each spare copy used once.
    const keep = Object.fromEntries(settings.map((s) => [s.rarity, s.to_keep]))
    const spares = getExtraCards(main, settings)
      .map((id) => getCardByInternalId(id))
      .filter((card): card is Card => card !== undefined)
      .map((card) => {
        const row = main.get(card.internal_id)
        return { card, left: (row?.amount_owned ?? 0) - (row?.amount_wanted ?? keep[card.rarity] ?? defaultRaritySettings.to_keep) }
      })
      .sort((a, b) => valueSortKey(a.card.card_id) - valueSortKey(b.card.card_id))
    const trades = cover.trade.map((card) => {
      const spare = spares.find((s) => s.card.rarity === card.rarity && s.left > 0)
      if (spare) {
        spare.left--
      }
      return { card, back: spare?.card }
    })

    return {
      cover,
      toAlt,
      trades,
      mainUnlock: { progress: mainUnlock, pending: mainUnlock.missing.filter((c) => !altCanGive(c)) },
      altUnlock: { progress: altUnlock, pending: altUnlock.missing.filter((c) => !toAltIds.has(c.internal_id)) },
    }
  }, [main, alt, mainAccount])

  const gift = (card: Card, to: Profile) =>
    transfer.mutate([{ internal_id: card.internal_id, from: to === 'main' ? 'alt' : 'main', to }], {
      onSuccess: () => {
        const date = today()
        setGiftDates((dates) => ({ ...dates, [to]: date }))
        try {
          localStorage.setItem(giftKey(to), date)
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

  const giftNote = (to: Profile, rule: string) =>
    giftDates[to] === today() ? <span className="text-emerald-400">Today's gift to {to} is marked as sent; the next one is tomorrow.</span> : rule

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold sm:text-3xl">Alt account</h1>
        <p className="mt-1 text-sm text-neutral-400">
          How the alt helps main: gifts, trades to main and the latest set's Wonder Pick unlock. Switch to{' '}
          <span className="font-medium text-amber-400">Alt</span> in the header to add the alt's cards on the Collection, Scan or Import pages.
        </p>
      </header>

      {!data ? (
        <Spinner size="md" />
      ) : (
        <>
          <Section
            icon={<Sparkles className="size-5 text-violet-400" />}
            title={`${t(latestExpansion.name, { ns: 'common/sets' })}: ☆☆ Wonder Pick unlock`}
            note="Community-tested, not official: with every ◊–◊◊◊◊ of the newest set registered, an account's 24-hour Wonder Picks show ☆ / ☆☆ it's missing; with every ☆ too, only ☆☆. Worth it on both accounts: the alt's ☆☆ can be traded to main."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <UnlockCard
                title="Main"
                progress={data.mainUnlock.progress}
                pending={data.mainUnlock.pending}
                covered={data.mainUnlock.progress.missing.length - data.mainUnlock.pending.length}
              />
              <UnlockCard
                title="Alt"
                progress={data.altUnlock.progress}
                pending={data.altUnlock.pending}
                covered={data.altUnlock.progress.missing.length - data.altUnlock.pending.length}
              />
            </div>
          </Section>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Main needs" value={data.cover.gift.length + data.cover.trade.length + data.cover.rest} hint="collect settings + unlock cards" />
            <Stat label="Alt can gift" value={data.cover.gift.length} hint="◊ to ◊◊◊◊" />
            <Stat label="Alt can trade" value={data.cover.trade.length} hint="☆ and up" />
            <Stat label="Still to find" value={data.cover.rest} hint="packs or Wonder Picks" />
          </div>

          <Section
            icon={<Gift className="size-5 text-emerald-400" />}
            title="Gift to main"
            note={giftNote('main', 'Main can receive one gift a day. Latest-set unlock cards first, then cards main has never had, rarest first.')}
          >
            {data.cover.gift.length === 0 ? (
              <p className="py-6 text-center text-neutral-500">The alt has no ◊–◊◊◊◊ cards that main needs.</p>
            ) : (
              <GiftGrid
                cards={data.cover.gift}
                receiver={main as Collection}
                sentToday={giftDates.main === today()}
                disabled={transfer.isPending}
                onGift={(c) => gift(c, 'main')}
              />
            )}
          </Section>

          {data.toAlt.length > 0 && (
            <Section
              icon={<Gift className="size-5 text-amber-400" />}
              title="Gift to alt"
              note={giftNote('alt', "The alt can receive one a day too. Main's spare latest-set ◊–◊◊◊◊ the alt hasn't registered, for the alt's own unlock.")}
            >
              <GiftGrid
                cards={data.toAlt}
                receiver={alt as Collection}
                sentToday={giftDates.alt === today()}
                disabled={transfer.isPending}
                onGift={(c) => gift(c, 'alt')}
              />
            </Section>
          )}

          <Section
            icon={<Repeat className="size-5 text-sky-400" />}
            title="Trade to main"
            note="Main sends back its least valuable spare of the same rarity. Both accounts pay Shinedust, so only for cards main needs. &quot;Traded&quot; swaps both cards."
          >
            {data.trades.length === 0 ? (
              <p className="py-6 text-center text-neutral-500">The alt has no ☆-and-up cards that main needs.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.trades.map(({ card, back }) => (
                  <div key={card.internal_id} className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-2">
                    <CardThumb
                      className="w-16 shrink-0"
                      card={card}
                      badge={countsForUnlock(main as Collection, card) && <UnlockBadge />}
                      onClick={() => setSelectedCardId(card.internal_id)}
                    />
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
                      <span className="text-xs text-neutral-500 tabular-nums">
                        {shinedustCost[card.rarity as TradableRarity]?.toLocaleString()} Shinedust per account
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
