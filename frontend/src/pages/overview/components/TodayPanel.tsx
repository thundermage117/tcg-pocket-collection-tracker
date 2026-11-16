// Personal fork: the overview's one answer to "what should I do today". The headline is upstream's pick (the pack most
// likely to give any new card, under the page's filters); the strip under it lists the other things worth doing: main's
// progress towards the latest expansion's ☆☆ Wonder Pick unlock (see lib/altSupport.ts) with the pack that moves it
// along, the best pack for ☆☆, and the alt's next gift and trade.
import { ArrowLeftRight, Check, ChevronRight, Gift, type LucideIcon, Package, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { latestExpansion, readGiftDate, today } from '@/lib/altSupport'
import { expansions } from '@/lib/CardsDB'
import type { BoosterValue } from '@/lib/packValue'
import { getCardNameByLang } from '@/lib/utils'
import { BestPackCard } from '@/pages/overview/components/BestPackCard'
import type { PackChance } from '@/pages/overview/packChances'
import { useUnlockPlan } from '@/pages/overview/useUnlockPlan'
import { oneIn } from '@/pages/packs/types'
import type { Pack } from '@/types'

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

function Action({ to, icon: Icon, label, title, children }: { to: string; icon: LucideIcon; label: string; title: string; children: ReactNode }) {
  return (
    <li className="min-w-0">
      <Link to={to} title={title} className="group flex min-h-10 items-center gap-2 px-3 text-sm transition-colors hover:bg-white/5 sm:px-4">
        <Icon className="size-4 shrink-0 text-violet-300" />
        <span className="shrink-0 text-neutral-400">{label}</span>
        <span className="min-w-0 truncate text-neutral-400">{children}</span>
        <ChevronRight className="ml-auto size-4 shrink-0 text-neutral-500 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  )
}

const strong = 'font-medium text-neutral-100'

// "1 in 48" or, for common pulls, "62%": short enough for half the panel's width; each row's title says what it counts
const odds = (p: number) => (p >= 0.5 ? `${Math.round(100 * p)}%` : oneIn(p))

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

  // pack names repeat across expansions (pikachupack), so "same pack" compares the expansion too
  const twoStarIsHeadline =
    twoStar !== undefined &&
    headline !== undefined &&
    headline.name === twoStar.packName &&
    expansions.find((e) => e.id === twoStar.expansionId)?.packs.includes(headline)
  const progress = plan && !plan.finished ? plan.progress : undefined
  const unlockPack = progress && plan?.best && plan.best.chance > 0 ? plan.best : undefined
  const diamondsLeft = progress ? progress.diamonds.total - progress.diamonds.have : 0
  const starsLeft = progress ? progress.star.total - progress.star.have : 0
  // what the alt can hand over for the stage main is on
  const onAlt = plan ? (diamondsLeft > 0 ? plan.altHas : plan.altStars) : 0
  const gift = plan?.cover.gift[0]
  const trade = plan?.cover.trade[0]
  const giftSent = readGiftDate('main') === today()

  const actions = [
    progress && (
      <li key="unlock" className="min-w-0 sm:col-span-2">
        <Link
          to="/alt"
          title={`☆☆ Wonder Pick unlock, ${t(latestExpansion.name, { ns: 'common/sets' })}: ◊–◊◊◊◊ ${progress.diamonds.have}/${progress.diamonds.total}, ☆ ${progress.star.have}/${progress.star.total}${unlockPack ? `. ${packName(unlockPack.pack)} is the pack most likely to give a card it still needs.` : ''}`}
          className="group relative flex flex-col gap-1.5 py-2.5 pr-9 pl-3 text-sm transition-colors hover:bg-white/5 sm:pr-10 sm:pl-4"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Sparkles className={`size-4 shrink-0 ${diamondsLeft + starsLeft === 0 ? 'text-emerald-400' : 'text-violet-300'}`} />
            <span className="shrink-0 text-neutral-400">Unlock</span>
            <span className="min-w-0 truncate text-neutral-400">
              {diamondsLeft + starsLeft === 0 ? (
                // only the ☆☆ left to register, which the Wonder Picks now show
                <span className={strong}>☆☆ Wonder Picks unlocked</span>
              ) : (
                <span className={strong}>{diamondsLeft > 0 ? `${diamondsLeft} ◊ to go` : `${starsLeft} ☆ to go`}</span>
              )}
              {unlockPack && (
                <>
                  {' '}
                  · <span className={strong}>{unlockPack.pack === headline ? 'same pack' : packName(unlockPack.pack)}</span> {odds(unlockPack.chance)}
                </>
              )}
            </span>
          </span>
          <span className="flex min-w-0 items-center gap-2 pl-6">
            <StageBar have={progress.diamonds.have} alt={plan?.altHas ?? 0} total={progress.diamonds.total} state={diamondsLeft > 0 ? 'active' : 'done'} />
            <StageBar
              have={progress.star.have}
              alt={plan?.altStars ?? 0}
              total={progress.star.total}
              state={starsLeft === 0 ? 'done' : diamondsLeft > 0 ? 'later' : 'active'}
            />
            {diamondsLeft + starsLeft === 0 ? (
              <Check className="size-3.5 shrink-0 text-emerald-400" strokeWidth={3} />
            ) : (
              onAlt > 0 && (
                <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-violet-300 text-xs">
                  <span className="inline-block h-2 w-3 rounded-sm" style={{ background: stripes(0.7, 0.25) }} />
                  {onAlt} on the alt
                </span>
              )
            )}
          </span>
          <ChevronRight className="absolute top-3 right-3 size-4 text-neutral-500 transition-transform group-hover:translate-x-0.5 sm:right-4" />
        </Link>
      </li>
    ),
    twoStar && twoStar.perPack > 0 && (
      // explicit rarity, tier and style: a bare /packs reopens whatever was last picked there, which may not be the pick named here
      <Action
        key="2s"
        to="/packs?rarity=2s&tier=all&kind=all"
        icon={Package}
        label="☆☆"
        title="The pack most likely to give a ☆☆ you're missing, and how often a pack does"
      >
        {twoStarIsHeadline ? (
          <span className={strong}>Same pack</span>
        ) : (
          <>
            <span className={strong}>{packName(twoStar.packName)}</span> <span className="text-xs tabular-nums">{twoStar.expansionId}</span>
          </>
        )}{' '}
        · {odds(twoStar.perPack)}
      </Action>
    ),
    gift && (
      <Action key="gift" to="/alt" icon={Gift} label="Gift" title="The alt's next gift to main (one a day)">
        <span className={strong}>
          {getCardNameByLang(gift, i18n.language)} {gift.rarity}
        </span>
        {giftSent && <span className="text-emerald-400"> · ✓ sent today</span>}
      </Action>
    ),
    trade && (
      <Action key="trade" to="/alt" icon={ArrowLeftRight} label="Trade" title="The alt's next trade to main">
        <span className={strong}>
          {getCardNameByLang(trade, i18n.language)} {trade.rarity}
        </span>
      </Action>
    ),
  ].filter(Boolean)

  const footer = actions.length > 0 && (
    // rows pair up on desktop, after the full-width unlock row; a last row left without a partner takes the full width too
    <ul
      className={`grid border-neutral-700 border-t bg-neutral-900/60 py-1 sm:grid-cols-2 ${progress ? 'sm:[&>li:last-child:nth-child(even)]:col-span-2' : 'sm:[&>li:last-child:nth-child(odd)]:col-span-2'}`}
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
