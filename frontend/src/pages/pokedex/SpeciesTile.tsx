// Personal fork: species tile and progress bar shared by the Pokédex grid, its lines view and the species page.
import { Check, CircleDot, Crown, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useViewTransitionState } from 'react-router'
import { getLocalizedImagePath } from '@/lib/imageLocales'
import { coverCard, dexName, type FormNode, ownedCount, plainTypes, type Species, type SpeciesGroup, speciesName, spriteUrl, typesOf } from '@/lib/pokedex'
import { cn, getCardNameByLang } from '@/lib/utils'
import type { CardType, Collection } from '@/types'
import './pokedex.css'

export type TileArt = 'sprite' | 'card'

/** The view-transition name a species' artwork goes by, on its tile and as the species page's hero. */
export const dexArtName = (dexNr: number) => `dex-art-${dexNr}`

/**
 * Turns off the browser's scroll restore while the Pokédex or a species page is open; both restore their own. Left on, going
 * back would scroll the species page to the list's position before the view transition snapshots it, so the hero would morph
 * back into its tile from off-screen. The mode belongs to the history entry, so both pages set it, and leaving puts it back.
 */
export function useOwnScrollRestore() {
  useEffect(() => {
    const before = history.scrollRestoration
    history.scrollRestoration = 'manual'
    return () => {
      history.scrollRestoration = before
    }
  }, [])
}

export const dexLabel = (dexNr: number) => `#${String(dexNr).padStart(4, '0')}`

// close to the game's energy colours, so a tile's type reads at a glance
export const typeColors: Record<CardType, string> = {
  grass: '#5bb450',
  fire: '#ef5a3c',
  water: '#3d9be9',
  lightning: '#f2c230',
  psychic: '#b764c8',
  fighting: '#c8743a',
  darkness: '#2f6f7d',
  metal: '#9ba6ae',
  dragon: '#b8983a',
  colorless: '#c9c9c9',
  trainer: '#737373',
}

/** Type stripe: one colour, or a hard split for dual types (Water/Darkness). */
export const typeStripe = (types: CardType[]) =>
  types.length === 1
    ? typeColors[types[0]]
    : `linear-gradient(90deg, ${types.map((t, i) => `${typeColors[t]} ${(100 * i) / types.length}% ${(100 * (i + 1)) / types.length}%`).join(', ')})`

/** A soft glow of the type colour behind artwork, one per type for dual types; alpha is a hex byte ('40'). */
export const typeGlow = (types: CardType[], alpha: string) =>
  types.length === 1
    ? `radial-gradient(circle at 50% 40%, ${typeColors[types[0]]}${alpha}, transparent 70%)`
    : `radial-gradient(circle at 25% 30%, ${typeColors[types[0]]}${alpha}, transparent 60%), radial-gradient(circle at 75% 60%, ${typeColors[types[1]]}${alpha}, transparent 60%)`

// on tiles the glow is a hint until caught, so caught species stand out across a grid
const tileGlow = (types: CardType[], caught: boolean) => ({ backgroundImage: typeGlow(types, caught ? '55' : '14') })

export const groupLabels: Record<SpeciesGroup, string> = { legendary: 'Legendary', mythical: 'Mythical', starter: 'Starter' }

const groupIcons = { legendary: Crown, mythical: Sparkles, starter: CircleDot }
const groupColors: Record<SpeciesGroup, string> = { legendary: 'text-amber-300', mythical: 'text-violet-300', starter: 'text-sky-300' }

/** Crown for legendary, sparkles for mythical, a ball for starters. */
export function GroupIcon({ group, className }: { group: SpeciesGroup; className?: string }) {
  const Icon = groupIcons[group]
  return (
    <span title={groupLabels[group]} className={cn(groupColors[group], className)}>
      <Icon className="size-3.5" />
    </span>
  )
}

export function ProgressBar({ value, max, color, className }: { value: number; max: number; color?: string; className?: string }) {
  return (
    <span className={cn('block overflow-hidden rounded-full bg-neutral-700', className)}>
      <span className="block h-full rounded-full bg-blue-300" style={{ width: `${max === 0 ? 0 : (100 * value) / max}%`, backgroundColor: color }} />
    </span>
  )
}

/**
 * Official artwork; a faint silhouette until caught ("Who's that Pokémon?").
 * `large` loads the 475px artwork (the 256px reads blurry at the hero's size on a 2× screen), falling back to the 256px if it's missing.
 */
