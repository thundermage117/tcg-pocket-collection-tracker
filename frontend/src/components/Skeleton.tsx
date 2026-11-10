// Personal fork: placeholders shaped like what's loading, so a page holds its layout instead of a spinner over a blank screen.
import { cn } from '@/lib/utils'

// stable keys for the placeholder lists, which have no data to key on
const keys = Array.from({ length: 48 }, (_, i) => `skeleton-${i}`)

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-xl bg-neutral-800/70 motion-reduce:animate-none', className)} />
}

/** `count` placeholders inside `className`'s grid, each with `itemClassName`. */
export function SkeletonGrid({ count, className, itemClassName }: { count: number; className?: string; itemClassName?: string }) {
  return (
    <div role="status" aria-label="Loading" className={cn('grid', className)}>
      {keys.slice(0, count).map((key) => (
        <Skeleton key={key} className={itemClassName} />
      ))}
    </div>
  )
}

/** Card-shaped placeholders, in the TCG card's proportions. */
export function CardGridSkeleton({ count = 15, className }: { count?: number; className?: string }) {
  return <SkeletonGrid count={count} className={cn('grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5', className)} itemClassName="aspect-[367/512] rounded-lg" />
}
