// Personal fork: one booster on the packs page — top ☆☆ cards, value bars, expandable pool.
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CardThumb, SetLogo } from '@/components/CardThumb'
import { Progress } from '@/components/ui/progress'
import { ownsCard } from '@/lib/packValue'
import { twoStarPosition } from '@/lib/rankings'
import { cn } from '@/lib/utils'
import { PROVISIONAL_VOTES } from '@/lib/ValueDB'
import { useCollection, useSelectedCard } from '@/services/collection/useCollection'
import { fill, type PackRow, pct, type Range, type SortKey } from '../types'
import { PackPool } from './PackPool'

interface Props {
  pack: PackRow
  position: number
  sortKey: SortKey
  ranges: Record<'meanAdj' | 'forMe', Range>
  expanded: boolean
  onToggle: () => void
}

function Stat({ label, value, fraction, color, active }: { label: string; value: string; fraction: number; color: string; active: boolean }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className={active ? 'text-neutral-100 font-medium' : 'text-neutral-400'}>{label}</span>
        <span className={cn('tabular-nums', active ? 'text-neutral-100 font-semibold' : 'text-neutral-300')}>{value}</span>
      </div>
      <Progress value={Math.round(100 * fraction)} barColor={color} className={cn('h-1.5', !active && 'opacity-60')} />
    </div>
  )
}

export function PackCard({ pack, position, sortKey, ranges, expanded, onToggle }: Props) {
  const { t } = useTranslation(['common/sets', 'common/packs'])
  const { data: collection } = useCollection()
  const { setSelectedCardId } = useSelectedCard()
  const provisional = pack.minVotes < PROVISIONAL_VOTES
  const complete = collection !== undefined && pack.pNew === 0

  return (
    <article
      className={cn(
        'flex flex-col gap-4 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 transition-colors hover:border-neutral-700',
        expanded && 'sm:col-span-2 lg:col-span-3',
      )}
      style={{ borderTopColor: pack.color, borderTopWidth: 3 }}
    >
      <header className="flex items-start gap-3">
        <span
          className={cn(
            'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums',
            position === 1 ? 'bg-amber-400 text-neutral-900' : 'bg-neutral-800 text-neutral-300',
          )}
        >
          {position}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold leading-tight">{t(pack.packName, { ns: 'common/packs' })}</h2>
          <p className="truncate text-xs text-neutral-400">
            {t(pack.expansionName, { ns: 'common/sets' })} · {pack.cards.length} ☆☆
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {provisional && <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">provisional</span>}
            {complete && <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] font-medium text-green-400">all owned</span>}
          </div>
        </div>
        <SetLogo expansionId={pack.expansionId} className="h-9 max-w-[72px]" />
      </header>

      {!expanded && (
        <div className="grid grid-cols-3 gap-2">
          {pack.cards.slice(0, 3).map((card) => (
            <CardThumb
              key={card.card_id}
              card={card}
              owned={ownsCard(collection, card)}
              label={`#${twoStarPosition(card.card_id)}`}
              onClick={() => setSelectedCardId(card.internal_id)}
            />
          ))}
        </div>
      )}

      <div className={cn('grid gap-3', expanded && 'sm:grid-cols-2 lg:grid-cols-3')}>
        <Stat
          label="Value"
          value={String(Math.round(pack.meanAdj))}
          fraction={fill(pack.meanAdj, ranges.meanAdj)}
          color={pack.color}
          active={sortKey === 'meanAdj'}
        />
        <Stat label="Top 50 chance" value={pct(pack.pTop50)} fraction={pack.pTop50} color={pack.color} active={false} />
        <Stat
          label="Trainer / rainbow"
          value={pct(pack.pTrainerOrRainbow)}
          fraction={pack.pTrainerOrRainbow}
          color={pack.color}
          active={sortKey === 'pTrainerOrRainbow'}
        />
        {collection && (
          <>
            <Stat label="Chance of new" value={pct(pack.pNew)} fraction={pack.pNew} color={pack.color} active={sortKey === 'pNew'} />
            <Stat
              label="Value for me"
              value={String(Math.round(pack.forMe))}
              fraction={pack.forMe > 0 ? fill(pack.forMe, ranges.forMe) : 0}
              color={pack.color}
              active={sortKey === 'forMe'}
            />
          </>
        )}
      </div>

      {expanded && <PackPool cards={pack.cards} />}

      <button
        type="button"
        onClick={onToggle}
        className="mt-auto flex cursor-pointer items-center justify-center gap-1 rounded-md py-1.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
      >
        {expanded ? 'Show less' : `Show all ${pack.cards.length} ☆☆`}
        <ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} />
      </button>
    </article>
  )
}
