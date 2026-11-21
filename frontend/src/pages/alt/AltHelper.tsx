// Personal fork: how the alt account helps the main one (see lib/altSupport.ts). The latest set's unlock for both
// accounts, gifts both ways (◊–◊◊◊◊, one received a day) and trades to main (☆ and up), each moved between the two
// collections with one click. A trade opens in Trade check, which finalizes it.
import { ArrowRight, Gift, Library, Package, Repeat, ScanLine, Sparkles } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { CardThumb } from '@/components/CardThumb'
import { CardGridSkeleton, SkeletonGrid } from '@/components/Skeleton'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useUndoTransferToast } from '@/hooks/useUndoToast'
import {
  type AltTrade,
  allTwoStarsRegistered,
  altCovers,
  bestAltPacks,
  bestUnlockPack,
  canMoveToMain,
  countsForUnlock,
  giftKey,
  giftsToAlt,
  KEEP_FOR_TRADING,
  latestExpansion,
  planSpares,
  readGiftDate,
  today,
  type UnlockProgress,
  unlockProgress,
} from '@/lib/altSupport'
import { getLocalizedImagePath } from '@/lib/imageLocales'
import { shinedustCost } from '@/lib/tradeFairness'
import { getCardNameByLang } from '@/lib/utils'
import { oneIn } from '@/pages/packs/types'
import { useLoginDialog } from '@/services/auth/useAuth'
import { useSelectedCard } from '@/services/collection/useCollection'
import type { Profile } from '@/services/profile/useProfile'
import { setActiveProfile, useProfileAccount } from '@/services/profile/useProfile'
import { useProfileCollection, useTransferCards } from '@/services/profile/useProfileCollection'
import type { Card, Collection, TradableRarity } from '@/types'
import { AltPackNote, AltPackPick } from './AltPackPick'

const PREVIEW = 16

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
function UnlockCard({
  title,
  progress,
  covered,
  pending,
  allTwoStars,
  showBestPack = true,
}: {
  title: string
  progress: UnlockProgress
  covered: number
  pending: Card[]
  allTwoStars: boolean // every ☆☆ registered too: the ☆☆ Wonder Picks reportedly stop
  showBestPack?: boolean // the alt's pick has its own section
}) {
  const { t } = useTranslation(['common/packs'])
  const diamondsLeft = progress.diamonds.total - progress.diamonds.have
  const starsLeft = progress.star.total - progress.star.have
  const best = showBestPack ? bestUnlockPack(pending) : undefined
  const { setSelectedCardId } = useSelectedCard()
  const [showMissing, setShowMissing] = useState(false)
  const pendingIds = new Set(pending.map((c) => c.internal_id))
  const groups = [
    { label: 'Only from packs or Wonder Picks', cards: pending },
    { label: 'Can come from the other account', cards: progress.missing.filter((c) => !pendingIds.has(c.internal_id)) },
  ].filter((g) => g.cards.length > 0)
  const status =
    diamondsLeft > 0
      ? `${diamondsLeft} ◊ to go before 24-hour Wonder Picks show its missing ☆ / ☆☆.`
      : starsLeft > 0
        ? `24-hour Wonder Picks show missing ☆ or ☆☆; ${starsLeft} ☆ to go for ☆☆ only.`
        : allTwoStars
          ? 'Done: it has every ☆☆ too, so 24-hour Wonder Picks reportedly stop showing them.'
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
      {progress.missing.length > 0 && (
        <>
          <Button variant="ghost" size="sm" className="self-start" aria-expanded={showMissing} onClick={() => setShowMissing((show) => !show)}>
            {showMissing ? 'Hide' : 'Show'} the {progress.missing.length} missing {progress.missing.length === 1 ? 'card' : 'cards'}
          </Button>
          {showMissing &&
            groups.map((group) => (
              <div key={group.label}>
                <p className="mb-2 text-xs text-neutral-400">
                  {group.label} ({group.cards.length})
                </p>
                <div className="grid grid-cols-5 gap-x-2 gap-y-3 sm:grid-cols-8 md:grid-cols-6">
                  {group.cards.map((card) => (
                    <CardThumb key={card.internal_id} card={card} label={card.rarity} onClick={() => setSelectedCardId(card.internal_id)} />
                  ))}
                </div>
              </div>
            ))}
        </>
      )}
    </div>
  )
}

const UnlockBadge = () => (
  <span title="Counts towards the latest expansion's Wonder Pick unlock" className="flex rounded-full bg-violet-500 p-0.5 text-white shadow">
    <Sparkles className="size-3" />
  </span>
)

