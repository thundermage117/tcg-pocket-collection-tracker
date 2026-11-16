// Personal fork: helpers for the rankings page's demand map — every card on a log–log scatter of offers (supply) against
// wishlists (demand).
import { useTranslation } from 'react-i18next'
import { expansions, getExpansionById } from '@/lib/CardsDB'
import { getLocalizedImagePath } from '@/lib/imageLocales'
import type { DemandPoint } from '@/lib/rankings'
import { getCardNameByLang } from '@/lib/utils'
import type { Card } from '@/types'

// The highlighted group (owned cards, or the newest set) is the one categorical hue; the rest is context grey, also drawn
// smaller and underneath. Plain values, since the canvas can't read CSS variables and the app is dark-only.
export const DEMAND_COLORS = { high: '#3987e5', rest: '#737373', surface: '#1a1a1a' }

// Offers against wishlists is a thin diagonal band, so the map is turned to lie it flat: x is how much a card is traded
// (wishlists + offers), y is wishlists per offer. The average and its 2× and ½× lines are then horizontal, and a card's
// height is how wanted it is. Both axes are log; the ratio is (wish + 1) / (offers + 1), so a card nobody offers or
// wants still has a finite height.
export const activity = (p: DemandPoint) => p.wish + p.offers
export const ratioOf = (p: DemandPoint) => (p.wish + 1) / (p.offers + 1)
export const formatCount = (n: number) => (n >= 1000 ? `${n / 1000}k` : `${n}`)

// The axes hug the data, padded by a twentieth of its log span on each side, rather than rounding out to whole decades
export const logDomain = (values: number[]): [number, number] => {
  const lo = Math.log10(Math.min(...values))
  const hi = Math.log10(Math.max(...values))
  const pad = Math.max(hi - lo, 0.5) / 20
  return [10 ** (lo - pad), 10 ** (hi + pad)]
}

// The newest set's cards have few spares listed yet, so they sit apart on the left; marking it explains that cluster
export const newestSet = (points: DemandPoint[]) => {
  const present = new Set(points.map((p) => p.card.expansion))
  return expansions.findLast((e) => present.has(e.id))?.id
}

// How far a tap may land from a dot and still pick it, in px: dense clusters are far smaller than a fingertip
export const TAP_RADIUS = 32

export type Highlight = 'owned' | 'newest' | 'none'

export function CardDetails({ point, owned }: { point: DemandPoint; owned?: (card: Card) => boolean }) {
  const { t, i18n } = useTranslation('common/sets')
  const { card } = point
  return (
    <div className="flex min-w-0 flex-1 gap-3">
      <img src={getLocalizedImagePath(card, i18n.language)} alt="" className="aspect-[367/512] w-14 shrink-0 rounded object-cover" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div>
          <div className="truncate font-medium text-neutral-100">{getCardNameByLang(card, i18n.language)}</div>
          <div className="truncate text-neutral-400">
            {t(getExpansionById(card.expansion).name)} · {card.card_id} · {card.rarity}
          </div>
        </div>
        <dl className="grid grid-cols-[1fr_auto] gap-x-2 text-neutral-400">
          <dt>Wishlists</dt>
          <dd className="text-right font-medium text-neutral-100 tabular-nums">{point.wish.toLocaleString()}</dd>
          <dt>Offers</dt>
          <dd className="text-right font-medium text-neutral-100 tabular-nums">{point.offers.toLocaleString()}</dd>
          <dt>Adj. demand</dt>
          <dd className="text-right font-medium text-neutral-100 tabular-nums">×{point.score.toFixed(2)}</dd>
        </dl>
        {owned && <div className="text-neutral-500">{owned(card) ? 'In your collection' : 'Not in your collection'}</div>}
      </div>
    </div>
  )
}
