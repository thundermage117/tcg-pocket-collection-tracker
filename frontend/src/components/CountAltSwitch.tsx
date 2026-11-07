// Personal fork: "Count alt" switch for the planning pages (Overview, Packs), see useMainWithAlt.
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { setCountAlt, useCountAlt } from '@/services/profile/useProfile'
import { useMainWithAlt } from '@/services/profile/useProfileCollection'

export function CountAltSwitch({ id, className }: { id: string; className?: string }) {
  const on = useCountAlt()
  const { covered } = useMainWithAlt()

  if (covered === 0) {
    return null
  }
  return (
    <label
      htmlFor={id}
      title="Count cards your alt can gift or trade to main as owned, so missing cards and pack odds only chase what neither account has"
      className={cn('flex cursor-pointer items-center gap-2 text-sm text-neutral-300', className)}
    >
      <Switch id={id} checked={on} onCheckedChange={setCountAlt} />
      Count alt's cards
      <span className="text-amber-400 tabular-nums">+{covered}</span>
    </label>
  )
}
