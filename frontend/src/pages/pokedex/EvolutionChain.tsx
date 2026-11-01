// Personal fork: an evolution line as stage columns (Eevee → its eight evolutions), each member a species tile.
import { ChevronRight } from 'lucide-react'
import { Fragment } from 'react'
import { type EvolutionLine, getSpecies } from '@/lib/pokedex'
import type { Collection } from '@/types'
import { AbsentTile, SpeciesTile, type TileArt } from './SpeciesTile'

interface Props {
  line: EvolutionLine
  collection: Collection | undefined
  lang: string
  art?: TileArt
  current?: number // dex number to highlight
}

export function EvolutionChain({ line, collection, lang, art, current }: Props) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {line.stages.map((stage, i) => (
        <Fragment key={stage[0]}>
          {i > 0 && <ChevronRight className="size-4 shrink-0 text-neutral-500" />}
          {/* branches (Eevee, Oddish, Wurmple) wrap into a grid: one column up to 3, then 3 rows */}
          <div className="grid gap-1.5 sm:gap-2" style={{ gridTemplateColumns: `repeat(${Math.ceil(stage.length / 3)}, minmax(0, 1fr))` }}>
            {stage.map((dexNr) => {
              const species = getSpecies(dexNr)
              return species ? (
                <SpeciesTile key={dexNr} species={species} collection={collection} lang={lang} art={art} current={dexNr === current} className="w-20 sm:w-24" />
              ) : (
                <AbsentTile key={dexNr} dexNr={dexNr} lang={lang} className="w-20 sm:w-24" />
              )
            })}
          </div>
        </Fragment>
      ))}
    </div>
  )
}
