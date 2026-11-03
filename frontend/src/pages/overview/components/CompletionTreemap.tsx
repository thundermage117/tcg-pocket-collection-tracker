// Personal fork: the completion heatmap's "map" view. Each set is a tray, each rarity a tile inside it; tile area is how many
// cards the rarity has, tile fill is the heatmap's own band, so both views read as one system.
import type { CSSProperties, KeyboardEvent } from 'react'
import { ResponsiveContainer, Treemap, type TreemapNode } from 'recharts'
import type { ExpansionId, Rarity } from '@/types'

export interface TreemapTile {
  rarity: Rarity
  collected: number
  available: number
  style: CSSProperties // the heatmap swatch: backgroundColor is the fill, color the label ink
  nearlyDone: boolean
}

export interface TreemapSet {
  id: ExpansionId
  name: string
  tiles: TreemapTile[]
}

interface Props {
  sets: TreemapSet[]
  onOpen: (expansion: ExpansionId, rarity: Rarity) => void
}

// Recharts spreads each datum onto its node, so the renderer gets these fields back next to x/y/width/height
type Datum = { name: string; value?: number; set: TreemapSet; tile?: TreemapTile; children?: Datum[] }

const GAP = 2 // surface gap between touching tiles
const INSET = 3 // the set tray's rim around its tiles
const FONT = 11
const CHAR_W = 6.6 // rough advance of an 11px glyph, rarity symbols included; only used to decide whether a label fits

const rarityGlyph = (r: Rarity) => (r === 'Crown Rare' ? '♛' : r)
const fits = (text: string, width: number) => text.length * CHAR_W + 8 <= width

export function CompletionTreemap({ sets, onOpen }: Props) {
  // Newest set first, rarities in column order, the same reading order as the grid
  const data: Datum[] = sets.map((set) => ({
    name: set.id,
    set,
    children: set.tiles.map((tile) => ({ name: `${set.id}|${tile.rarity}`, value: tile.available, set, tile })),
  }))

  const renderNode = (node: TreemapNode) => {
    const { x, y, width, height, depth } = node
    const { set, tile } = node as unknown as Datum
    if (depth === 0 || width <= 0 || height <= 0) {
      return <g />
    }
    if (depth === 1 || !tile) {
      // The tray that groups a set's tiles; the inset leaves a dark rim, which is what makes the set boundary read
      return <rect x={x} y={y} width={width} height={height} rx={5} fill="rgb(10 10 10 / 0.55)" />
    }

    const missing = tile.available - tile.collected
    const head = `${set.id} ${rarityGlyph(tile.rarity)}`
    const count = `${tile.collected}/${tile.available}`
    // Two lines when there's room, one when it's a short wide tile, otherwise the tooltip carries it
    const twoLines = height >= 34 && fits(head, width) && fits(count, width)
    const oneLine = !twoLines && height >= 18 && fits(`${head} ${count}`, width)
    const label = `${set.name} ${tile.rarity}`
    const open = () => onOpen(set.id, tile.rarity)
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        open()
      }
    }

    return (
      // biome-ignore lint/a11y/useSemanticElements: an SVG tile can't be a <button>; role + tabIndex + key handling stand in
      <g
        role="button"
        tabIndex={0}
        className="cursor-pointer outline-none transition-[filter] hover:brightness-125 focus-visible:brightness-125"
        onClick={open}
        onKeyDown={onKeyDown}
        data-tooltip-id="completion-heatmap"
        data-tooltip-content={`${label}: ${tile.collected} / ${tile.available}${missing > 0 ? ` · ${missing} missing` : ' · complete'}`}
        aria-label={`${label}: ${tile.collected} of ${tile.available} collected`}
      >
        <rect x={x} y={y} width={width} height={height} rx={3} fill={tile.style.backgroundColor} />
        {(twoLines || oneLine) && (
          <text x={x + 5} y={y + 4} fill={tile.style.color} fontSize={FONT} dominantBaseline="hanging" className="pointer-events-none tabular-nums">
            {twoLines ? (
              <>
                <tspan fontWeight={600}>{head}</tspan>
                <tspan x={x + 5} dy={FONT + 3}>
                  {count}
                </tspan>
              </>
            ) : (
              <>
                <tspan fontWeight={600}>{head}</tspan> {count}
              </>
            )}
          </text>
        )}
        {tile.nearlyDone && width >= 14 && height >= 14 && <circle cx={x + width - 6} cy={y + 6} r={3} fill="#fbbf24" className="pointer-events-none" />}
      </g>
    )
  }

  return (
    <div className="h-[34rem] lg:h-[38rem]">
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={data}
          dataKey="value"
          nameKey="name"
          aspectRatio={4 / 3}
          nodeGap={GAP}
          nodeInset={INSET}
          isAnimationActive={false}
          content={renderNode}
        />
      </ResponsiveContainer>
    </div>
  )
}
