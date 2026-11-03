import type { Card } from '@/types'

// English only: the localized image folders were dropped to keep the deployed site small. `lang` is kept so call sites don't change.
export function getLocalizedImagePath(card: Pick<Card, 'card_id'>, _lang?: string): string {
  return `/images/en-US/${card.card_id}.webp`
}
