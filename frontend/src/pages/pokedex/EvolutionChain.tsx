// Personal fork: an evolution line as stage columns (Eevee → its eight evolutions), each member a species tile with its forms under it.
import { ChevronRight } from 'lucide-react'
import { Fragment } from 'react'
import { artForms, type EvolutionLine, getSpecies, ownedCount } from '@/lib/pokedex'
import type { Collection } from '@/types'
import { AbsentTile, SpeciesTile, Sprite, type TileArt } from './SpeciesTile'

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
              if (!species) {
                return <AbsentTile key={dexNr} dexNr={dexNr} lang={lang} className="w-20 sm:w-24" />
              }
              // evolution data is per species, so forms (Alolan Vulpix, Mega Charizard X) ride along under their species
              const forms = artForms(species)
              return (
                <div key={dexNr} className="w-20 sm:w-24">
                  <SpeciesTile species={species} collection={collection} lang={lang} art={art} current={dexNr === current} />
                  {forms.length > 0 && (
                    <div className="mt-1 flex flex-wrap justify-center gap-0.5">
                      {forms.map((form) => {
                        const caught = ownedCount(collection, form.cards) > 0
                        return (
                          <span key={form.artworkId} title={form.name} className="size-6 rounded bg-neutral-800">
                            {/* a stronger silhouette than tiles get: at this size the faint one disappears */}
                            <Sprite artworkId={form.artworkId} caught={caught} alt={form.name} className={caught ? undefined : 'opacity-40'} />
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Fragment>
      ))}
    </div>
  )
}
