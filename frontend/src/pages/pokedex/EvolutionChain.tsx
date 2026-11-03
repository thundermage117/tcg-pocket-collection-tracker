// Personal fork: an evolution line as stage columns (Eevee → its eight evolutions), each member a species tile,
// then the line's forms as rows under the same columns (Alolan Vulpix under Vulpix; Mega Charizard X / Y under Charizard,
// branching off Charmeleon).
import { ChevronRight } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { type EvolutionLine, formChains, getSpecies } from '@/lib/pokedex'
import { cn } from '@/lib/utils'
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

/**
 * Around a line wider than its card: it scrolls (without carrying the page along), snaps tile by tile, and fades at the
 * right edge as a hint there's more; the padding lets the last tile clear the fade.
 */
export const chainScroller =
  'overflow-x-auto overscroll-x-contain snap-x snap-proximity pr-6 pb-1 [mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)] [&_a]:snap-start'

const tileWidth = 'w-20 sm:w-24'
// the middle of a column's first tile, where a branch line drops from (half of tileWidth)
const tileMiddle = 'left-10 sm:left-12'
const arrow = <ChevronRight className="size-4 shrink-0 text-neutral-500" />

/**
 * One stage's members; branches (Eevee, Oddish, Wurmple) wrap into a grid: one column up to 3, then 3 rows. Forms sit side by side.
 * A branching stage gets a bracket in the gap to its left, a tick into each row, which the arrow column's line runs into.
 */
function Stage<T>({
  items,
  render,
  keyOf,
  row,
  branch,
}: {
  items: T[]
  render: (item: T) => ReactNode
  keyOf: (item: T) => string | number
  row?: boolean
  branch?: boolean
}) {
  const columns = row ? items.length : Math.ceil(items.length / 3)
  const rows = Math.ceil(items.length / columns)
  return (
    <div
      className={cn('grid gap-1.5 sm:gap-2', row && items.length > 1 && 'rounded-lg bg-neutral-800/50 p-1 sm:p-1.5')}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {items.map((item, i) => {
        const r = Math.floor(i / columns)
        return (
          <div key={keyOf(item)} className="relative">
            {branch && rows > 1 && i % columns === 0 && (
              <>
                {/* the bracket's share of this row: from the row above's gap (or its own middle) to the row below's */}
                <span
                  aria-hidden
                  className={cn(
                    'absolute right-[calc(100%+0.5rem)] border-neutral-600 border-l',
                    r === 0 ? 'top-1/2' : '-top-1.5 sm:-top-2',
                    r === rows - 1 ? 'bottom-1/2' : '-bottom-1.5 sm:-bottom-2',
                  )}
                />
                <span aria-hidden className="absolute top-1/2 right-full w-2 border-neutral-600 border-t" />
              </>
            )}
            {render(item)}
          </div>
        )
      })}
    </div>
  )
}

export function EvolutionChain({ line, collection, lang, art, current, fromDex }: Props) {
  const columnOf = (dexNr: number) => line.stages.findIndex((stage) => stage.includes(dexNr))
  // a form chain sits in the column after the plain card it evolves from (Mega Charizard X / Y under Charizard, from Charmeleon),
  // or with none, under its own species (Alolan Vulpix under Vulpix)
  const rows = formChains(line).map((chain) => {
    const fromColumn = chain.from ? line.stages.findIndex((stage) => stage.some((nr) => getSpecies(nr)?.key === chain.from?.toLowerCase())) : -1
    const start = fromColumn >= 0 ? fromColumn + 1 : Math.max(0, columnOf(chain.stages[0][0].species.dexNr))
    return { chain, fromColumn, start }
  })
  const columns = Math.max(line.stages.length, ...rows.map((r) => r.start + r.chain.stages.length))
  // grid columns alternate stage, arrow, stage…: stage i is grid column 2i + 1
  const at = (column: number, row: number) => ({ gridColumn: 2 * column + 1, gridRow: row })
  return (
    <div className="grid w-max items-center gap-y-3" style={{ gridTemplateColumns: `repeat(${2 * columns - 1}, auto)` }}>
      {line.stages.map((stage, i) => (
        <Fragment key={stage[0]}>
          {i > 0 &&
            (stage.length > 1 ? (
              // into a branching stage's bracket: a line, not an arrow
              <span aria-hidden className="relative w-6 self-stretch sm:w-7" style={{ gridColumn: 2 * i, gridRow: 1 }}>
                <span className="absolute top-1/2 right-2 left-1 border-neutral-600 border-t" />
              </span>
            ) : (
              <span className="px-1 sm:px-1.5" style={{ gridColumn: 2 * i, gridRow: 1 }}>
                {arrow}
              </span>
            ))}
          <div className="relative flex flex-col justify-center self-stretch" style={at(i, 1)}>
            {/* a branch line starts here, from behind the first tile down to the row's edge */}
            {rows.some((r) => r.fromColumn === i) && <span aria-hidden className={cn('absolute top-1/2 bottom-0 border-neutral-600 border-l', tileMiddle)} />}
            <Stage
              items={stage}
              keyOf={(dexNr) => dexNr}
              branch={i > 0}
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
        </Fragment>
      ))}
      {rows.map(({ chain, fromColumn, start }, r) => {
        const row = r + 2
        // the branch line runs on down when a later chain branches off the same column
        const continues = rows.slice(r + 1).some((later) => later.fromColumn === fromColumn)
        return (
          <Fragment key={chain.stages[0][0].name}>
            {fromColumn >= 0 && (
              <>
                {/* a line down from the plain card it evolves from, turning right into the arrow */}
                <span aria-hidden className="relative self-stretch" style={at(fromColumn, row)}>
                  <span className={cn('absolute -top-3 border-neutral-600 border-l', tileMiddle, continues ? '-bottom-3' : 'h-[calc(50%+0.75rem)]')} />
                  <span className={cn('absolute right-0 top-1/2 border-neutral-600 border-t', tileMiddle)} />
                </span>
                <span className="relative flex items-center self-stretch px-1 sm:px-1.5" style={{ gridColumn: 2 * start, gridRow: row }}>
                  <span aria-hidden className="absolute top-1/2 right-1/2 left-0 border-neutral-600 border-t" />
                  <span className="relative">{arrow}</span>
                </span>
              </>
            )}
            {chain.stages.map((stage, j) => (
              <Fragment key={stage[0].name}>
                {j > 0 && (
                  <span className="px-1 sm:px-1.5" style={{ gridColumn: 2 * (start + j), gridRow: row }}>
                    {arrow}
                  </span>
                )}
                <div style={at(start + j, row)}>
                  <Stage
                    items={stage}
                    keyOf={(form) => form.name}
                    render={(form) => <FormTile form={form} collection={collection} lang={lang} art={art} fromDex={fromDex} className={tileWidth} />}
                    row
                  />
                </div>
              </Fragment>
            ))}
          </Fragment>
        )
      })}
    </div>
  )
}
