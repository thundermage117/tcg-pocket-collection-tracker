// Personal fork: every card of the chosen rarity a booster can give, best first. Under "All", the cards that count,
// grouped by rarity (rarest first), with the rest of the pack a click away.
import { useState } from 'react'
import { Link } from 'react-router'
import { CardThumb } from '@/components/CardThumb'
import { multiRarity, ownsCard, type PackRarity } from '@/lib/packValue'
import { demandScore, getCardValue, isProvisional, kindLabel } from '@/lib/ValueDB'
import { useSelectedCard } from '@/services/collection/useCollection'
import { useMainWithAlt } from '@/services/profile/useProfileCollection'
import { type Card, type ExpansionId, type Rarity, rarities } from '@/types'
import { showRarity } from '../types'
import { CardTierBadge } from './CardTierBadge'

interface Props {
  cards: Card[]
  wanted: Card[]
  expansionId: ExpansionId
  rarity: PackRarity
}

export function PackPool({ cards, wanted, expansionId, rarity }: Props) {
  const [showAll, setShowAll] = useState(false)
  const shown = multiRarity(rarity) && !showAll ? wanted : cards
  // rarest first; the cards keep their best-first order within each group
  const groups = multiRarity(rarity)
    ? rarities.toReversed().flatMap((r) => (shown.some((c) => c.rarity === r) ? [[r, shown.filter((c) => c.rarity === r)] as const] : []))
    : []

  return (
    <div className="border-t border-neutral-800 pt-4">
      {multiRarity(rarity) ? (
        <>
          <p className="mb-3 text-xs text-neutral-400">
            {showAll ? `All ${cards.length} cards` : `The ${wanted.length} cards that count`} ·{' '}
            <button type="button" onClick={() => setShowAll(!showAll)} className="cursor-pointer underline underline-offset-2 hover:text-neutral-200">
              {showAll ? 'only the ones that count' : `show all ${cards.length}`}
            </button>
          </p>
          <div className="flex flex-col gap-4">
            {groups.map(([r, group]) => (
              <section key={r}>
                <h3 className="mb-2 text-xs font-semibold text-neutral-300">
                  {showRarity(r as Rarity)} <span className="font-normal text-neutral-500">· {group.length}</span>
                </h3>
                <PoolGrid cards={group} />
              </section>
            ))}
          </div>
        </>
      ) : (
        <PoolGrid cards={cards} />
      )}
      <Link
        to={
          rarity === '☆☆'
            ? `/rankings?set=${expansionId}`
            : `/rankings?tab=wanted&set=${expansionId}${multiRarity(rarity) ? '' : `&rarity=${encodeURIComponent(rarity)}`}`
        }
        className="mt-3 inline-block text-xs text-neutral-400 underline-offset-2 hover:text-neutral-200 hover:underline"
      >
        See this set in the {rarity === '☆☆' ? '☆☆ vote' : 'Most wanted'} ranking →
      </Link>
    </div>
  )
}

function PoolGrid({ cards }: { cards: Card[] }) {
  const { data: collection } = useMainWithAlt()
  const { setSelectedCardId } = useSelectedCard()
  return (
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
              {card.rarity === '☆☆' ? (
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
  )
}
