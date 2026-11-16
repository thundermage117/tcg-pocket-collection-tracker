// Personal fork: main's progress towards the latest set's ☆☆ Wonder Pick unlock (see lib/altSupport.ts) and the next
// thing the alt can do for it. Always main's real collection: it ignores the Main / Alt switch and "Count alt's cards".
import { ArrowLeftRight, Check, ChevronRight, Gift, type LucideIcon, Package, Sparkles } from 'lucide-react'
import { type ReactNode, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { SetLogo } from '@/components/CardThumb'
import { allTwoStarsRegistered, altCovers, bestUnlockPack, canMoveToMain, latestExpansion, readGiftDate, today, unlockProgress } from '@/lib/altSupport'
import { getCardNameByLang } from '@/lib/utils'
import './heatmap.css'
import { packOdds } from '@/pages/packs/types'
import { useProfileAccount } from '@/services/profile/useProfile'
import { useProfileCollection } from '@/services/profile/useProfileCollection'
import type { Card } from '@/types'

const packCount = latestExpansion.packs.filter((p) => p.name !== 'everypack').length

// One stage of the unlock: done stages get a ✓, the one not reached yet is dimmed
// The striped part after the fill is what the alt can gift or trade over: progress main gets without opening a pack
function Stage({
  step,
  label,
  have,
  alt,
  total,
  state,
}: {
  step: number
  label: string
  have: number
  alt: number
  total: number
  state: 'done' | 'active' | 'later'
}) {
  const pct = (n: number) => `${total === 0 ? 100 : (100 * n) / total}%`
  return (
    <div className={`min-w-0 flex-1 ${state === 'later' ? 'opacity-45' : ''}`}>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs">
        <span
          className={`grid size-4 shrink-0 place-items-center rounded-full font-bold text-[10px] ${state === 'done' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-violet-500/20 text-violet-300'}`}
        >
          {state === 'done' ? <Check className="size-3" strokeWidth={3} /> : step}
        </span>
        <span className="truncate text-neutral-200">{label}</span>
        <span className="ml-auto text-neutral-400 tabular-nums">
          {have}/{total}
        </span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-neutral-50/15">
        <div className={`h-full transition-[width] duration-500 ${state === 'done' ? 'bg-emerald-400' : 'bg-violet-400'}`} style={{ width: pct(have) }} />
        {alt > 0 && (
          <div
            className="h-full transition-[width] duration-500"
            style={{ width: pct(alt), background: 'repeating-linear-gradient(135deg, rgb(167 139 250 / 0.55) 0 3px, rgb(167 139 250 / 0.2) 3px 6px)' }}
          />
        )}
      </div>
    </div>
  )
}

function Chip({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <p className="flex min-w-0 items-center gap-2 rounded-md bg-neutral-900/50 px-2.5 py-1.5 text-neutral-400 text-xs">
      <Icon className="size-3.5 shrink-0 text-violet-300" />
      <span className="min-w-0 truncate">{children}</span>
    </p>
  )
}

export function UnlockTile({ className }: { className?: string }) {
  const { t, i18n } = useTranslation(['common/sets', 'common/packs'])
  const { data: mainAccount } = useProfileAccount('main')
  const { data: main } = useProfileCollection('main')
  const { data: alt } = useProfileCollection('alt')

  const data = useMemo(() => {
    if (!main || !alt || !mainAccount) {
      return undefined
    }
    const progress = unlockProgress(main)
    if (progress.missing.length === 0 && allTwoStarsRegistered(main)) {
      return undefined // nothing left for the Wonder Picks to show
    }
    const cover = altCovers(main, mainAccount.trade_rarity_settings, alt)
    const altCanGive = (c: Card) => canMoveToMain(c) && (alt.get(c.internal_id)?.amount_owned ?? 0) > 0
    const altHas = progress.missing.filter((c) => c.rarity !== '☆' && altCanGive(c)).length
    const altStars = progress.missing.filter((c) => c.rarity === '☆' && altCanGive(c)).length
    // only worth naming when the set has a choice of packs
    const best = packCount > 1 ? bestUnlockPack(progress.missing.filter((c) => !altCanGive(c))) : undefined
    return { progress, cover, altHas, altStars, best }
  }, [main, alt, mainAccount])

  if (!data) {
    return null
  }

  const { progress, cover, altHas, altStars, best } = data
  const diamondsLeft = progress.diamonds.total - progress.diamonds.have
  const starsLeft = progress.star.total - progress.star.have
  if (diamondsLeft === 0 && starsLeft === 0) {
    // Unlocked: only the ☆☆ left to register, which the Wonder Picks now show, so a slim strip is enough
    return (
      <Link
        to="/alt"
        className={`heat-foil group relative flex items-center gap-2 rounded-lg border-1 border-emerald-700/60 border-solid bg-neutral-800 px-3 py-2 text-sm transition-colors hover:border-emerald-500 sm:px-5 ${className ?? ''}`}
      >
        <Sparkles className="size-4 shrink-0 text-emerald-400" />
        <SetLogo expansionId={latestExpansion.id} className="h-6 w-auto shrink-0" />
        <span className="min-w-0 truncate">
          <span className="font-bold">☆☆ Wonder Picks unlocked</span>
          <span className="text-neutral-400 max-sm:hidden"> · they show the ☆☆ you're missing</span>
        </span>
        <ChevronRight className="ml-auto size-4 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5" />
      </Link>
    )
  }
  const headline = diamondsLeft > 0 ? { big: `${diamondsLeft} ◊`, small: 'to go, then the ☆' } : { big: `${starsLeft} ☆`, small: 'to go · Wonder Picks live' }
  const next = cover.gift[0] ? { kind: 'gift', card: cover.gift[0] } : cover.trade[0] && { kind: 'trade', card: cover.trade[0] }
  const giftSent = next?.kind === 'gift' && readGiftDate('main') === today()

  return (
    <Link
      to="/alt"
      className={`group flex flex-col gap-3 rounded-lg border-1 border-neutral-700 border-solid bg-neutral-800 p-3 text-sm transition-colors hover:border-neutral-500 sm:p-4 sm:px-5 ${className ?? ''}`}
    >
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 shrink-0 text-violet-400" />
        <h2 className="min-w-0 truncate font-bold">☆☆ Wonder Pick unlock</h2>
        <span title={t(latestExpansion.name, { ns: 'common/sets' })} className="shrink-0">
          <SetLogo expansionId={latestExpansion.id} className="h-7 w-auto sm:h-8" />
        </span>
        <ChevronRight className="ml-auto size-4 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5" />
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
        <div className="flex items-baseline gap-2 md:w-52 md:shrink-0 md:flex-col md:gap-0.5">
          <span className="font-bold text-2xl text-white tabular-nums leading-none sm:text-3xl">{headline.big}</span>
          <span className="text-neutral-400 text-xs">
            {headline.small}
            {(diamondsLeft > 0 ? altHas : altStars) > 0 && (
              <span className="whitespace-nowrap text-violet-300">
                {' '}
                ·{' '}
                <span
                  className="inline-block h-2 w-3 rounded-sm align-middle"
                  style={{ background: 'repeating-linear-gradient(135deg, rgb(167 139 250 / 0.7) 0 2px, rgb(167 139 250 / 0.25) 2px 4px)' }}
                />{' '}
                {diamondsLeft > 0 ? altHas : altStars} on the alt
              </span>
            )}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 gap-3 sm:gap-4">
          <Stage
            step={1}
            label="◊ – ◊◊◊◊"
            have={progress.diamonds.have}
            alt={altHas}
            total={progress.diamonds.total}
            state={diamondsLeft > 0 ? 'active' : 'done'}
          />
          <Stage
            step={2}
            label="☆"
            have={progress.star.have}
            alt={altStars}
            total={progress.star.total}
            state={starsLeft === 0 ? 'done' : diamondsLeft > 0 ? 'later' : 'active'}
          />
        </div>
      </div>
      {((best && best.chance > 0) || next) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {best && best.chance > 0 && (
            <Chip icon={Package}>
              Open <span className="font-medium text-neutral-100">{t(best.pack.name, { ns: 'common/packs' })}</span> · {packOdds(best.chance)}
            </Chip>
          )}
          {next && (
            <Chip icon={next.kind === 'gift' ? Gift : ArrowLeftRight}>
              Next {next.kind}:{' '}
              <span className="font-medium text-neutral-100">
                {getCardNameByLang(next.card, i18n.language)} {next.card.rarity}
              </span>
              {giftSent && <span className="text-emerald-400"> · ✓ sent today</span>}
            </Chip>
          )}
        </div>
      )}
    </Link>
  )
}
