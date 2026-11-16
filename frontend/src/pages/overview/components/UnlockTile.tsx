// Personal fork: main's progress towards the latest set's ☆☆ Wonder Pick unlock (see lib/altSupport.ts) and the next
// thing the alt can do for it. Always main's real collection: it ignores the Main / Alt switch and "Count alt's cards".
import { ArrowLeftRight, Check, ChevronRight, Gift, type LucideIcon, Package, Sparkles } from 'lucide-react'
import { type ReactNode, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Progress } from '@/components/ui/progress'
import { allTwoStarsRegistered, altCovers, bestUnlockPack, canMoveToMain, latestExpansion, readGiftDate, today, unlockProgress } from '@/lib/altSupport'
import { getCardNameByLang } from '@/lib/utils'
import { packOdds } from '@/pages/packs/types'
import { useProfileAccount } from '@/services/profile/useProfile'
import { useProfileCollection } from '@/services/profile/useProfileCollection'
import type { Card } from '@/types'

const packCount = latestExpansion.packs.filter((p) => p.name !== 'everypack').length

// One stage of the unlock: done stages get a ✓, the one not reached yet is dimmed
function Stage({ step, label, have, total, state }: { step: number; label: string; have: number; total: number; state: 'done' | 'active' | 'later' }) {
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
      <Progress value={total === 0 ? 100 : (100 * have) / total} className="h-2" barColor={state === 'done' ? '#34d399' : '#a78bfa'} />
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
    // only worth naming when the set has a choice of packs
    const best = packCount > 1 ? bestUnlockPack(progress.missing.filter((c) => !altCanGive(c))) : undefined
    return { progress, cover, altHas, best }
  }, [main, alt, mainAccount])

  if (!data) {
    return null
  }

  const { progress, cover, altHas, best } = data
  const diamondsLeft = progress.diamonds.total - progress.diamonds.have
  const starsLeft = progress.star.total - progress.star.have
  const headline =
    diamondsLeft > 0
      ? { big: `${diamondsLeft} ◊`, small: 'to go, then the ☆' }
      : starsLeft > 0
        ? { big: `${starsLeft} ☆`, small: 'to go · Wonder Picks show ☆ and ☆☆' }
        : { big: 'Unlocked', small: 'daily ☆☆ Wonder Picks' }
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
        <span className="shrink-0 rounded-full bg-neutral-700/70 px-2 py-0.5 text-neutral-300 text-xs">{t(latestExpansion.name, { ns: 'common/sets' })}</span>
        <ChevronRight className="ml-auto size-4 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5" />
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
        <div className="flex items-baseline gap-2 md:w-52 md:shrink-0 md:flex-col md:gap-0.5">
          <span className="font-bold text-2xl text-white tabular-nums leading-none sm:text-3xl">{headline.big}</span>
          <span className="text-neutral-400 text-xs">
            {headline.small}
            {diamondsLeft > 0 && altHas > 0 && <span className="text-violet-300"> · {altHas} on the alt</span>}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 gap-3 sm:gap-4">
          <Stage step={1} label="◊ – ◊◊◊◊" have={progress.diamonds.have} total={progress.diamonds.total} state={diamondsLeft > 0 ? 'active' : 'done'} />
          <Stage
            step={2}
            label="☆"
            have={progress.star.have}
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
