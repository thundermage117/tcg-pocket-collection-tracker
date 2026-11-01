// Personal fork: sticky row of tier chips on the rankings page; each one opens its tier and scrolls to it.
import type { Tier } from '@/lib/rankings'

export interface TierNavItem {
  tier: Tier
  total: number
  owned?: number // left out when ownership isn't shown
}

export function TierNav({ items, onJump }: { items: TierNavItem[]; onJump: (tier: Tier) => void }) {
  return (
    <nav aria-label="Jump to tier" className="sticky top-0 z-20 -mx-4 mb-3 flex gap-1.5 overflow-x-auto bg-[#181818]/90 px-4 py-2 backdrop-blur">
      {items.map(({ tier, total, owned }) => (
        <button
          key={tier.name}
          type="button"
          onClick={() => onJump(tier)}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-900 py-0.5 pr-2.5 pl-0.5 text-xs text-neutral-300 hover:border-neutral-500"
        >
          <span className="rounded-full px-1.5 font-bold text-neutral-900" style={{ backgroundColor: tier.color }}>
            {tier.name}
          </span>
          <span className="tabular-nums">{owned === undefined ? total : `${owned}/${total}`}</span>
        </button>
      ))}
    </nav>
  )
}
