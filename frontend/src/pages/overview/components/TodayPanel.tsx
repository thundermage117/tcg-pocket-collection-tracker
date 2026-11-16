// Personal fork: the overview's one answer to "what should I do today". The headline is upstream's pick (the pack most
// likely to give any new card, under the page's filters). The rows under it are the other things worth doing, each
// with the reason on its second line: the pack for the latest expansion's ☆☆ Wonder Pick unlock (see lib/altSupport.ts)
// with main's progress towards it, the best pack for ☆☆, and the alt's next gift and trade.
import { ArrowLeftRight, ChevronRight, Gift, type LucideIcon, Package, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { countsForUnlock, latestExpansion, readGiftDate, registered, today } from '@/lib/altSupport'
import type { BoosterValue } from '@/lib/packValue'
import { getCardNameByLang } from '@/lib/utils'
import { BestPackCard } from '@/pages/overview/components/BestPackCard'
import type { PackChance } from '@/pages/overview/packChances'
import { useUnlockPlan } from '@/pages/overview/useUnlockPlan'
import { gives, packOdds } from '@/pages/packs/types'
import type { Card, Pack } from '@/types'

const stripes = (strong: number, weak: number) => `repeating-linear-gradient(135deg, rgb(167 139 250 / ${strong}) 0 3px, rgb(167 139 250 / ${weak}) 3px 6px)`

// One stage of the unlock as a thin bar. The striped part after the fill is what the alt can gift or trade over:
// progress main gets without opening a pack. The stage not reached yet is dimmed.
function StageBar({ have, alt, total, state }: { have: number; alt: number; total: number; state: 'done' | 'active' | 'later' }) {
  const pct = (n: number) => `${total === 0 ? 100 : (100 * n) / total}%`
  return (
    <span className={`flex h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-50/15 ${state === 'later' ? 'opacity-45' : ''}`}>
      <span className={`h-full transition-[width] duration-500 ${state === 'done' ? 'bg-emerald-400' : 'bg-violet-400'}`} style={{ width: pct(have) }} />
      {alt > 0 && <span className="h-full transition-[width] duration-500" style={{ width: pct(alt), background: stripes(0.55, 0.2) }} />}
    </span>
  )
}

// One thing to do: what, and under it why. Rows pair up on desktop, so the reason wraps rather than truncates.
function Action({ to, icon: Icon, what, why, children }: { to: string; icon: LucideIcon; what: ReactNode; why: ReactNode; children?: ReactNode }) {
  return (
    <li className="min-w-0">
      <Link to={to} className="group flex h-full items-start gap-2.5 px-3 py-2 transition-colors hover:bg-white/5 sm:px-4">
        <Icon className="mt-0.5 size-4 shrink-0 text-violet-300" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-neutral-300 text-sm">{what}</span>
          <span className="block text-pretty text-neutral-400 text-xs">{why}</span>
          {children}
        </span>
        <ChevronRight className="mt-0.5 size-4 shrink-0 text-neutral-500 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  )
}

const strong = 'font-medium text-neutral-100'

const code = 'text-neutral-400 text-xs tabular-nums'

// "· 1 in 39 packs gives one", kept on one line with its dot so a wrapped reason breaks before it, not inside it
const perPack = (p: number) => <span className="whitespace-nowrap">{`· ${packOdds(p)} ${gives(p)} one`}</span>

interface Props {
  best?: PackChance // the headline pick; none when no pack has a card that's missing
  twoStar?: BoosterValue // best pack for missing ☆☆, when ☆☆ are in view
  filtered: boolean // a rarity or Value filter is on, for the caught-up text
  className?: string
}

export function TodayPanel({ best, twoStar, filtered, className }: Props) {
  const { t, i18n } = useTranslation(['common/sets', 'common/packs'])
  const plan = useUnlockPlan()
  const headline = best && best.pct > 0 ? best.pack : undefined
  const packName = (pack: Pack | string) => t(typeof pack === 'string' ? pack : pack.name, { ns: 'common/packs' })

  const progress = plan && !plan.finished ? plan.progress : undefined
  const unlockPack = progress && plan?.best && plan.best.chance > 0 ? plan.best : undefined
  const diamondsLeft = progress ? progress.diamonds.total - progress.diamonds.have : 0
  const starsLeft = progress ? progress.star.total - progress.star.have : 0
  // what the alt can hand over for the stage main is on
  const onAlt = plan ? (diamondsLeft > 0 ? plan.altHas : plan.altStars) : 0
  const gift = plan?.cover.gift[0]
  const trade = plan?.cover.trade[0]
  const giftSent = readGiftDate('main') === today()

  const unlocked = diamondsLeft + starsLeft === 0
  const toGo = diamondsLeft > 0 ? `${diamondsLeft} ◊ to go` : `${starsLeft} ☆ to go`
  const cardName = (card: Card) => `${getCardNameByLang(card, i18n.language)} ${card.rarity}`
  // why main wants the card the alt hands over
  const reason = (card: Card) =>
    !plan
      ? ''
      : countsForUnlock(plan.main, card)
        ? 'Counts towards the ☆☆ Wonder Pick unlock'
        : registered(plan.main, card.internal_id)
          ? 'An extra copy main wants'
          : 'New for main'

  const actions = [
    progress && (
      <Action
        key="unlock"
        to="/alt"
        icon={Sparkles}
        what={
          unlocked ? (
            <span className={strong}>☆☆ Wonder Picks unlocked</span>
          ) : unlockPack ? (
            <>
              Open <span className={strong}>{packName(unlockPack.pack)}</span> <span className={code}>{latestExpansion.id}</span>
            </>
          ) : (
            <span className={strong}>☆☆ Wonder Pick unlock</span>
          )
        }
        why={
          unlocked ? (
            "They now show the ☆☆ you're missing"
          ) : unlockPack ? (
            <>
              ☆☆ Wonder Pick unlock: {toGo} {perPack(unlockPack.chance)}
            </>
          ) : (
            `${toGo} in ${t(latestExpansion.name, { ns: 'common/sets' })}`
          )
        }
      >
        {!unlocked && (
          <span
            className="mt-1.5 flex items-center gap-2"
            title={`◊–◊◊◊◊ ${progress.diamonds.have}/${progress.diamonds.total} · ☆ ${progress.star.have}/${progress.star.total}`}
          >
            <StageBar have={progress.diamonds.have} alt={plan?.altHas ?? 0} total={progress.diamonds.total} state={diamondsLeft > 0 ? 'active' : 'done'} />
            <StageBar
              have={progress.star.have}
              alt={plan?.altStars ?? 0}
              total={progress.star.total}
              state={starsLeft === 0 ? 'done' : diamondsLeft > 0 ? 'later' : 'active'}
            />
            {onAlt > 0 && (
              <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-violet-300 text-xs">
                <span className="inline-block h-2 w-3 rounded-sm" style={{ background: stripes(0.7, 0.25) }} />
                {onAlt} on the alt
              </span>
            )}
          </span>
        )}
      </Action>
    ),
    twoStar && twoStar.perPack > 0 && (
      <Action
        key="2s"
        // explicit rarity, tier and style: a bare /packs reopens whatever was last picked there, which may not be the pick named here
        to="/packs?rarity=2s&tier=all&kind=all"
        icon={Package}
        what={
          <>
            Open <span className={strong}>{packName(twoStar.packName)}</span> <span className={code}>{twoStar.expansionId}</span>
          </>
        }
        why={<>Best pack for a ☆☆ you're missing {perPack(twoStar.perPack)}</>}
      />
    ),
    gift && (
      <Action
        key="gift"
        to="/alt"
        icon={Gift}
        what={
          <>
            Gift <span className={strong}>{cardName(gift)}</span> from the alt
          </>
        }
        why={
          <>
            {reason(gift)}{' '}
            {giftSent ? (
              <span className="whitespace-nowrap text-emerald-400">· ✓ gift sent today</span>
            ) : (
              <span className="whitespace-nowrap">· one gift a day</span>
            )}
          </>
        }
      />
    ),
    trade && (
      <Action
        key="trade"
        to="/alt"
        icon={ArrowLeftRight}
        what={
          <>
            Trade <span className={strong}>{cardName(trade)}</span> from the alt
          </>
        }
        why={reason(trade)}
      />
    ),
  ].filter(Boolean)

  const footer = actions.length > 0 && (
    // rows pair up on desktop; a last row left without a partner takes the full width
    <ul
      className="grid border-neutral-700 border-t bg-neutral-900/60 py-1 sm:grid-cols-2 sm:[&>li:last-child:nth-child(odd)]:col-span-2"
      aria-label="Also today"
    >
      {actions}
    </ul>
  )

  if (headline && best) {
    return <BestPackCard pack={headline} pct={best.pct} className={className} footer={footer} />
  }
  // Nothing missing in any openable pack: no pack to name, but the alt may still have something to hand over
  return (
    <div className={`flex flex-col overflow-hidden rounded-lg border-1 border-neutral-700 border-solid bg-neutral-800 ${className ?? ''}`}>
      <div className="flex flex-1 flex-col items-center justify-center p-4 sm:p-8">
        <p className="text-center font-semibold text-2xl sm:text-5xl">All caught up 🎉</p>
        <p className="mt-2 text-balance text-center text-md text-neutral-300 sm:text-xl">
          No booster pack has a card you're missing
          {filtered ? ' with these filters' : ''}.
        </p>
      </div>
      {footer}
    </div>
  )
}
