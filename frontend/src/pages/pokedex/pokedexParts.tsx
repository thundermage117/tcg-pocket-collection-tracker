// Personal fork: the Pokédex page's small pieces: generation banners, filter chips, the tile-art toggle and shared styles.
import { PawPrint, RectangleVertical, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { type Generation, spriteUrl } from '@/lib/pokedex'
import { cn } from '@/lib/utils'
import { artLabels, artOptions } from './dexFilters'
import { ProgressBar, surface, type TileArt } from './SpeciesTile'

export const genLabel = (g: Generation) => `Gen ${g.nr} · ${g.region}`

/** A generation's section header: its region, mascot and progress, gold once every one is caught. */
export function GenBanner({ g, owned, total, unit }: { g: Generation; owned: number; total: number; unit: string }) {
  const complete = owned === total
  return (
    <h2
      data-gen={g.nr}
      className={cn(
        'relative isolate mb-3 flex items-center gap-3 overflow-hidden rounded-xl py-2 pr-20 pl-3 sm:gap-5 sm:pr-28',
        surface,
        complete && 'border-amber-300/60',
      )}
    >
      <img
        src={spriteUrl(regionMascots[g.nr - 1])}
        alt=""
        loading="lazy"
        draggable={false}
        className="pointer-events-none absolute -right-2 -bottom-7 -z-10 size-24 opacity-30 sm:right-2 sm:size-28"
      />
      <span className="flex shrink-0 flex-col leading-tight">
        <span className="font-normal text-[11px] text-neutral-400 uppercase tracking-wider">Gen {g.nr}</span>
        <span className="dex-display font-semibold text-[1.05rem]">{g.region}</span>
      </span>
      <ProgressBar value={owned} max={total} color={complete ? '#fcd34d' : undefined} className="h-1.5 grow" />
      <span className="shrink-0 font-normal text-sm tabular-nums">
        <span className={complete ? 'text-amber-300' : 'text-neutral-200'}>{owned}</span>
        <span className="text-neutral-500">
          /{total} {unit}
        </span>
      </span>
    </h2>
  )
}

export function Chip({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="flex cursor-pointer items-center gap-1 rounded-full border-1 border-white/[0.06] border-solid bg-white/[0.05] py-1 pr-2 pl-3 text-sm transition-colors hover:border-white/20"
    >
      {children}
      <X className="size-3.5 text-neutral-400" />
    </button>
  )
}

// the sticky bar's controls share a height, border and radius
export const control = 'h-10 rounded-lg border-1 border-white/[0.08] border-solid bg-neutral-800/70 text-sm transition-colors hover:border-white/20'

/** Tile art as two icons: the Pokémon's artwork or its card. */
export function ArtToggle({ value, onChange, className }: { value: TileArt; onChange: (x: TileArt) => void; className?: string }) {
  const icons = { sprite: PawPrint, card: RectangleVertical }
  return (
    <fieldset aria-label="Tile art" className={cn(control, 'm-0 flex shrink-0 items-center gap-0.5 p-1 hover:border-white/[0.08]', className)}>
      {artOptions.map((x) => {
        const Icon = icons[x]
        return (
          <button
            key={x}
            type="button"
            title={artLabels[x]}
            aria-label={artLabels[x]}
            aria-pressed={value === x}
            onClick={() => onChange(x)}
            className={cn(
              'flex h-full cursor-pointer items-center rounded-md px-2 text-neutral-400 transition-colors hover:text-white',
              value === x && 'bg-neutral-700 text-white',
            )}
          >
            <Icon className="size-4" />
          </button>
        )
      })}
    </fieldset>
  )
}

// summary panel pieces: pills for the counts, cards for the generation and type breakdown
export const pill =
  'flex cursor-pointer items-center gap-1 rounded-full border-1 border-white/[0.06] border-solid bg-white/[0.04] px-2.5 py-0.5 text-neutral-300 text-sm transition-colors hover:border-white/20'
export const cell =
  'group relative isolate flex w-full cursor-pointer flex-col gap-1 overflow-hidden rounded-lg border-1 border-white/[0.06] border-solid px-1.5 py-2 text-left shadow-[inset_0_1px_0_0_rgb(255_255_255/0.05)] transition-colors hover:border-white/20 sm:px-2.5'
// version mascots: Mewtwo, Lugia, Rayquaza, Dialga, Reshiram, Xerneas, Solgaleo, Zacian, Koraidon
export const regionMascots = [150, 249, 384, 483, 643, 716, 791, 888, 1007]
// the header's lineup, one or two per generation: Charizard, Gengar, Pikachu, Lucario, Greninja, Garchomp, Sylveon, Dragonite
export const headerArt = [6, 94, 25, 448, 658, 445, 700, 149]

export function Fraction({ value, max }: { value: number; max: number }) {
  return (
    <span className="text-xs tabular-nums leading-none sm:text-sm">
      <span className="font-semibold text-neutral-100">{value}</span>
      <span className="text-[11px] text-neutral-400 sm:text-xs">/{max}</span>
    </span>
  )
}
