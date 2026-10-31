// Personal fork: "best pick" banner — the answer for the current sort without scanning the grid.
import { Trophy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CardThumb, SetLogo } from '@/components/CardThumb'
import { ownsCard } from '@/lib/packValue'
import { twoStarPosition } from '@/lib/rankings'
import { getCardNameByLang } from '@/lib/utils'
import { getCardValue } from '@/lib/ValueDB'
import { useCollection, useSelectedCard } from '@/services/collection/useCollection'
import { type PackRow, pct, personalSorts, type SortKey } from '../types'

const headline: Record<SortKey, (p: PackRow) => string> = {
  meanAdj: (p) => `Average ☆☆ value ${Math.round(p.meanAdj)}`,
  forMe: (p) => `Value for you ${Math.round(p.forMe)}`,
  pNew: (p) => `${pct(p.pNew)} chance the ☆☆ is new to you`,
  pTrainerOrRainbow: (p) => `${pct(p.pTrainerOrRainbow)} chance of a trainer or rainbow`,
}

export function PackSummary({ pack, sortKey }: { pack: PackRow; sortKey: SortKey }) {
  const { t, i18n } = useTranslation(['common/sets', 'common/packs'])
  const { data: collection } = useCollection()
  const { setSelectedCardId } = useSelectedCard()
  // for personal sorts, highlight the best card you're still missing
  const highlight = (personalSorts.includes(sortKey) && pack.cards.find((c) => !ownsCard(collection, c))) || pack.best
  const value = getCardValue(highlight.card_id)

  return (
    <section
      className="mb-6 flex items-center gap-4 rounded-xl border border-neutral-800 p-4 sm:gap-6 sm:p-5"
      style={{ background: `linear-gradient(120deg, ${pack.color}33, transparent 70%)` }}
    >
      <div className="min-w-0 flex-1">
        <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-amber-400">
          <Trophy className="size-3.5" /> Best pick
        </p>
        <div className="flex items-center gap-3">
          <SetLogo expansionId={pack.expansionId} className="hidden h-10 max-w-[90px] sm:block" />
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold sm:text-2xl">{t(pack.packName, { ns: 'common/packs' })}</h2>
            <p className="truncate text-sm text-neutral-400">{t(pack.expansionName, { ns: 'common/sets' })}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-neutral-200">{headline[sortKey](pack)}</p>
        <p className="mt-1 text-xs text-neutral-400">
          Top card: {getCardNameByLang(highlight, i18n.language)} (#{twoStarPosition(highlight.card_id)} · Elo {value?.adj})
        </p>
      </div>
      <CardThumb
        card={highlight}
        owned={ownsCard(collection, highlight)}
        className="w-24 shrink-0 shadow-lg sm:w-28"
        onClick={() => setSelectedCardId(highlight.internal_id)}
      />
    </section>
  )
}
