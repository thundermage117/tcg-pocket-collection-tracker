// Personal fork: LF / FT cards as an image grid, one block per expansion.
import { Flame } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CardThumb, SetLogo } from '@/components/CardThumb'
import { getExpansionById } from '@/lib/CardsDB'
import { twoStarPosition } from '@/lib/rankings'
import { demandRatio, getCardValue } from '@/lib/ValueDB'
import { useSelectedCard } from '@/services/collection/useCollection'
import type { SetGroup, TradeItem } from '../tradeGroups'

/** Short value hint under each card: ☆☆ rank when known, else trade demand. */
function hint(item: TradeItem) {
  const position = twoStarPosition(item.card.card_id)
  if (position !== undefined) {
    return `☆☆ #${position}`
  }
  const ratio = demandRatio(getCardValue(item.card.card_id))
  return ratio > 0 ? `demand ×${ratio.toFixed(1)}` : ''
}

// FT: lots of people want it. LF: few people offer it.
export const hotLabel = { ft: 'In demand: easy to trade away', lf: 'Scarce: few people offer it' }

export function TradeGrid({ groups, empty, side }: { groups: SetGroup[]; empty: string; side: 'lf' | 'ft' }) {
  const { t } = useTranslation('common/sets')
  const { setSelectedCardId } = useSelectedCard()

  if (groups.length === 0) {
    return <p className="py-12 text-center text-neutral-400">{empty}</p>
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.id}>
          <header className="mb-3 flex items-center gap-3 border-b border-neutral-800 pb-2">
            <SetLogo expansionId={group.id} className="h-7 max-w-[64px]" />
            <h3 className="font-semibold">{t(getExpansionById(group.id).name)}</h3>
            <span className="text-sm text-neutral-500">{group.items.length}</span>
          </header>
          <div className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-6 md:grid-cols-8">
            {group.items.map((item) => (
              <div key={item.card.card_id} className="flex min-w-0 flex-col gap-0.5">
                <CardThumb
                  card={item.card}
                  label={item.count !== undefined ? `×${item.count}` : undefined}
                  badge={
                    item.hot && (
                      <span title={hotLabel[side]} className="flex rounded-full bg-orange-500 p-0.5 text-white shadow">
                        <Flame className="size-3" />
                      </span>
                    )
                  }
                  onClick={() => setSelectedCardId(item.card.internal_id)}
                />
                <span className="truncate text-center text-[11px] text-neutral-400 tabular-nums">{hint(item)}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
