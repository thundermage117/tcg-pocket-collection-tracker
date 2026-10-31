// Personal fork: one booster on the packs page — top ☆☆ cards, the stat for the chosen goal, expandable pool.
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CardThumb, SetLogo } from '@/components/CardThumb'
import { Progress } from '@/components/ui/progress'
import { ownsCard } from '@/lib/packValue'
import { twoStarPosition } from '@/lib/rankings'
import { cn } from '@/lib/utils'
import { PROVISIONAL_VOTES } from '@/lib/ValueDB'
import { useCollection, useSelectedCard } from '@/services/collection/useCollection'
import { fill, goals, type PackRow, type Ranges, type SortKey, sortOrder } from '../types'
import { PackPool } from './PackPool'

interface Props {
  pack: PackRow
  position: number
  sortKey: SortKey
  ranges: Ranges
  total: number
  expanded: boolean
  onToggle: () => void
}

export function PackCard({ pack, position, sortKey, ranges, total, expanded, onToggle }: Props) {
  const { t } = useTranslation(['common/sets', 'common/packs'])
  const { data: collection } = useCollection()
  const { setSelectedCardId } = useSelectedCard()
  const provisional = pack.minVotes < PROVISIONAL_VOTES
  const complete = collection !== undefined && pack.pNew === 0
  const goal = goals[sortKey]
  const value = pack[sortKey]
  const otherGoals = sortOrder.filter((key) => key !== sortKey && (collection || key !== 'perPackNew'))
  const poolCounts = [
    `${pack.cards.length} ☆☆`,
    collection && !complete && `${pack.missing} missing`,
    `${pack.top50Count} top-50`,
    `${pack.trainerOrRainbowCount} trainer/rainbow`,
  ].filter(Boolean)

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
          <p className="truncate text-xs text-neutral-400">{t(pack.expansionName, { ns: 'common/sets' })}</p>
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
              labelTitle={`#${twoStarPosition(card.card_id)} of all ☆☆ in the community ranking`}
              onClick={() => setSelectedCardId(card.internal_id)}
            />
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-sm">
          <span className="font-semibold tabular-nums text-neutral-100">{goal.stat(pack, total)}</span>{' '}
          <span className="text-neutral-400">{goal.caption(pack, total)}</span>
        </p>
        <Progress value={value > 0 ? Math.round(100 * fill(value, ranges[sortKey])) : 0} barColor={pack.color} className="h-1.5" />
        <p className="text-xs text-neutral-500">{poolCounts.join(' · ')}</p>
      </div>

      {expanded && (
        <dl className="grid gap-x-6 gap-y-1 border-t border-neutral-800 pt-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
          {otherGoals.map((key) => (
            <div key={key} className="flex justify-between gap-2">
              <dt className="text-neutral-400">{goals[key].label}</dt>
              <dd className="text-right tabular-nums text-neutral-200">
                {goals[key].stat(pack, total)} <span className="text-neutral-500">{goals[key].caption(pack, total)}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}

      {expanded && <PackPool cards={pack.cards} expansionId={pack.expansionId} />}

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
