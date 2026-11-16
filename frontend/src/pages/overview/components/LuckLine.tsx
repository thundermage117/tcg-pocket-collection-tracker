// Personal fork: the luck report's headline as one line on the overview, linking to /luck, beside the way to the chase wall.
import { ChevronRight, Clover, Sparkles } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { getLuck, luckWords, roundPacks } from '@/lib/luck'
import { useProfileCollection } from '@/services/profile/useProfileCollection'

const link =
  'group flex min-w-0 items-center gap-2.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm transition-colors hover:border-neutral-500 sm:px-4'
const chevron = 'ml-auto size-4 shrink-0 text-neutral-500 transition-transform group-hover:translate-x-0.5'

export function LuckLine({ className }: { className?: string }) {
  // main's real cards, never the "Count alt's cards" view
  const { data: collection } = useProfileCollection('main')
  const luck = useMemo(() => (collection ? getLuck(collection) : undefined), [collection])

  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:gap-4 ${className ?? ''}`}>
      {luck && luck.expansions.length > 0 && (
        <Link to="/luck" className={`${link} flex-1`}>
          <Clover className="size-4 shrink-0 text-amber-300" />
          <span className="min-w-0 text-pretty text-neutral-400">
            Your ☆+ cards are worth about <span className="font-medium text-neutral-100">{roundPacks(luck.worth)} packs</span>
            {luck.judged.expansions > 0 && <> · {luckWords(luck.judged.percentile)}</>}
          </span>
          <ChevronRight className={chevron} />
        </Link>
      )}
      <Link to="/chase" className={link}>
        <Sparkles className="size-4 shrink-0 text-violet-300" />
        <span className="text-neutral-300">Chase wall</span>
        <ChevronRight className={chevron} />
      </Link>
    </div>
  )
}
