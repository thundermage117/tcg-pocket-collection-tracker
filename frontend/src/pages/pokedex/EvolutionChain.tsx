// Personal fork: an evolution line as stage columns (Eevee → its eight evolutions), each member a species tile,
// then the line's forms as chains of their own (Alolan Vulpix → Alolan Ninetales, Charmeleon → Mega Charizard X / Y).
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
}

const tileWidth = 'w-20 sm:w-24'
const arrow = <ChevronRight className="size-4 shrink-0 text-neutral-500" />
const hiddenArrow = <ChevronRight className="invisible size-4 shrink-0" />

/** Stage columns with arrows between; branches (Eevee, Oddish, Wurmple) wrap into a grid: one column up to 3, then 3 rows. */
function Stages<T>({ stages, render, keyOf }: { stages: T[][]; render: (item: T) => ReactNode; keyOf: (item: T) => string | number }) {
  return stages.map((stage, i) => (
    <Fragment key={keyOf(stage[0])}>
      {i > 0 && arrow}
      <div className="grid gap-1.5 sm:gap-2" style={{ gridTemplateColumns: `repeat(${Math.ceil(stage.length / 3)}, minmax(0, 1fr))` }}>
        {stage.map((item) => (
          <Fragment key={keyOf(item)}>{render(item)}</Fragment>
        ))}
      </div>
    </Fragment>
  ))
}

export function EvolutionChain({ line, collection, lang, art, current }: Props) {
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
              <SpeciesTile species={species} collection={collection} lang={lang} art={art} current={dexNr === current} className={tileWidth} />
            ) : (
              <AbsentTile dexNr={dexNr} lang={lang} className={tileWidth} />
            )
          }}
        />
      </div>
      {chains.map((chain) => (
        <div key={chain.stages[0][0].name} className="flex items-center gap-1.5 sm:gap-2">
          {/* empty columns up to the chain's stage, so Mega Charizard X (Stage 2) sits under Charizard; the last says where it comes from */}
          {Array.from({ length: chain.stage }, (_, i) => {
            const label = i === chain.stage - 1 && chain.from
            return (
              <Fragment key={i}>
                <span className={cn(tileWidth, 'shrink-0 text-right text-neutral-500 text-xs')}>{label && `from ${fromName(label)}`}</span>
                {label ? arrow : hiddenArrow}
              </Fragment>
            )
          })}
          <Stages
            stages={chain.stages}
            keyOf={(form) => form.name}
            render={(form) => <FormTile form={form} collection={collection} lang={lang} className={tileWidth} />}
          />
        </div>
      ))}
    </div>
  )
}
