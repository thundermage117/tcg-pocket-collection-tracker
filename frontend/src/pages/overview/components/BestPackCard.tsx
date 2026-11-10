// Personal fork: upstream's GradientCard pick with the pack's cover card beside the text, tilted and fading into the
// pack colour, so the pick reads as a booster at a glance. A wrapper of our own so GradientCard.tsx stays upstream's.
import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { allCards, expansions } from '@/lib/CardsDB.ts'
import { getLocalizedImagePath } from '@/lib/imageLocales'
import { cn } from '@/lib/utils'
import type { Card, Pack, Rarity } from '@/types'

// Showiest art first: full-art Crown, immersive ☆☆☆, then ☆☆; shinies only when a set has nothing else
const coverRarities: Rarity[] = ['Crown Rare', '☆☆☆', '☆☆', '✵✵', '✵', '☆']

const pickCover = (cards: Card[]) => coverRarities.flatMap((r) => cards.filter((c) => c.rarity === r))[0]

// Pack names are "<pokemon>pack" (mewtwopack, megagardevoirpack), so the cover is that Pokémon's showiest card in the
// pack's set. Packs named after their set (ruleroftheskiespack) fall back to the showiest Pokémon the pack can give.
function packCover(pack: Pack): Card | undefined {
  // pack names repeat across sets (pikachupack), so find the set by the pack object itself
  const expansion = expansions.find((e) => e.packs.includes(pack))
  if (!expansion) {
    return undefined
  }
  const inPack = allCards.filter((c) => c.expansion === expansion.id && (c.pack === pack.name || c.pack === 'everypack'))
  const pokemon = pack.name.replace(/pack$/, '')
  const named = inPack.filter((c) =>
    c.name
      .toLowerCase()
      .replace(/[^a-z]/g, '')
      .startsWith(pokemon),
  )
  // a gold item card (Poké Ball, Rare Candy) makes a poor cover, so Pokémon first
  return pickCover(named) ?? pickCover(inPack.filter((c) => c.card_type === 'pokémon')) ?? pickCover(inPack)
}

const covers = new Map<Pack, Card | undefined>()
const cachedCover = (pack: Pack) => {
  if (!covers.has(pack)) {
    covers.set(pack, packCover(pack))
  }
  return covers.get(pack)
}

interface Props {
  pack: Pack
  pct: number // 0–100
  className?: string
  children?: ReactNode // extra line under the odds
}

export function BestPackCard({ pack, pct, className, children }: Props) {
  const { t } = useTranslation(['gradient-card', 'common/packs'])
  const chancePercentage = Math.round(pct * 10) / 10
  const cover = cachedCover(pack)

  return (
    <div
      className={cn(className, 'relative isolate flex items-center overflow-hidden rounded-lg p-4 sm:p-8')}
      style={{ backgroundColor: pack.color, backgroundImage: 'radial-gradient(circle at 85% 50%, rgb(255 255 255 / 0.35), transparent 55%)' }}
    >
      {cover && (
        <img
          src={getLocalizedImagePath(cover)}
          alt=""
          decoding="async"
          // tilted and partly off the edge on phones; the mask fades its left side into the pack colour
          className="-z-10 -right-6 sm:right-4 md:right-6 absolute top-1/2 h-[125%] -translate-y-1/2 rotate-[8deg] rounded-lg shadow-2xl sm:h-[85%]"
          style={{ maskImage: 'linear-gradient(to right, transparent, black 35%)' }}
        />
      )}
      <div className={cn('flex flex-col items-start text-left', cover && 'pr-24 sm:pr-48 md:pr-52 lg:pr-56')}>
        <p className="mb-1 text-md text-slate-900 sm:text-xl">
          <Trans i18nKey="open" ns="gradient-card" />
        </p>
        <header className="text-balance font-semibold text-2xl text-slate-900 sm:text-5xl lg:text-6xl">{t(pack.name, { ns: 'common/packs' })}</header>
        <p className="mt-2 text-md text-slate-900 sm:text-xl">
          <Trans i18nKey="text" ns="gradient-card" values={{ chancePercentage }} components={{ strong: <span className="font-bold" /> }} />
        </p>
        {children}
      </div>
    </div>
  )
}
