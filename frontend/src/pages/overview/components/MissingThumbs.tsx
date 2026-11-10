// Personal fork: small, dimmed images of cards still missing, under the overview heatmap's and pack map's hover text
import { getLocalizedImagePath } from '@/lib/imageLocales'
import type { Card } from '@/types'

// How many missing cards a preview shows
export const previewCount = 12

export function MissingThumbs({ cards, missing, className }: { cards: Card[]; missing: number; className?: string }) {
  return (
    <div className={`grid grid-cols-6 gap-1 ${className ?? ''}`}>
      {cards.map((c) => (
        <img
          key={c.internal_id}
          src={getLocalizedImagePath(c)}
          alt={c.name}
          loading="lazy"
          decoding="async"
          className="aspect-[367/512] w-full rounded-sm object-cover opacity-75 grayscale-[55%]"
        />
      ))}
      {missing > cards.length && (
        <span className="flex aspect-[367/512] items-center justify-center rounded-sm bg-neutral-700/60 text-[11px] text-neutral-300 tabular-nums">
          +{missing - cards.length}
        </span>
      )}
    </div>
  )
}
