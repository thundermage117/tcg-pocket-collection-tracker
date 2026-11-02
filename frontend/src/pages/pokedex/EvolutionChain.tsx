// Personal fork: an evolution line as stage columns (Eevee → its eight evolutions), each member a species tile,
// then the line's forms as compact rows of their own (Alolan Vulpix → Alolan Ninetales, from Charmeleon → Mega Charizard X / Y).
import { ChevronRight } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { allCards } from '@/lib/CardsDB'
import { type EvolutionLine, formChains, getSpecies } from '@/lib/pokedex'
import { cn, getCardNameByLang } from '@/lib/utils'
import type { Collection } from '@/types'
import { AbsentTile, FormTile, SpeciesTile, type TileArt } from './SpeciesTile'

interface Props {
  line: EvolutionLine
  collection: Collection | undefined
  lang: string
  art?: TileArt
  current?: number // dex number to highlight
  fromDex?: boolean
}

const tileWidth = 'w-20 sm:w-24'
const arrow = <ChevronRight className="size-4 shrink-0 text-neutral-500" />

interface StagesProps<T> {
  stages: T[][]
  render: (item: T) => ReactNode
  keyOf: (item: T) => string | number
  row?: boolean // branches side by side in a dashed group instead of stacked
}

/** Stage columns with arrows between; branches (Eevee, Oddish, Wurmple) wrap into a grid: one column up to 3, then 3 rows. */
function Stages<T>({ stages, render, keyOf, row }: StagesProps<T>) {
  return stages.map((stage, i) => (
    <Fragment key={keyOf(stage[0])}>
      {i > 0 && arrow}
      <div
        className={cn('grid gap-1.5 sm:gap-2', row && stage.length > 1 && 'rounded-lg border-1 border-neutral-700 border-dashed p-1 sm:p-1.5')}
        style={{ gridTemplateColumns: `repeat(${row ? stage.length : Math.ceil(stage.length / 3)}, minmax(0, 1fr))` }}
      >
        {stage.map((item) => (
          <Fragment key={keyOf(item)}>{render(item)}</Fragment>
        ))}
      </div>
    </Fragment>
  ))
}

export function EvolutionChain({ line, collection, lang, art, current, fromDex }: Props) {
  const chains = formChains(line)
  // localized name of the plain card a form chain starts from
  const fromName = (name: string) => {
    const card = allCards.find((c) => c.name === name)
    return card ? getCardNameByLang(card, lang) : name
  }
  return (
    <div className="flex w-max flex-col gap-3">
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Stages
          stages={line.stages}
          keyOf={(dexNr) => dexNr}
          render={(dexNr) => {
            const species = getSpecies(dexNr)
            return species ? (
              <SpeciesTile
                species={species}
                collection={collection}
                lang={lang}
                art={art}
                current={dexNr === current}
                fromDex={fromDex}
                className={tileWidth}
              />
            ) : (
              <AbsentTile dexNr={dexNr} lang={lang} className={tileWidth} />
            )
          }}
        />
      </div>
      {chains.length > 0 && <p className="-mb-1.5 text-[10px] font-medium uppercase tracking-wider text-neutral-500">Forms</p>}
      {chains.map((chain) => (
        <div key={chain.stages[0][0].name} className="flex items-center gap-1.5 sm:gap-2">
          {/* a form that evolves from a plain card says which (Charmeleon → Mega Charizard X / Y) */}
          {chain.from && (
            <>
              <span className="max-w-20 shrink-0 text-right text-neutral-500 text-xs leading-tight">from {fromName(chain.from)}</span>
              {arrow}
            </>
          )}
          <Stages
            stages={chain.stages}
            keyOf={(form) => form.name}
            render={(form) => <FormTile form={form} collection={collection} lang={lang} className={tileWidth} />}
            row
          />
        </div>
      ))}
    </div>
  )
}
