// Personal fork: value rows for the card detail page (same layout as CardDetail's CardProperty).
import type { ReactNode } from 'react'
import { demandRatio, getCardValue, isProvisional, kindLabel, twoStarCount, valuesGeneratedAt } from '@/lib/ValueDB'

function Row({ name, children }: { name: string; children: ReactNode }) {
  return (
    <p className="flex">
      <strong className="block min-w-[175px]">{name}</strong>
      {children}
    </p>
  )
}

export function CardValueProperties({ cardId }: { cardId: string }) {
  const value = getCardValue(cardId)
  if (!value) {
    return null
  }
  return (
    <>
      {value.adj !== undefined && (
        <Row name="☆☆ value">
          #{value.rank} of {twoStarCount} · Elo {value.adj}
          {value.kind && ` · ${kindLabel[value.kind]}`}
          {isProvisional(value) && <span className="ml-2 text-amber-400">provisional ({value.votes} votes)</span>}
        </Row>
      )}
      {value.wish !== undefined && (
        <Row name="Wishlists / offers">
          {value.wish.toLocaleString()} / {value.offers?.toLocaleString()} (×{demandRatio(value).toFixed(1)})
        </Row>
      )}
      {value.demand !== undefined && (
        <Row name="Trade board">
          {value.demand} want · {value.supply} offer
        </Row>
      )}
      <Row name="Value data">{valuesGeneratedAt}</Row>
    </>
  )
}
