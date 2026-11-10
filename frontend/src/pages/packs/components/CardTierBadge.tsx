// Personal fork: a card's tier chip for the top-left of its thumbnail, with the scale and score on hover.
import { TierChip } from '@/components/TierChip'
import type { Card } from '@/types'
import { cardTier, tierChipTitle } from '../types'

export function CardTierBadge({ card }: { card: Card }) {
  const tier = cardTier(card)
  return tier ? (
    <span title={tierChipTitle(card)}>
      <TierChip tier={tier} className="shadow" />
    </span>
  ) : null
}
