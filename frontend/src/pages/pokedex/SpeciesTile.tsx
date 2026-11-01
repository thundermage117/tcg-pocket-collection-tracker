// Personal fork: species tile and progress bar shared by the Pokédex grid, its lines view and the species page.
import { Check, Crown, Sparkles } from 'lucide-react'
import { Link } from 'react-router'
import { getLocalizedImagePath } from '@/lib/imageLocales'
import { coverCard, dexName, type FormNode, ownedCount, type Species, type SpeciesGroup, speciesName, spriteUrl } from '@/lib/pokedex'
import { cn, getCardNameByLang } from '@/lib/utils'
import type { CardType, Collection } from '@/types'

export type TileArt = 'sprite' | 'card'

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

export const groupLabels: Record<SpeciesGroup, string> = { legendary: 'Legendary', mythical: 'Mythical' }

/** Crown for legendary, sparkles for mythical. */
export function GroupIcon({ group, className }: { group: SpeciesGroup; className?: string }) {
  const Icon = group === 'legendary' ? Crown : Sparkles
  return (
    <span title={groupLabels[group]} className={cn(group === 'legendary' ? 'text-amber-300' : 'text-violet-300', className)}>
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

/** Official artwork; a faint silhouette until caught ("Who's that Pokémon?"). */
export function Sprite({ artworkId, caught, shiny, alt, className }: { artworkId: number; caught: boolean; shiny?: boolean; alt: string; className?: string }) {
  return (
    <img
      src={spriteUrl(artworkId, shiny)}
      alt={alt}
      loading="lazy"
      draggable={false}
      className={cn('aspect-square w-full object-contain', !caught && 'opacity-15 brightness-0 invert', className)}
    />
  )
}

interface Props {
  species: Species
  collection: Collection | undefined
  lang: string
  art?: TileArt
  shiny?: boolean // shiny artwork, and a sparkle once caught
  current?: boolean // the species whose page this is
  className?: string
}

/** Artwork (or owned card art), dex number and owned/total printings; a check once every printing is owned. */
export function SpeciesTile({ species, collection, lang, art = 'sprite', shiny, current, className }: Props) {
  const owned = ownedCount(collection, species.cards)
  const name = speciesName(species, lang)
  const complete = owned === species.cards.length
  return (
    <Link
      to={`/pokedex/${species.dexNr}${shiny ? '?shiny' : ''}`}
      title={name}
      className={cn(
        'relative block overflow-hidden rounded-md border-1 border-neutral-700 border-solid bg-neutral-800 p-1.5 pt-2.5 transition-colors hover:border-neutral-400',
        current && 'ring-2 ring-blue-300',
        className,
      )}
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: typeStripe(species.types) }} />
      {species.group && <GroupIcon group={species.group} className="absolute top-2 left-2 drop-shadow" />}
      {shiny && owned > 0 && <span className="absolute top-2 right-2 text-pink-300 drop-shadow">✵</span>}
      {art === 'sprite' ? (
        <Sprite artworkId={species.dexNr} caught={owned > 0} shiny={shiny} alt={name} />
      ) : (
        <img
          src={getLocalizedImagePath(coverCard(species, collection), lang)}
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
      <p className={cn('truncate text-sm', owned === 0 && 'text-neutral-500')}>{name}</p>
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

/** A form in an evolution line's form chain: its artwork, localized card name and owned/total of that form's cards. */
export function FormTile({ form, collection, lang, className }: { form: FormNode; collection: Collection | undefined; lang: string; className?: string }) {
  const owned = ownedCount(collection, form.cards)
  // without " ex", like the form's own name: Mega Charizard X ex keeps its X when it wraps
  const name = getCardNameByLang(form.cards[0], lang).replace(/ ex$/, '')
  const complete = owned === form.cards.length
  return (
    <Link
      to={`/pokedex/${form.species.dexNr}`}
      title={name}
      className={cn(
        'relative block overflow-hidden rounded-md border-1 border-neutral-700 border-solid bg-neutral-800 p-1.5 pt-2.5 transition-colors hover:border-neutral-400',
        className,
      )}
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: typeStripe(form.species.types) }} />
      <Sprite artworkId={form.artworkId} caught={owned > 0} alt={name} />
      <div className="mt-1.5 flex items-baseline justify-end gap-1 text-[11px] tabular-nums">
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