export function Sprite({
  artworkId,
  caught,
  shiny,
  large,
  alt,
  className,
  style,
}: {
  artworkId: number
  caught: boolean
  shiny?: boolean
  large?: boolean
  alt: string
  className?: string
  style?: React.CSSProperties
}) {
  const small = spriteUrl(artworkId, shiny)
  const src = large ? spriteUrl(artworkId, shiny, true) : small
  // until the large artwork arrives, the small one (cached from the tile just clicked) stands in behind it, so the hero
  // is never blank, nor the view transition into it
  const [loaded, setLoaded] = useState<string>()
  return (
    <img
      src={src}
      onLoad={large ? () => setLoaded(src) : undefined}
      onError={
        large
          ? (e) => {
              if (!e.currentTarget.src.endsWith(small)) {
                e.currentTarget.src = small
              }
            }
          : undefined
      }
      alt={alt}
      loading={large ? 'eager' : 'lazy'}
      draggable={false}
      className={cn('aspect-square w-full bg-contain bg-center bg-no-repeat object-contain', !caught && 'opacity-15 brightness-0 invert', className)}
      style={{ ...style, ...(large && loaded !== src ? { backgroundImage: `url(${small})` } : {}) }}
    />
  )
}

/**
 * The Pokédex's one surface: a panel lit from above (a hairline highlight along its top edge, a faint top-down sheen) and
 * lifted by a soft shadow, rather than outlined in grey. Completion (gold) and selection colour its border.
 */
export const surface =
  'border-1 border-solid border-white/[0.06] bg-neutral-800/70 bg-linear-to-b from-white/[0.035] to-transparent shadow-[inset_0_1px_0_0_rgb(255_255_255/0.06),0_12px_28px_-14px_rgb(0_0_0/0.8)]'

// the same light on tiles, a tighter shadow; lifts on hover and gives on press, so a tap answers before the page does.
// Not clipped, so the artwork can rise out of it on hover (above its neighbours)
const tileClass =
  'group relative block rounded-lg hover:z-10 border-1 border-solid border-white/[0.06] bg-neutral-800 p-1.5 pt-2.5 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.06),0_6px_16px_-8px_rgb(0_0_0/0.7)] transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-white/25 hover:shadow-[inset_0_1px_0_0_rgb(255_255_255/0.08),0_14px_24px_-10px_rgb(0_0_0/0.8)] active:translate-y-0 active:scale-95 motion-reduce:transform-none'

// the tile isn't clipped, so the stripe rounds its own corners (the tile's radius inside its 1px border)
const stripeClass = 'absolute inset-x-0 top-0 h-1 rounded-t-[7px]'
// on hover the artwork grows and rises out of the tile's top edge, casting a shadow on it
const spritePop =
  'relative transition-[transform,filter] duration-200 ease-out group-hover:-translate-y-3 group-hover:scale-[1.12] group-hover:drop-shadow-[0_10px_8px_rgb(0_0_0/0.45)] motion-reduce:transition-none motion-reduce:group-hover:transform-none'

/** Starts the species page's large artwork loading on hover or touch, so it's usually there when the page is. */
const preloaded = new Set<string>()
export const preload = (url: string) => {
  if (!preloaded.has(url)) {
    preloaded.add(url)
    new Image().src = url
  }
}

interface Props {
  species: Species
  collection: Collection | undefined
  lang: string
  art?: TileArt
  shiny?: boolean // shiny artwork, and a sparkle once caught
  current?: boolean // the species whose page this is
  fromDex?: boolean // on the Pokédex: the species page then steps through its filtered list
  className?: string
}

/** Artwork (or owned card art), dex number and owned/total printings; a check once every printing is owned. */
export function SpeciesTile({ species, collection, lang, art = 'sprite', shiny, current, fromDex, className }: Props) {
  const owned = ownedCount(collection, species.cards)
  const name = speciesName(species, lang)
  const complete = owned === species.cards.length
  // its own types, not its forms': Alolan Vulpix has a tile of its own (forms view, evolution lines) in Water
  const types = plainTypes(species)
  const to = `/pokedex/${species.dexNr}`
  // while navigating to or from this species, its artwork morphs into (or out of) the species page's hero; not the
  // current species' own tile, whose page already has the hero under that name
  const morphing = useViewTransitionState(to) && !current
  return (
    <Link
      to={`${to}${shiny ? '?shiny' : ''}`}
      viewTransition
      state={fromDex ? { fromDex } : undefined}
      title={name}
      onPointerEnter={() => preload(spriteUrl(species.dexNr, shiny, true))}
      onPointerDown={() => preload(spriteUrl(species.dexNr, shiny, true))}
      // the species whose page this is: a border in its type colour (a ring outside the tile was clipped by the line's scroller)
      className={cn(tileClass, current && 'border-2', className)}
      style={{ ...tileGlow(types, owned > 0), ...(current ? { borderColor: typeColors[types[0]] } : {}) }}
    >
      <span className={stripeClass} style={{ background: typeStripe(types) }} />
      {/* starters are a quarter of the early generations, so on tiles only legendary and mythical get a mark */}
      {species.group && species.group !== 'starter' && <GroupIcon group={species.group} className="absolute top-2 left-2 drop-shadow" />}
      {shiny && owned > 0 && <span className="absolute top-2 right-2 text-pink-300 drop-shadow">✵</span>}
      {art === 'sprite' ? (
        <Sprite
          artworkId={species.dexNr}
          caught={owned > 0}
          shiny={shiny}
          alt={name}
          className={spritePop}
          style={morphing ? { viewTransitionName: dexArtName(species.dexNr) } : undefined}
        />
      ) : (
        <img
          src={getLocalizedImagePath(coverCard(species.cards, collection), lang)}
          alt={name}
          loading="lazy"
          className={cn('aspect-[367/512] w-full rounded object-cover', owned === 0 && 'opacity-30 grayscale')}
        />
      )}
      <div className="mt-1.5 flex items-baseline justify-between gap-1 text-[11px] tabular-nums">
        <span className="text-neutral-500">{dexLabel(species.dexNr)}</span>
        <span className={cn('flex items-center gap-0.5', complete ? 'text-green-500' : owned > 0 ? 'text-neutral-300' : 'text-neutral-500')}>
          {complete && <Check className="size-3" strokeWidth={3} />}
          {owned}/{species.cards.length}
        </span>
      </div>
      <p className={cn('truncate text-xs sm:text-sm', owned === 0 && 'text-neutral-500')}>{name}</p>
    </Link>
  )
}

