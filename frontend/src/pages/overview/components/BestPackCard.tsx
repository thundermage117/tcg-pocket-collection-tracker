// Personal fork: upstream's GradientCard pick with the pack's Pokémon beside the text, in the Pokédex's official
// artwork, so the pick reads as a booster at a glance. A wrapper of our own so GradientCard.tsx stays upstream's.
import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { allCards, expansions } from '@/lib/CardsDB.ts'
import { allSpecies, formArtworkId, speciesKey, spriteUrl } from '@/lib/pokedex'
import { cn } from '@/lib/utils'
import type { Card, Pack, Rarity } from '@/types'

// Which card names the pack's Pokémon: its showiest printing first (Crown, ☆☆☆, ☆☆), the set's headline Pokémon
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

// The cover card's Pokémon as the Pokédex draws it: its form's artwork when it has one (Mega Mewtwo X), else the species'
function packArtwork(pack: Pack): string | undefined {
  const card = packCover(pack)
  const key = card && speciesKey(card)
  const species = key ? allSpecies.find((s) => s.key === key) : undefined
  // large: the 256px default would blur at the card's size on high-density screens
  return card && species ? spriteUrl(formArtworkId(species, card.name), false, true) : undefined
}

const artworks = new Map<Pack, string | undefined>()
const cachedArtwork = (pack: Pack) => {
  if (!artworks.has(pack)) {
    artworks.set(pack, packArtwork(pack))
  }
  return artworks.get(pack)
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
  const artwork = cachedArtwork(pack)

  return (
    <div
      className={cn(className, 'relative isolate flex items-center overflow-hidden rounded-lg p-4 sm:p-8')}
      style={{ backgroundColor: pack.color, backgroundImage: 'radial-gradient(circle at 85% 50%, rgb(255 255 255 / 0.35), transparent 55%)' }}
    >
      {artwork && (
        <img
          src={artwork}
          alt=""
          decoding="async"
          // on the glow, partly off the edge on phones
          className="-z-10 -right-4 sm:right-2 absolute top-1/2 h-[120%] -translate-y-1/2 drop-shadow-[0_8px_16px_rgb(0_0_0/0.3)] sm:h-[95%]"
        />
      )}
      <div className={cn('flex flex-col items-start text-left', artwork && 'pr-28 sm:pr-60 lg:pr-72')}>
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
