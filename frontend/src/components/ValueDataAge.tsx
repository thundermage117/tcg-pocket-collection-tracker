// Personal fork: how old the bundled value snapshot is (refreshed by .github/workflows/value-refresh.yml).
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { valuesGeneratedAt } from '@/lib/ValueDB'

// the refresh runs twice a month, so anything older means it has stopped
const STALE_DAYS = 21

export function ValueDataAge({ className }: { className?: string }) {
  const days = Math.floor((Date.now() - new Date(valuesGeneratedAt).getTime()) / 86_400_000)
  const stale = days > STALE_DAYS
  const age = days <= 0 ? 'today' : days === 1 ? '1 day old' : `${days} days old`
  return (
    <span
      title={stale ? 'The value refresh may have stopped: check the "Refresh value data" workflow' : undefined}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
        stale ? 'bg-amber-400/15 text-amber-400' : 'bg-neutral-800 text-neutral-400',
        className,
      )}
    >
      <Clock className="size-3" />
      Value data {valuesGeneratedAt} · {age}
      {stale && ' · may be out of date'}
    </span>
  )
}
