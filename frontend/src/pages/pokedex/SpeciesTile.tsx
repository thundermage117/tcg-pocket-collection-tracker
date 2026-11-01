// Personal fork: species tile and progress bar shared by the Pokédex grid, its lines view and the species page.
import { Link } from 'react-router'
import { getLocalizedImagePath } from '@/lib/imageLocales'
import { coverCard, dexName, ownedCount, type Species, speciesName } from '@/lib/pokedex'
import { cn } from '@/lib/utils'
import type { Collection } from '@/types'

export const dexLabel = (dexNr: number) => `#${String(dexNr).padStart(4, '0')}`

export function ProgressBar({ value, max, className }: { value: number; max: number; className?: string }) {
  return (
    <span className={cn('block overflow-hidden rounded-full bg-neutral-700', className)}>
      <span className="block h-full rounded-full bg-blue-300" style={{ width: `${max === 0 ? 0 : (100 * value) / max}%` }} />
    </span>
  )
}

interface Props {
  species: Species
  collection: Collection | undefined
  lang: string
  current?: boolean // the species whose page this is
  className?: string
}

/** Owned art (or a greyed common printing), dex number, owned/total printings; green border once every printing is owned. */
export function SpeciesTile({ species, collection, lang, current, className }: Props) {
  const owned = ownedCount(collection, species.cards)
  const name = speciesName(species, lang)
  const complete = owned === species.cards.length
  return (
    <Link
      to={`/pokedex/${species.dexNr}`}
      title={name}
      className={cn(
        'block rounded-md border-1 border-solid bg-neutral-800 p-1.5 transition-colors hover:border-neutral-400',
        complete ? 'border-green-600' : 'border-neutral-700',
        current && 'ring-2 ring-blue-300',
        className,
      )}
    >
      <img
        src={getLocalizedImagePath(coverCard(species, collection), lang)}
        alt={name}
        loading="lazy"
        className={cn('aspect-[367/512] w-full rounded object-cover', owned === 0 && 'opacity-30 grayscale')}
      />
      <div className="mt-1.5 flex items-baseline justify-between gap-1 text-[11px] tabular-nums">
        <span className="text-neutral-500">{dexLabel(species.dexNr)}</span>
        <span className={cn(complete ? 'text-green-500' : owned > 0 ? 'text-neutral-300' : 'text-neutral-500')}>
          {owned}/{species.cards.length}
        </span>
      </div>
      <p className={cn('truncate text-sm', owned === 0 && 'text-neutral-500')}>{name}</p>
    </Link>
  )
}

/** Same footprint as a tile, for line members that have no card in TCG Pocket (Pichu before it got one, Galarian evolutions, …). */
export function AbsentTile({ dexNr, lang, className }: { dexNr: number; lang: string; className?: string }) {
  const name = dexName(dexNr, lang)
  return (
    <div title={`${name} has no card in TCG Pocket`} className={cn('rounded-md border-1 border-dashed border-neutral-700 p-1.5', className)}>
      <div className="flex aspect-[367/512] w-full items-center justify-center rounded bg-neutral-800/50 px-1 text-center text-[10px] text-neutral-500">
        Not in TCG Pocket
      </div>
      <p className="mt-1.5 text-[11px] text-neutral-600 tabular-nums">{dexLabel(dexNr)}</p>
      <p className="truncate text-sm text-neutral-500">{name}</p>
    </div>
  )
}
