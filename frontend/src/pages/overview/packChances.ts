import { expansions } from '@/lib/CardsDB.ts'
import { pullRate } from '@/lib/stats'
import type { Card, ExpansionId, Pack } from '@/types'

export interface PackChance {
  pack: Pack
  pct: number // 0–100: chance that one pack gives a card you're missing
  collected: number
  available: number
}

const byExpansion = (cards: Card[]) => Object.groupBy(cards, (c) => c.expansion) as Partial<Record<ExpansionId, Card[]>>

// Unique cards in a pack's pool: its own cards plus the set's "everypack" cards, the same pool pullRate draws from
const uniqueInPool = (cards: Card[] | undefined, pack: Pack) =>
  new Set((cards ?? []).filter((c) => c.pack === pack.name || c.pack === 'everypack').map((c) => c.internal_id)).size

// Every openable set's packs, in set order, shared by the overview's pick and the heatmap so the two can't disagree
export function getPackChances(availableCards: Card[], collectedCards: Card[], wantedCards: Card[], deckbuildingMode: boolean) {
  const available = byExpansion(availableCards)
  const collected = byExpansion(collectedCards)
  const wanted = byExpansion(wantedCards)
  const chances = new Map<ExpansionId, PackChance[]>()
  for (const expansion of expansions.filter((e) => e.openable)) {
    chances.set(
      expansion.id,
      expansion.packs
        .filter((p) => p.name !== 'everypack')
        .map((pack) => ({
          pack,
          pct: 100 * pullRate(wanted[expansion.id] ?? [], expansion, pack, deckbuildingMode),
          available: uniqueInPool(available[expansion.id], pack),
          collected: uniqueInPool(collected[expansion.id], pack),
        })),
    )
  }
  return chances
}

// Highest chance; ties keep the first (oldest set, first pack)
export const bestChance = (chances: PackChance[]) => chances.reduce<PackChance | undefined>((a, b) => (!a || b.pct > a.pct ? b : a), undefined)