/** A card in a trade row; the whole row is a link, so no button of its own. */
function TradeImage({ card, badge }: { card: Card; badge?: ReactNode }) {
  const { i18n } = useTranslation()
  return (
    <span className="relative w-16 shrink-0">
      <img
        src={getLocalizedImagePath(card, i18n.language)}
        alt={getCardNameByLang(card, i18n.language)}
        loading="lazy"
        decoding="async"
        className="aspect-[367/512] w-full rounded-md object-cover"
      />
      {badge && <span className="absolute top-1 left-1">{badge}</span>}
    </span>
  )
}

const rowClass = 'flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-2'

/** One alt-to-main trade: a link to Trade check when main has a cheap spare to send back, else what to do meanwhile. */
function TradeRow({ trade: { card, back, outside }, main }: { trade: AltTrade; main: Collection }) {
  const { i18n } = useTranslation()
  const name = (c: Card) => getCardNameByLang(c, i18n.language)
  const image = <TradeImage card={card} badge={countsForUnlock(main, card) && <UnlockBadge />} />
  const title = (
    <span className="truncate font-medium">
      {name(card)} <span className="text-neutral-400">{card.rarity}</span>
    </span>
  )
  const cost = (
    <span className="text-xs text-neutral-500 tabular-nums">{shinedustCost[card.rarity as TradableRarity]?.toLocaleString()} Shinedust per account</span>
  )

  if (back) {
    return (
      <Link
        to={`/trade/check?${new URLSearchParams({ give: back.card_id, get: card.card_id, alt: '1' })}`}
        className={`${rowClass} transition-colors hover:border-neutral-600 hover:bg-neutral-800/60`}
      >
        {image}
        <ArrowRight className="size-4 shrink-0 rotate-180 text-neutral-500" aria-label="for" />
        <TradeImage card={back} />
        <div className="flex min-w-0 grow flex-col gap-1.5 text-sm">
          {title}
          <span className="truncate text-xs text-neutral-400">main gives {name(back)}</span>
          {cost}
        </div>
      </Link>
    )
  }
  return (
    <div className={rowClass}>
      {image}
      <ArrowRight className="size-4 shrink-0 rotate-180 text-neutral-500" aria-label="for" />
      <div className="flex aspect-[367/512] w-16 shrink-0 items-center justify-center rounded-md border border-dashed border-neutral-700 p-1 text-center text-[11px] text-neutral-400">
        waiting
      </div>
      <div className="flex min-w-0 grow flex-col gap-1.5 text-sm">
        {title}
        <span className="text-xs text-neutral-400">Main has no low-value {card.rarity} spare to send back yet.</span>
        {outside && (
          <Link to={`/trade/check?${new URLSearchParams({ give: outside.card_id, get: card.card_id })}`} className="text-xs text-sky-400 hover:underline">
            Or trade {name(outside)} with another player for it
          </Link>
        )}
      </div>
    </div>
  )
}

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
  const [open, setOpen] = useState(false) // today's gift is sent: the queue folds away until asked for
  const shown = showAll ? cards : cards.slice(0, PREVIEW)
  if (sentToday && !open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Show the {cards.length} queued {cards.length === 1 ? 'card' : 'cards'}
      </Button>
    )
  }
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
            <Button size="sm" variant={sentToday ? 'ghost' : 'outline'} className="h-7 px-1 text-xs" disabled={disabled} onClick={() => onGift(card)}>
              Mark gifted
            </Button>
          </div>
        ))}
      </div>
      {cards.length > PREVIEW && (
        <Button variant="ghost" size="sm" className="mt-3" onClick={() => setShowAll((all) => !all)}>
          {showAll ? 'Show fewer' : `Show all ${cards.length}`}
        </Button>
      )}
      {sentToday && (
        <Button variant="ghost" size="sm" className="mt-3" onClick={() => setOpen(false)}>
          Hide
        </Button>
      )}
    </>
  )
}

