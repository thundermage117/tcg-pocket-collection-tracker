// Personal fork: the luck report's headline (packs ahead or behind on pulled cards) as one line on the overview, linking to /luck.
import { ChevronRight, Clover } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { getLuck, packsAhead } from '@/lib/luck'
import { useProfileCollection } from '@/services/profile/useProfileCollection'

export function LuckLine({ className }: { className?: string }) {
  // main's real cards, never the "Count alt's cards" view
  const { data: collection } = useProfileCollection('main')
  const luck = useMemo(() => (collection ? getLuck(collection) : undefined), [collection])
  if (!luck?.pulls) {
    return null
  }

  return (
    <Link
      to="/luck"
      className={`group flex min-w-0 items-center gap-2.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm transition-colors hover:border-neutral-500 sm:px-4 ${className ?? ''}`}
    >
      <Clover className="size-4 shrink-0 text-amber-300" />
      <span className="min-w-0 text-pretty text-neutral-400">
        Your pulls: <span className="font-medium text-neutral-100">{packsAhead(luck.pulls.worth, luck.pulls.packs)}</span>
      </span>
      <ChevronRight className="ml-auto size-4 shrink-0 text-neutral-500 transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}
