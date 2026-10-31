// Personal fork: small card / set images shared by the packs and rankings pages.
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { getLocalizedImagePath } from '@/lib/imageLocales'
import { cn, getCardNameByLang } from '@/lib/utils'
import type { Card, ExpansionId } from '@/types'

interface CardThumbProps {
  card: Card
  owned?: boolean
  label?: ReactNode
  badge?: ReactNode // top-left corner
  className?: string
  onClick: () => void
}

/** Clickable card image; owned cards are dimmed with a check, `label` sits in the bottom-left corner. */
export function CardThumb({ card, owned, label, badge, className, onClick }: CardThumbProps) {
  const { i18n } = useTranslation()
  const name = getCardNameByLang(card, i18n.language)
  return (
    <button
      type="button"
      onClick={onClick}
      title={name}
      className={cn(
        'relative block w-full cursor-pointer overflow-hidden rounded-md transition-transform hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-2 ring-neutral-300',
        className,
      )}
    >
      <img
        src={getLocalizedImagePath(card, i18n.language)}
        alt={name}
        loading="lazy"
        className={cn('aspect-[367/512] w-full object-cover', owned && 'opacity-40 grayscale-[40%]')}
      />
      {owned && (
        <span className="absolute top-1 right-1 rounded-full bg-green-600 p-0.5 text-white shadow">
          <Check className="size-3" strokeWidth={3} />
        </span>
      )}
      {badge && <span className="absolute top-1 left-1">{badge}</span>}
      {label && <span className="absolute bottom-1 left-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">{label}</span>}
    </button>
  )
}

/** Set logo in the current language, falling back to en-US (same as CardsTable). */
export function SetLogo({ expansionId, className }: { expansionId: ExpansionId; className?: string }) {
  const { i18n } = useTranslation()
  return (
    <img
      src={`/images/sets/${i18n.language}/${expansionId}.webp`}
      alt={expansionId}
      className={cn('h-8 w-auto object-contain', className)}
      onError={(e) => {
        const img = e.currentTarget
        const fallback = `/images/sets/en-US/${expansionId}.webp`
        if (!img.src.endsWith(fallback)) {
          img.src = fallback
        }
      }}
    />
  )
}
