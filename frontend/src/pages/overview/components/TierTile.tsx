// Personal fork: owned / ranked cards per Most wanted tier, so the overview says how good the collection is, not just how big.
// Each row opens its tier on Rankings.
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { tiers } from '@/lib/rankings'
import { type TierCount, type ValueOption, valueMaxTier } from '@/pages/overview/valueTiers'
import type { Rarity } from '@/types'

interface Props {
  counts: TierCount[]
  value: ValueOption // tiers the Value filter leaves out are dimmed
  rarity: Rarity[]
  className?: string
}

export function TierTile({ counts, value, rarity, className }: Props) {
  const params = new URLSearchParams({ tab: 'wanted', missing: '1' })
  if (rarity.length > 0) {
    params.set('rarity', rarity.join(','))
  }
  const shown = tiers.map((tier, i) => ({ tier, i, ...counts[i] })).filter((t) => t.available > 0)

  return (
    <div className={`flex flex-col justify-center rounded-lg border-1 border-neutral-700 border-solid bg-neutral-800 p-3 sm:p-5 ${className ?? ''}`}>
      <Link to={`/rankings?${params}`} className="mb-2 text-center font-bold text-base transition-colors hover:text-white sm:mb-3 sm:text-lg md:text-xl">
        Wanted tiers
        <ChevronRight className="ml-0.5 inline size-4 align-middle text-neutral-400" />
      </Link>
      {shown.length === 0 ? (
        <p className="text-center text-neutral-400 text-xs">No ranked cards with these filters</p>
      ) : (
        <ul className="flex flex-col">
          {shown.map(({ tier, i, available, collected }) => (
            <li key={tier.name} className={i > valueMaxTier[value] ? 'opacity-35' : ''}>
              <Link
                to={`/rankings?${params}&tier=${tier.name}`}
                className="-mx-1 flex items-center gap-1.5 rounded px-1 py-0.5 text-[11px] transition-colors hover:bg-neutral-700/60 sm:gap-2 sm:py-[3px] sm:text-xs"
                aria-label={`${tier.name}: ${collected} of ${available} owned`}
              >
                <span className="w-8 shrink-0 rounded py-0.5 text-center font-black text-[10px] text-neutral-900" style={{ backgroundColor: tier.color }}>
                  {tier.name}
                </span>
                <span className="h-1.5 min-w-4 grow overflow-hidden rounded-full bg-neutral-700">
                  <span className="block h-full rounded-full" style={{ width: `${(100 * collected) / available}%`, backgroundColor: tier.color }} />
                </span>
                {/* fixed width so every bar is the same length */}
                <span className="w-13 shrink-0 text-right text-neutral-300 tabular-nums sm:w-16">
                  {collected}
                  <span className="text-neutral-500">/{available}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
