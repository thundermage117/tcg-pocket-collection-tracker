// Personal fork: one tier of the rankings page — a dense, collapsible grid of card images.
import { ChevronDown } from 'lucide-react'
import { CardThumb } from '@/components/CardThumb'
import type { RankedCard, Tier } from '@/lib/rankings'
import { cn } from '@/lib/utils'
import type { Card } from '@/types'

// about three rows on desktop; the rest stays behind "Show all"
const PREVIEW = 30

interface Props {
  tier: Tier
  range: string
  entries: RankedCard[]
  score: (e: RankedCard) => string
  owned: (card: Card) => boolean
  showOwned: boolean
  open: boolean
  showAll: boolean
  onToggle: () => void
  onShowAll: () => void
  onSelect: (card: Card) => void
}

export function TierSection({ tier, range, entries, score, owned, showOwned, open, showAll, onToggle, onShowAll, onSelect }: Props) {
  const visible = showAll ? entries : entries.slice(0, PREVIEW)
  return (
    <section className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60">
      <button type="button" onClick={onToggle} className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left hover:bg-neutral-800/60">
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-md font-black text-neutral-900 ${tier.name.length > 2 ? 'text-sm' : 'text-lg'}`}
          style={{ backgroundColor: tier.color }}
        >
          {tier.name}
        </span>
        <span className="flex-1 text-sm">
          <span className="font-medium text-neutral-200">{range}</span>
          <span className="text-neutral-500"> · {entries.length} cards</span>
          {showOwned && (
            <span className="text-neutral-400">
              {' '}
              · you own {entries.filter((e) => owned(e.card)).length} / {entries.length}
            </span>
          )}
        </span>
        <ChevronDown className={cn('size-4 text-neutral-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-neutral-800 p-3">
          <div className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
            {visible.map((e) => (
              <div key={e.card.card_id} className="flex min-w-0 flex-col gap-0.5">
                <CardThumb card={e.card} owned={owned(e.card)} label={`#${e.position}`} onClick={() => onSelect(e.card)} />
                <span className="text-center text-[11px] text-neutral-400 tabular-nums">{score(e)}</span>
              </div>
            ))}
          </div>
          {!showAll && entries.length > PREVIEW && (
            <button
              type="button"
              onClick={onShowAll}
              className="mt-3 w-full cursor-pointer rounded-md py-1.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
            >
              Show all {entries.length}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
