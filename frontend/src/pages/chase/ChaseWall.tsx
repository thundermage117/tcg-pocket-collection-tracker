// Personal fork: the chase wall, for the glance before opening a pack. One card per openable booster: the best thing
// main doesn't have in it (pages/chase/chaseCards.ts), large, with the odds of one pack holding it. On phones each
// booster is a full screen that snaps into place; on desktop they hang side by side.
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useMediaQuery } from 'react-responsive'
import { SetLogo } from '@/components/CardThumb'
import { SkeletonGrid } from '@/components/Skeleton'
import { TierChip } from '@/components/TierChip'
import { useRemainingViewportHeight } from '@/hooks/useRemainingViewportHeight'
import { getLocalizedImagePath } from '@/lib/imageLocales'
import { getCardNameByLang } from '@/lib/utils'
import { type Chase, getChaseCards } from '@/pages/chase/chaseCards'
import { cardTier, packOdds } from '@/pages/packs/types'
import { useSelectedCard } from '@/services/collection/useCollection'
import { useMainWithAlt } from '@/services/profile/useProfileCollection'

const BOTTOM_NAV = 64 // the phone tab bar's height (h-16), which covers the end of the viewport below lg

function Slide({ chase, eager }: { chase: Chase; eager: boolean }) {
  const { t, i18n } = useTranslation(['common/sets', 'common/packs'])
  const { setSelectedCardId } = useSelectedCard()
  const { card, pack, expansion } = chase
  const name = getCardNameByLang(card, i18n.language)
  const image = getLocalizedImagePath(card, i18n.language)
  const tier = cardTier(card)

  return (
    <li className="relative flex h-full snap-start flex-col items-center gap-3 overflow-hidden px-6 py-4 lg:h-auto lg:rounded-2xl lg:border lg:border-neutral-800 lg:p-5">
      {/* the card's own colours as the backdrop */}
      <img
        src={image}
        alt=""
        aria-hidden
        loading={eager ? 'eager' : 'lazy'}
        className="absolute inset-0 size-full scale-150 object-cover opacity-45 blur-3xl"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/30 via-transparent to-neutral-950/80" />

      <header className="relative flex w-full items-center gap-3">
        <SetLogo expansionId={expansion.id} className="h-9 max-w-[96px]" />
        <p className="min-w-0 truncate font-medium text-neutral-100">
          {t(pack.name, { ns: 'common/packs' })}
          {expansion.packs.filter((p) => p.name !== 'everypack').length > 1 && (
            <span className="block truncate font-normal text-neutral-300 text-xs">{t(expansion.name, { ns: 'common/sets' })}</span>
          )}
        </p>
      </header>

      <button
        type="button"
        onClick={() => setSelectedCardId(card.internal_id)}
        title={name}
        className="relative flex min-h-0 w-full flex-1 cursor-pointer items-center justify-center transition-transform duration-300 hover:scale-[1.03] focus-visible:outline-none"
      >
        <img
          src={image}
          alt={name}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          className="max-h-full max-w-full rounded-[4.5%/3.2%] object-contain shadow-[0_18px_50px_rgb(0_0_0/0.65)] lg:w-full"
        />
      </button>

      <footer className="relative w-full text-center">
        <p className="font-semibold text-3xl text-neutral-50 tabular-nums tracking-tight">{packOdds(chase.perPack)}</p>
        <p className="mt-1 flex items-center justify-center gap-2 text-neutral-200 text-sm">
          <span className="truncate">
            {name} <span className="text-neutral-300">{card.rarity === 'Crown Rare' ? '♛' : card.rarity}</span>
          </span>
          {tier && <TierChip tier={tier} />}
        </p>
        <p className="mt-0.5 text-neutral-400 text-xs">
          {chase.others > 0 ? `and ${chase.others} more ☆+ you're missing here` : "the last ☆+ you're missing here"}
        </p>
      </footer>
    </li>
  )
}

function ChaseWall() {
  const { data: collection, isLoading } = useMainWithAlt()
  const isDesktop = useMediaQuery({ query: '(min-width: 1024px)' }) // tailwind "lg", where the phone tab bar goes away
  const { ref, height } = useRemainingViewportHeight()
  const chases = useMemo(() => getChaseCards(collection), [collection])

  return (
    <main className="mx-auto max-w-7xl lg:px-4 lg:pb-12">
      <header className="mb-6 max-lg:sr-only">
        <h1 className="text-2xl font-semibold sm:text-3xl">Chase wall</h1>
        <p className="mt-1 text-neutral-400 text-sm">The best card you don't have in every pack you can open, and the odds of one pack holding it.</p>
      </header>
      <div ref={ref} style={isDesktop ? undefined : { height: Math.max(320, height - BOTTOM_NAV) }}>
        {isLoading ? (
          <SkeletonGrid count={4} className="h-full grid-cols-1 gap-6 max-lg:p-6 lg:grid-cols-4" itemClassName="h-full rounded-2xl lg:aspect-[3/5]" />
        ) : chases.length === 0 ? (
          <p className="px-4 py-16 text-center text-neutral-400">Nothing left to chase: you own every ☆ and rarer card you can pull.</p>
        ) : (
          <ul className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain lg:grid lg:h-auto lg:snap-none lg:grid-cols-3 lg:gap-6 lg:overflow-visible xl:grid-cols-4">
            {chases.map((chase, i) => (
              <Slide key={`${chase.expansion.id}-${chase.pack.name}`} chase={chase} eager={i < 2} />
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}

export default ChaseWall
