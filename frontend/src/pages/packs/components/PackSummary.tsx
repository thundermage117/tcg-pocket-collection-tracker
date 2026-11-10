// Personal fork: "best pick" banner — the answer for the current filters without scanning the grid.
import { Trophy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CardThumb, SetLogo } from '@/components/CardThumb'
import { TierChip } from '@/components/TierChip'
import { ownsCard } from '@/lib/packValue'
import { getCardNameByLang } from '@/lib/utils'
import { useSelectedCard } from '@/services/collection/useCollection'
import { useMainWithAlt } from '@/services/profile/useProfileCollection'
import { cardTier, describeTarget, gives, type PackRow, packOdds, type TargetFilters } from '../types'

export function PackSummary({ pack, filters }: { pack: PackRow; filters: TargetFilters }) {
  const { t, i18n } = useTranslation(['common/sets', 'common/packs'])
  const { data: collection } = useMainWithAlt()
  const { setSelectedCardId } = useSelectedCard()
  // the best card that counts for these filters; the pack's top card when none does
  const highlight = pack.wanted[0] ?? pack.best
  const highlightTier = cardTier(highlight)

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
        <p className="mt-3 text-sm text-neutral-200">
          {pack.perPack > 0 ? (
            <>
              <span className="font-semibold">{packOdds(pack.perPack)}</span> {gives(pack.perPack)} {describeTarget(filters)}
              <span className="text-neutral-400"> ({pack.wanted.length} in this pack)</span>
            </>
          ) : (
            `No pack here gives ${describeTarget(filters)}. Try a lower tier, another style or series.`
          )}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-400">
          <span className="truncate">
            {highlight === pack.wanted[0] ? (filters.onlyMissing ? "Best card you're missing" : 'Best matching card') : 'Top card'}:{' '}
            {getCardNameByLang(highlight, i18n.language)}
          </span>
          {highlightTier && <TierChip tier={highlightTier} className="shrink-0" />}
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
