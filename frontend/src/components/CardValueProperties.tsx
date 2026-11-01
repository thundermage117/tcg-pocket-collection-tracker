// Personal fork: value rows for the card detail page (same layout as CardDetail's CardProperty).
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cardTiers, type Tier, twoStarPosition } from '@/lib/rankings'
import { demandRatio, getCardValue, isProvisional, kindLabel, twoStarCount, valuesGeneratedAt } from '@/lib/ValueDB'

function Row({ name, children }: { name: string; children: ReactNode }) {
  return (
    <p className="flex">
      <strong className="block min-w-[175px]">{name}</strong>
      {children}
    </p>
  )
}

function TierLink({ tier, to, onNavigate, children }: { tier: Tier; to: string; onNavigate?: () => void; children: ReactNode }) {
  return (
    <Link to={to} onClick={onNavigate} className="inline-flex items-center gap-1.5 underline-offset-2 hover:underline">
      <span className="rounded px-1.5 text-sm font-bold text-neutral-900" style={{ backgroundColor: tier.color }}>
        {tier.name}
      </span>
      {children}
    </Link>
  )
}

/** `onNavigate` closes the card sheet when a rankings link is followed. */
export function CardValueProperties({ cardId, expansion, onNavigate }: { cardId: string; expansion: string; onNavigate?: () => void }) {
  const value = getCardValue(cardId)
  if (!value) {
    return null
  }
  const tier = cardTiers(cardId)
  return (
    <>
      {(tier.elo || tier.wanted) && (
        <Row name="Rankings tier">
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            {tier.elo && (
              <TierLink tier={tier.elo} to={`/rankings?set=${expansion}`} onNavigate={onNavigate}>
                ☆☆ Elo
              </TierLink>
            )}
            {tier.wanted && (
              <TierLink tier={tier.wanted} to={`/rankings?tab=wanted&set=${expansion}`} onNavigate={onNavigate}>
                Most wanted
              </TierLink>
            )}
          </span>
        </Row>
      )}
      {value.adj !== undefined && (
        <Row name="☆☆ value">
          #{twoStarPosition(cardId)} of {twoStarCount} · Elo {value.adj}
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
