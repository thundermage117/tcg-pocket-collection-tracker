// Personal fork: every card of the chosen rarity a booster can give, best first.
import { Link } from 'react-router'
import { CardThumb } from '@/components/CardThumb'
import { ownsCard } from '@/lib/packValue'
import { demandScore, getCardValue, isProvisional, kindLabel } from '@/lib/ValueDB'
import { useSelectedCard } from '@/services/collection/useCollection'
import { useMainWithAlt } from '@/services/profile/useProfileCollection'
import type { Card, ExpansionId, Rarity } from '@/types'
import { CardTierBadge } from './CardTierBadge'

export function PackPool({ cards, expansionId, rarity }: { cards: Card[]; expansionId: ExpansionId; rarity: Rarity }) {
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
                badge={<CardTierBadge card={card} />}
                onClick={() => setSelectedCardId(card.internal_id)}
              />
              {/* the number each scale ranks by, as on Rankings: Elo for ☆☆, wishlists per offer for the rest */}
              <div className="flex justify-between text-[11px] text-neutral-400 tabular-nums">
                <span>{v?.kind ? kindLabel[v.kind] : ''}</span>
                {rarity === '☆☆' ? (
                  <span title="Elo, adjusted for votes; * = few votes so far">
                    {v?.adj}
                    {isProvisional(v) ? '*' : ''}
                  </span>
                ) : (
                  demandScore(v) > 0 && <span title="Wishlists per trade offer, adjusted for how many are listed">×{demandScore(v).toFixed(1)}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <Link
        to={rarity === '☆☆' ? `/rankings?set=${expansionId}` : `/rankings?tab=wanted&set=${expansionId}&rarity=${encodeURIComponent(rarity)}`}
        className="mt-3 inline-block text-xs text-neutral-400 underline-offset-2 hover:text-neutral-200 hover:underline"
      >
        See this set in the {rarity === '☆☆' ? '☆☆ vote' : 'Most wanted'} ranking →
      </Link>
    </div>
  )
}
