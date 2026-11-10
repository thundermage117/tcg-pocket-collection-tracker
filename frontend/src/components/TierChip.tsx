// Personal fork: a ranking tier's name on its colour, e.g. "SSS" in magenta.
import type { Tier } from '@/lib/rankings'
import { cn } from '@/lib/utils'

export function TierChip({ tier, className }: { tier: Tier; className?: string }) {
  return (
    <span
      className={cn('inline-block rounded px-1 text-center font-black text-[10px] text-neutral-900 leading-4', className)}
      style={{ backgroundColor: tier.color }}
    >
      {tier.name}
    </span>
  )
}