export default function AltHelper() {
  const { t, i18n } = useTranslation(['common/sets'])
  const { setIsLoginDialogOpen } = useLoginDialog()
  const { data: mainAccount, isLoading: isLoadingAccount } = useProfileAccount('main')
  const { data: main } = useProfileCollection('main')
  const { data: alt } = useProfileCollection('alt')
  const transfer = useTransferCards()
  const undoToast = useUndoTransferToast()
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

    return {
      cover,
      toAlt,
      packPick: bestAltPacks(main, settings, alt),
      trades: planSpares(main, settings, alt).trades,
      mainUnlock: { progress: mainUnlock, pending: mainUnlock.missing.filter((c) => !altCanGive(c)), allTwoStars: allTwoStarsRegistered(main) },
      altUnlock: { progress: altUnlock, pending: altUnlock.missing.filter((c) => !toAltIds.has(c.internal_id)), allTwoStars: allTwoStarsRegistered(alt) },
    }
  }, [main, alt, mainAccount])

  const setGiftDate = (to: Profile, date: string | null) => {
    setGiftDates((dates) => ({ ...dates, [to]: date }))
    try {
      if (date) {
        localStorage.setItem(giftKey(to), date)
      } else {
        localStorage.removeItem(giftKey(to))
      }
    } catch {
      // only a reminder
    }
  }

  // one tap moves the card, so the toast offers Undo rather than asking first
  const gift = (card: Card, to: Profile) => {
    const previousDate = giftDates[to]
    transfer.mutate([{ internal_id: card.internal_id, from: to === 'main' ? 'alt' : 'main', to }], {
      onSuccess: ({ before }) => {
        setGiftDate(to, today())
        undoToast(`Gifted ${name(card)} to ${to}`, `Moved one copy from ${to === 'main' ? 'the alt' : 'main'}.`, before, () => setGiftDate(to, previousDate))
      },
    })
  }

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
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Alt account</h1>
          <p className="mt-1 text-sm text-neutral-400">How the alt helps main: gifts, trades to main and the latest expansion's Wonder Pick unlock.</p>
        </div>
        <div className="flex gap-2">
          {/* opens the page with Alt picked in its Main / Alt switch */}
          <Link to="/collection" onClick={() => setActiveProfile('alt')}>
            <Button variant="outline" size="sm" className="border-amber-500/60 text-amber-100 hover:bg-amber-500/10">
              <Library /> Edit alt collection
            </Button>
          </Link>
          <Link to="/scan" onClick={() => setActiveProfile('alt')}>
            <Button variant="outline" size="sm" className="border-amber-500/60 text-amber-100 hover:bg-amber-500/10">
              <ScanLine /> Scan alt cards
            </Button>
          </Link>
        </div>
      </header>

      {!data ? (
        <div role="status" aria-label="Loading">
          <SkeletonGrid count={3} className="mb-6 gap-3 sm:grid-cols-3" itemClassName="h-20" />
          <CardGridSkeleton count={16} className="grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-6 md:grid-cols-8" />
        </div>
      ) : (
        <>
          <Section
            icon={<Sparkles className="size-5 text-violet-400" />}
            title={`${t(latestExpansion.name, { ns: 'common/sets' })}: ☆☆ Wonder Pick unlock`}
            note="Community-tested, not official: with every ◊–◊◊◊◊ of the newest expansion registered, an account's 24-hour Wonder Picks show ☆ / ☆☆ it's missing; with every ☆ too, only ☆☆. Worth it on both accounts: the alt's ☆☆ can be traded to main."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <UnlockCard
                title="Main"
                progress={data.mainUnlock.progress}
                pending={data.mainUnlock.pending}
                covered={data.mainUnlock.progress.missing.length - data.mainUnlock.pending.length}
                allTwoStars={data.mainUnlock.allTwoStars}
              />
              <UnlockCard
                title="Alt"
                progress={data.altUnlock.progress}
                pending={data.altUnlock.pending}
                covered={data.altUnlock.progress.missing.length - data.altUnlock.pending.length}
                allTwoStars={data.altUnlock.allTwoStars}
                showBestPack={false}
              />
            </div>
          </Section>

          <Section icon={<Package className="size-5 text-amber-400" />} title="Which pack the alt should open" note={<AltPackNote pick={data.packPick} />}>
            <AltPackPick pick={data.packPick} />
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
            note={giftNote('main', 'Main can receive one gift a day. Latest-expansion unlock cards first, then cards main has never had, rarest first.')}
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
              note={giftNote(
                'alt',
                "The alt can receive one a day too. Main's spare latest-expansion ◊–◊◊◊◊ the alt hasn't registered, for the alt's own unlock.",
              )}
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
            note={`Tap a trade to check it and finalize. Main sends back its least valuable spare of that rarity: the alt never trades it on, so a spare other players want (score ${KEEP_FOR_TRADING}+ for its rarity) is kept for trading with them, and a trade waits until a cheap spare turns up. Both accounts pay Shinedust, so only for cards main needs.`}
          >
            {data.trades.length === 0 ? (
              <p className="py-6 text-center text-neutral-500">The alt has no ☆-and-up cards that main needs.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.trades.map((trade) => (
                  <TradeRow key={trade.card.internal_id} trade={trade} main={main as Collection} />
                ))}
              </div>
            )}
          </Section>
        </>
      )}
    </main>
  )
}
