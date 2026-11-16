// Personal fork: the overview's one answer to "what should I do today". The headline is upstream's pick (the pack most
// likely to give any new card, under the page's filters); the strip under it lists the other things worth doing, which
// used to be spread over the pick's ☆☆ link and the unlock tile: the best pack for ☆☆, the pack that moves the Wonder
// Pick unlock along, and the alt's next gift and trade.
import { ArrowLeftRight, ChevronRight, Gift, type LucideIcon, Package, Sparkles } from 'lucide-react'
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
  const unlock = plan && !plan.finished && plan.best && plan.best.chance > 0 ? plan.best : undefined
  const gift = plan?.cover.gift[0]
  const trade = plan?.cover.trade[0]
  const giftSent = readGiftDate('main') === today()

  const actions = [
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
    unlock && (
      <Action
        key="unlock"
        to="/alt"
        icon={Sparkles}
        label="Unlock"
        title={`The ${t(latestExpansion.name, { ns: 'common/sets' })} pack most likely to give a card the ☆☆ Wonder Pick unlock still needs, and how often a pack does`}
      >
        <span className={strong}>{unlock.pack === headline ? 'Same pack' : packName(unlock.pack)}</span> · {odds(unlock.chance)}
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
    <ul className="grid border-neutral-700 border-t bg-neutral-900/60 py-1 sm:grid-cols-2" aria-label="Also today">
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
