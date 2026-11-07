// Personal fork: main's progress towards the latest set's ☆☆ Wonder Pick unlock (see lib/altSupport.ts) and the next
// thing the alt can do for it. Always main's real collection: it ignores the Main / Alt switch and "Count alt's cards".
import { ChevronRight, Sparkles } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Progress } from '@/components/ui/progress'
import { allTwoStarsRegistered, altCovers, bestUnlockPack, canMoveToMain, latestExpansion, readGiftDate, today, unlockProgress } from '@/lib/altSupport'
import { getCardNameByLang } from '@/lib/utils'
import { oneIn } from '@/pages/packs/types'
import { useProfileAccount } from '@/services/profile/useProfile'
import { useProfileCollection } from '@/services/profile/useProfileCollection'
import type { Card } from '@/types'

const packCount = latestExpansion.packs.filter((p) => p.name !== 'everypack').length

function Bar({ label, have, total }: { label: string; have: number; total: number }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex justify-between text-xs">
        <span>{label}</span>
        <span className="text-neutral-400 tabular-nums">
          {have} / {total}
        </span>
      </div>
      <Progress value={total === 0 ? 100 : (100 * have) / total} className="h-1.5" barColor="#a78bfa" />
    </div>
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
  const status =
    diamondsLeft > 0
      ? `${diamondsLeft} ◊ to go${altHas > 0 ? ` · ${altHas} the alt has` : ''}`
      : starsLeft > 0
        ? `Wonder Picks: ☆ / ☆☆ · ${starsLeft} ☆ to go`
        : 'Unlocked: daily ☆☆ Wonder Picks'
  const next = cover.gift[0] ? { kind: 'gift', card: cover.gift[0] } : cover.trade[0] && { kind: 'trade', card: cover.trade[0] }

  return (
    <Link
      to="/alt"
      className={`flex flex-col gap-2 rounded-lg border-1 border-neutral-700 border-solid bg-neutral-800 p-3 text-sm transition-colors hover:border-neutral-500 sm:px-5 ${className ?? ''}`}
    >
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 shrink-0 text-violet-400" />
        <h2 className="min-w-0 grow truncate font-bold">{t(latestExpansion.name, { ns: 'common/sets' })}: ☆☆ Wonder Pick unlock</h2>
        <ChevronRight className="size-4 shrink-0 text-neutral-400" />
      </div>
      <div className="flex gap-4">
        <Bar label="◊ – ◊◊◊◊" have={progress.diamonds.have} total={progress.diamonds.total} />
        <Bar label="☆" have={progress.star.have} total={progress.star.total} />
      </div>
      <p className="text-neutral-300">{status}</p>
      {best && best.chance > 0 && (
        <p className="text-neutral-400 text-xs">
          Best pack: <span className="text-neutral-200">{t(best.pack.name, { ns: 'common/packs' })}</span> · {oneIn(best.chance)} packs gives one
        </p>
      )}
      {next && (
        <p className="text-neutral-400 text-xs">
          Next {next.kind}:{' '}
          <span className="text-neutral-200">
            {getCardNameByLang(next.card, i18n.language)} {next.card.rarity}
          </span>
          {next.kind === 'gift' && readGiftDate('main') === today() && <span className="text-emerald-400"> · ✓ today's gift sent</span>}
        </p>
      )}
    </Link>
  )
}