/** Same footprint as a tile, for line members with no card in TCG Pocket (Galarian evolutions, …). */
export function AbsentTile({ dexNr, lang, className }: { dexNr: number; lang: string; className?: string }) {
  const name = dexName(dexNr, lang)
  return (
    <div title={`${name} has no card in TCG Pocket`} className={cn('rounded-md border-1 border-dashed border-neutral-700 p-1.5 pt-2.5', className)}>
      <Sprite artworkId={dexNr} caught={false} alt={name} className="opacity-10" />
      <p className="mt-1.5 text-[11px] text-neutral-600 tabular-nums">{dexLabel(dexNr)}</p>
      <p className="truncate text-sm text-neutral-500">{name}</p>
      <p className="truncate text-[10px] text-neutral-600">Not in TCG Pocket</p>
    </div>
  )
}

interface FormTileProps {
  form: FormNode
  collection: Collection | undefined
  lang: string
  art?: TileArt
  showDex?: boolean // on the Pokédex's forms view, where tiles aren't next to their species
  fromDex?: boolean
  className?: string
}

/**
 * A form (in an evolution line's form chain, or on the Pokédex's forms view): its artwork, localized card name and owned/total
 * of that form's cards. The plain species' form (artwork of the species itself) goes by the species name.
 */
export function FormTile({ form, collection, lang, art = 'sprite', showDex, fromDex, className }: FormTileProps) {
  const owned = ownedCount(collection, form.cards)
  const plain = form.name.toLowerCase() === form.species.key
  // without " ex", like the form's own name: Mega Charizard X ex keeps its X when it wraps
  const name = plain ? speciesName(form.species, lang) : getCardNameByLang(form.cards[0], lang).replace(/ ex$/, '')
  const complete = owned === form.cards.length
  const types = typesOf(form.cards)
  return (
    <Link
      // opens the species page on this form when it has artwork of its own
      to={`/pokedex/${form.species.dexNr}${form.artworkId === form.species.dexNr ? '' : `?form=${form.artworkId}`}`}
      viewTransition
      state={fromDex ? { fromDex } : undefined}
      title={name}
      onPointerEnter={() => preload(spriteUrl(form.artworkId, false, true))}
      onPointerDown={() => preload(spriteUrl(form.artworkId, false, true))}
      className={cn(tileClass, className)}
      style={tileGlow(types, owned > 0)}
    >
      {/* the form's own types: Alolan Vulpix is Water, Vulpix Fire */}
      <span className={stripeClass} style={{ background: typeStripe(types) }} />
      {art === 'sprite' ? (
        <Sprite artworkId={form.artworkId} caught={owned > 0} alt={name} className={spritePop} />
      ) : (
        <img
          src={getLocalizedImagePath(coverCard(form.cards, collection), lang)}
          alt={name}
          loading="lazy"
          className={cn('aspect-[367/512] w-full rounded object-cover', owned === 0 && 'opacity-30 grayscale')}
        />
      )}
      <div className={cn('mt-1.5 flex items-baseline gap-1 text-[11px] tabular-nums', showDex ? 'justify-between' : 'justify-end')}>
        {showDex && <span className="text-neutral-500">{dexLabel(form.species.dexNr)}</span>}
        <span className={cn('flex items-center gap-0.5', complete ? 'text-green-500' : owned > 0 ? 'text-neutral-300' : 'text-neutral-500')}>
          {complete && <Check className="size-3" strokeWidth={3} />}
          {owned}/{form.cards.length}
        </span>
      </div>
      {/* form names run long (Team Rocket's Raticate, Mega Charizard X): wrapped rather than cut off */}
      <p className={cn('line-clamp-3 text-xs leading-tight sm:text-sm', owned === 0 && 'text-neutral-500')}>{name}</p>
    </Link>
  )
}
