// Personal fork: owned / ranked cards per Most wanted tier, so the overview says how good the collection is, not just how big.
// Each column opens its tier on Rankings.
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { tiers } from '@/lib/rankings'
import { type TierCount, type ValueOption, valueMaxTier } from '@/pages/overview/valueTiers'
import type { Rarity } from '@/types'
import './heatmap.css'

interface Props {
  counts: TierCount[]
  value: ValueOption // tiers the Value filter leaves out are dimmed
  rarity: Rarity[]
  className?: string
}

// Never round a gap up to 100% or a single card down to 0% (same as the heatmap)
const formatPct = (have: number, total: number) => `${have === total ? 100 : have > 0 ? Math.max(1, Math.min(99, Math.floor((100 * have) / total))) : 0}%`

// One tier as a column filled from the bottom by the share owned. A finished tier gets the heatmap's foil sweep, staggered
// across the row; its colour goes on the column itself, since a full fill layer would cover the foil beneath it.
function TierColumn({ color, share, delay }: { color: string; share: number; delay: number }) {
  const done = share === 1
  return (
    <span
      className={`relative block w-full flex-1 overflow-hidden rounded-md border border-neutral-700 bg-neutral-900/60 ${done ? 'heat-foil' : ''}`}
      style={{ backgroundColor: done ? color : undefined, ['--foil-delay' as string]: `${delay}s` }}
    >
      {!done && <span className="absolute inset-x-0 bottom-0 transition-[height] duration-500" style={{ height: `${share * 100}%`, backgroundColor: color }} />}
    </span>
  )
}

export function TierTile({ counts, value, rarity, className }: Props) {
  const params = new URLSearchParams({ tab: 'wanted', missing: '1' })
  if (rarity.length > 0) {
    params.set('rarity', rarity.join(','))
  }
  const shown = tiers.map((tier, i) => ({ tier, i, ...counts[i] })).filter((t) => t.available > 0)

  return (
    <div className={`flex flex-col rounded-lg border-1 border-neutral-700 border-solid bg-neutral-800 p-3 sm:p-5 ${className ?? ''}`}>
      <Link to={`/rankings?${params}`} className="mb-2 text-center font-bold text-base transition-colors hover:text-white sm:mb-3 sm:text-lg md:text-xl">
        Value tiers
        <ChevronRight className="ml-0.5 inline size-4 align-middle text-neutral-400" />
      </Link>
      {shown.length === 0 ? (
        <p className="my-auto text-center text-neutral-400 text-xs">No ranked cards with these filters</p>
      ) : (
        // eight equal columns over the tile's full height, like an equalizer; counts are in the hover text (a column is
        // ~27px wide on desktop, too narrow for "513/870")
        <ul className="flex min-h-24 flex-1 gap-1 sm:gap-1.5">
          {shown.map(({ tier, i, available, collected }) => (
            <li key={tier.name} className={`flex min-w-0 flex-1 ${i > valueMaxTier[value] ? 'opacity-35' : ''}`}>
              <Link
                to={`/rankings?${params}&tier=${tier.name}`}
                className="-mx-0.5 flex flex-1 flex-col items-center gap-1 rounded-md px-0.5 pt-0.5 transition-colors hover:bg-neutral-700/60"
                aria-label={`${tier.name}: ${collected} of ${available} owned`}
                title={`${tier.name}: ${collected} / ${available}`}
              >
                <TierColumn color={tier.color} share={collected / available} delay={i * 0.12} />
                <span className="font-black text-[8px] leading-none sm:text-[11px]" style={{ color: tier.color }}>
                  {tier.name}
                </span>
                {/* phones: no % sign, which ran the ~15px columns' numbers together */}
                <span className="whitespace-nowrap text-[8px] text-neutral-300 leading-none tabular-nums sm:text-[10px]">
                  {formatPct(collected, available).slice(0, -1)}
                  <span className="max-sm:hidden">%</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
