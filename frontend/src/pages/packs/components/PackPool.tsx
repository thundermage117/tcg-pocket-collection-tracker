// Personal fork: every ☆☆ a booster can give, best first.
import { Link } from 'react-router'
import { CardThumb } from '@/components/CardThumb'
import { ownsCard } from '@/lib/packValue'
import { twoStarPosition } from '@/lib/rankings'
import { getCardValue, isProvisional, kindLabel } from '@/lib/ValueDB'
import { useSelectedCard } from '@/services/collection/useCollection'
import { useMainWithAlt } from '@/services/profile/useProfileCollection'
import type { Card, ExpansionId } from '@/types'

export function PackPool({ cards, expansionId }: { cards: Card[]; expansionId: ExpansionId }) {
  const { data: collection } = useMainWithAlt()
  const { setSelectedCardId } = useSelectedCard()

  return (
    <div className="border-t border-neutral-800 pt-4">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {cards.map((card) => {
          const v = getCardValue(card.card_id)
          return (
            <div key={card.card_id} className="flex flex-col gap-1">
              <CardThumb
                card={card}
                owned={ownsCard(collection, card)}
                label={`#${twoStarPosition(card.card_id)}${isProvisional(v) ? '*' : ''}`}
                onClick={() => setSelectedCardId(card.internal_id)}
              />
              <div className="flex justify-between text-[11px] text-neutral-400 tabular-nums">
                <span>{v?.kind ? kindLabel[v.kind] : ''}</span>
                <span>{v?.adj}</span>
              </div>
            </div>
          )
        })}
      </div>
      <Link
        to={`/rankings?set=${expansionId}`}
        className="mt-3 inline-block text-xs text-neutral-400 underline-offset-2 hover:text-neutral-200 hover:underline"
      >
        See this set in the ☆☆ ranking →
      </Link>
    </div>
  )
}
