// Personal fork: the rankings page's demand map — every card on log–log scatters of wishlists per offer against listings, one per rarity.
import { type MouseEvent, type RefObject, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMediaQuery } from 'react-responsive'
import {
  CartesianGrid,
  DefaultZIndexes,
  ReferenceLine,
  type ScaleFunction,
  Scatter,
  ScatterChart,
  type TooltipContentProps,
  useXAxisScale,
  useYAxisScale,
  XAxis,
  YAxis,
  ZIndexLayer,
} from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { type ChartConfig, ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { expansions, getExpansionById } from '@/lib/CardsDB'
import { getLocalizedImagePath } from '@/lib/imageLocales'
import type { DemandPoint } from '@/lib/rankings'
import { getCardNameByLang } from '@/lib/utils'
import { averageDemandRatio } from '@/lib/ValueDB'
import { type Card, type ExpansionId, type Rarity, rarities } from '@/types'

// The app is dark-only, but both steps are given so the chart wrapper's theme scopes stay complete.
// The highlighted group (owned cards, or the newest set) is the one categorical hue; the rest is context grey, drawn
// underneath.
const chartConfig = {
  owned: { label: 'Highlighted', theme: { light: '#2a78d6', dark: '#3987e5' } },
  rest: { label: 'Rest', theme: { light: '#a3a3a3', dark: '#737373' } },
  surface: { theme: { light: '#fcfcfb', dark: '#1a1a1a' } },
} satisfies ChartConfig

// Offers against wishlists is a thin diagonal band, so the map is turned to lie it flat: x is how much a card is traded
// (wishlists + offers), y is wishlists per offer. The average and its 2× and ½× lines are then horizontal, and a card's
// height is how wanted it is. Both axes are log; the ratio is (wish + 1) / (offers + 1), so a card nobody offers or
// wants still has a finite height.
const activity = (p: DemandPoint) => p.wish + p.offers
const ratioOf = (p: DemandPoint) => (p.wish + 1) / (p.offers + 1)
const formatCount = (n: number) => (n >= 1000 ? `${n / 1000}k` : `${n}`)

// The axes hug the data, padded by a twentieth of its log span on each side, rather than rounding out to whole decades
const logDomain = (values: number[]): [number, number] => {
  const lo = Math.log10(Math.min(...values))
  const hi = Math.log10(Math.max(...values))
  const pad = Math.max(hi - lo, 0.5) / 20
  return [10 ** (lo - pad), 10 ** (hi + pad)]
}

// Ticks at 1, 2 and 5 per decade, thinned to 1 and 3, then to the decades alone, while that would crowd the axis
const logTicks = ([min, max]: [number, number], most = 6) => {
  const ticksAt = (steps: number[]) => {
    const ticks: number[] = []
    for (let k = Math.floor(Math.log10(min)); 10 ** k <= max; k++) {
      for (const m of steps) {
        const tick = Number((m * 10 ** k).toPrecision(1))
        if (tick >= min && tick <= max) {
          ticks.push(tick)
        }
      }
    }
    return ticks
  }
  const tiers = [[1, 2, 5], [1, 3], [1]].map(ticksAt)
  return tiers.find((ticks) => ticks.length <= most) ?? tiers[tiers.length - 1]
}

// The newest set's cards have few spares listed yet, so they sit apart on the left; marking it explains that cluster
const newestSet = (points: DemandPoint[]) => {
  const present = new Set(points.map((p) => p.card.expansion))
  return expansions.findLast((e) => present.has(e.id))?.id
}

// How far a tap may land from a dot and still pick it, in px: dense clusters are far smaller than a fingertip
const TAP_RADIUS = 32

type Highlight = 'owned' | 'newest' | 'none'

interface Dot {
  x: number
  y: number
  point: DemandPoint
}

interface Guide {
  label?: string // the average line is named in the legend; the 2× and ½× lines get a label at their right end
  dashed: boolean
  y: number
}

type Scales = { x: ScaleFunction; y: ScaleFunction }

// Renders inside the chart to reach its scales: labels the guide lines, rings the tapped dot, and hands the scales
// out so a tap can be matched to the nearest dot in pixels
function PlotOverlay({ guides, xMax, picked, scalesRef }: { guides: Guide[]; xMax: number; picked?: Dot; scalesRef: RefObject<Scales | undefined> }) {
  const x = useXAxisScale()
  const y = useYAxisScale()
  if (!x || !y) {
    return null
  }
  scalesRef.current = { x, y }
  const ringX = picked && x(picked.x)
  const ringY = picked && y(picked.y)
  const ex = x(xMax)
  return (
    // above the dots (scatter is z 600), so the ring around a tapped dot isn't buried in its cluster
    <ZIndexLayer zIndex={DefaultZIndexes.activeDot}>
      <g className="pointer-events-none">
        {guides.map(({ label, y: value }) => {
          const ey = y(value)
          return label && ex !== undefined && ey !== undefined ? (
            <text key={label} x={ex - 4} y={ey - 4} textAnchor="end" className="fill-neutral-500 text-[10px]">
              {label}
            </text>
          ) : null
        })}
        {ringX !== undefined && ringY !== undefined && <circle cx={ringX} cy={ringY} r={8} fill="none" stroke="#f5f5f5" strokeWidth={1.5} />}
      </g>
    </ZIndexLayer>
  )
}

function CardDetails({ point, owned }: { point: DemandPoint; owned?: (card: Card) => boolean }) {
  const { t, i18n } = useTranslation('common/sets')
  const { card } = point
  return (
    <div className="flex min-w-0 flex-1 gap-3">
      <img src={getLocalizedImagePath(card, i18n.language)} alt="" className="aspect-[367/512] w-14 shrink-0 rounded object-cover" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div>
          <div className="truncate font-medium text-neutral-100">{getCardNameByLang(card, i18n.language)}</div>
          <div className="truncate text-neutral-400">
            {t(getExpansionById(card.expansion).name)} · {card.card_id} · {card.rarity}
          </div>
        </div>
        <dl className="grid grid-cols-[1fr_auto] gap-x-2 text-neutral-400">
          <dt>Wishlists</dt>
          <dd className="text-right font-medium text-neutral-100 tabular-nums">{point.wish.toLocaleString()}</dd>
          <dt>Offers</dt>
          <dd className="text-right font-medium text-neutral-100 tabular-nums">{point.offers.toLocaleString()}</dd>
          <dt>Adj. demand</dt>
          <dd className="text-right font-medium text-neutral-100 tabular-nums">×{point.score.toFixed(2)}</dd>
        </dl>
        {owned && <div className="text-neutral-500">{owned(card) ? 'In your collection' : 'Not in your collection'}</div>}
      </div>
    </div>
  )
}

interface PanelProps {
  title: string
  highDots: Dot[]
  restDots: Dot[]
  xDomain: [number, number]
  yDomain: [number, number]
  guides: Guide[]
  plain: boolean
  single: boolean // the only panel, so it gets the full width, a wider shape and the fuller tick set
  coarse: boolean
  picked?: DemandPoint
  onPick: (point: DemandPoint | undefined) => void
  onSelect: (card: Card) => void
  owned?: (card: Card) => boolean
}

// One rarity's cards. Every panel shares the same axes, so positions compare across panels.
function Panel({ title, highDots, restDots, xDomain, yDomain, guides, plain, single, coarse, picked, onPick, onSelect, owned }: PanelProps) {
  const scalesRef = useRef<Scales>(undefined)
  const pickedDot = picked && (highDots.find((d) => d.point === picked) ?? restDots.find((d) => d.point === picked))
  const [lo, hi] = [averageDemandRatio() / 2, averageDemandRatio() * 2]

  // The context cards are small and faint where they sit within 2× of the average, so a crowd adds up to a brighter
  // patch instead of a solid blob, and the cards outside that band, the interesting ones, stay at full strength. The
  // transparent circle is a ~22px hit area for hover and click; `ring` marks the hovered card.
  const dot =
    (fill: string, r: number, fade: boolean, ring = false) =>
    (props: unknown) => {
      const { cx, cy, payload } = props as { cx?: number; cy?: number; payload?: Dot }
      if (cx === undefined || cy === undefined || !payload) {
        return <g />
      }
      const inBand = fade && payload.y > lo && payload.y < hi
      return (
        <g className="cursor-pointer">
          <circle cx={cx} cy={cy} r={11} fill="transparent" />
          <circle cx={cx} cy={cy} r={r} fill={fill} fillOpacity={ring ? 1 : inBand ? 0.3 : 0.9} />
          {ring && <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke="#f5f5f5" strokeWidth={1.5} />}
        </g>
      )
    }
  const r = single ? 3 : 2
  const restFill = plain ? 'var(--color-owned)' : 'var(--color-rest)'

  const select = (item: { payload?: Dot }) => item.payload && onSelect(item.payload.point.card)

  // Nearest dot to the tap, in pixels; a tap on empty space clears the pick
  const tap = (e: MouseEvent<HTMLDivElement>) => {
    const svg = e.currentTarget.querySelector('svg.recharts-surface')
    const scales = scalesRef.current
    if (!svg || !scales) {
      return
    }
    const box = svg.getBoundingClientRect()
    const [px, py] = [e.clientX - box.left, e.clientY - box.top]
    let best: Dot | undefined
    let bestDist = TAP_RADIUS ** 2
    for (const d of [...highDots, ...restDots]) {
      const dx = (scales.x(d.x) ?? Number.NaN) - px
      const dy = (scales.y(d.y) ?? Number.NaN) - py
      if (dx * dx + dy * dy < bestDist) {
        best = d
        bestDist = dx * dx + dy * dy
      }
    }
    onPick(best?.point)
  }

  const tooltip = ({ active, payload }: TooltipContentProps<ValueType, NameType>) => {
    const hovered = active ? (payload?.[0]?.payload as Dot | undefined)?.point : undefined
    if (!hovered) {
      return null
    }
    return (
      <div className="flex w-64 max-w-[75vw] rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-xs shadow-xl">
        <CardDetails point={hovered} owned={owned} />
      </div>
    )
  }

  const total = highDots.length + restDots.length
  return (
    <div className="min-w-0 rounded-lg border border-neutral-800 p-1.5">
      <div className="flex items-baseline justify-between gap-2 px-1 text-xs">
        <span className="font-medium text-neutral-200">{title}</span>
        <span className="text-neutral-500 tabular-nums">
          {!plain && <span className="text-[#3987e5]">{highDots.length.toLocaleString()} / </span>}
          {total.toLocaleString()}
        </span>
      </div>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: touch-only nearest-dot picking; the Most wanted tab is the list view */}
      <div onClick={coarse ? tap : undefined}>
        <ChartContainer
          config={chartConfig}
          className={`w-full [&_g]:outline-hidden ${single ? 'aspect-square sm:aspect-[16/9]' : 'aspect-[5/4]'}`}
          role="img"
          aria-label={`${title}: ${total} cards, wishlists per offer against total listings on log scales`}
        >
          <ScatterChart margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#262626" strokeWidth={1} />
            <XAxis
              type="number"
              dataKey="x"
              scale="log"
              domain={xDomain}
              ticks={logTicks(xDomain, single ? 6 : 3)}
              tickFormatter={formatCount}
              allowDataOverflow
              tickLine={false}
              axisLine={false}
              height={single ? 24 : 18}
              tick={{ fontSize: single ? 12 : 10 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              scale="log"
              domain={yDomain}
              ticks={logTicks(yDomain, single ? 6 : 4)}
              allowDataOverflow
              tickLine={false}
              axisLine={false}
              width={single ? 40 : 30}
              tick={{ fontSize: single ? 12 : 10 }}
            />
            {guides.map(({ label, dashed, y }) => (
              <ReferenceLine key={label ?? 'average'} y={y} stroke={dashed ? '#a3a3a3' : '#525252'} strokeDasharray={dashed ? '4 4' : '1 3'} strokeWidth={1} />
            ))}
            {!coarse && <ChartTooltip content={tooltip} cursor={false} isAnimationActive={false} />}
            {/* highlighted last, so it draws on top of the context dots */}
            <Scatter
              data={restDots}
              shape={dot(restFill, r, true)}
              activeShape={coarse ? undefined : dot(restFill, r, true, true)}
              onClick={coarse ? undefined : select}
              isAnimationActive={false}
            />
            {!plain && (
              <Scatter
                data={highDots}
                shape={dot('var(--color-owned)', r + 0.5, false)}
                activeShape={coarse ? undefined : dot('var(--color-owned)', r + 0.5, false, true)}
                onClick={coarse ? undefined : select}
                isAnimationActive={false}
              />
            )}
            {/* the 2× and ½× labels only fit a full-width panel; the legend names the lines either way */}
            <PlotOverlay guides={single ? guides : []} xMax={xDomain[1]} picked={coarse ? pickedDot : undefined} scalesRef={scalesRef} />
          </ScatterChart>
        </ChartContainer>
      </div>
    </div>
  )
}

interface Props {
  points: DemandPoint[]
  owned?: (card: Card) => boolean // left out when ownership isn't shown: every dot is drawn the same
  onSelect: (card: Card) => void
}

export function DemandMap({ points, owned, onSelect }: Props) {
  const { t } = useTranslation('common/sets')
  // Touch: a tap picks the nearest dot in its panel and shows it below the panels, where "Open card" is a real button
  const coarse = useMediaQuery({ query: '(pointer: coarse)' })
  const [picked, setPicked] = useState<DemandPoint>()

  // The newest-set highlight only means something when the map holds it alongside other sets
  const newest: ExpansionId | undefined = useMemo(() => {
    const id = newestSet(points)
    return id && points.some((p) => p.card.expansion !== id) ? id : undefined
  }, [points])
  const options: Highlight[] = [owned ? 'owned' : 'none', ...(newest ? (['newest'] as const) : [])]
  const [chosen, setChosen] = useState<Highlight>(owned ? 'owned' : 'none')
  const highlight = options.includes(chosen) ? chosen : options[0]

  // One panel per rarity, in rarity order: rarity decides most of where a card lands, so stacked on one chart the
  // rarities bury each other, while apart each panel holds a few hundred cards
  const { panels, highCount, xDomain, yDomain } = useMemo(() => {
    const isHigh = (card: Card) => (highlight === 'owned' ? !!owned?.(card) : highlight === 'newest' ? card.expansion === newest : false)
    const byRarity = new Map<Rarity, { highDots: Dot[]; restDots: Dot[] }>()
    let highCount = 0
    for (const point of points) {
      const panel = byRarity.get(point.card.rarity) ?? { highDots: [], restDots: [] }
      const high = isHigh(point.card)
      highCount += high ? 1 : 0
      ;(high ? panel.highDots : panel.restDots).push({ x: activity(point), y: ratioOf(point), point })
      byRarity.set(point.card.rarity, panel)
    }
    return {
      panels: rarities.flatMap((rarity) => {
        const panel = byRarity.get(rarity)
        return panel ? [{ rarity, ...panel }] : []
      }),
      highCount,
      xDomain: logDomain(points.map(activity)),
      yDomain: logDomain(points.map(ratioOf)),
    }
  }, [points, owned, highlight, newest])
  const plain = highlight === 'none'
  const single = panels.length === 1
  const pickedPoint = picked && points.includes(picked) ? picked : undefined

  // The average wishlists per offer (what demandScore shrinks toward), plus fainter lines at 2× and ½× it, splitting the
  // map into hot / normal / cold bands. A line outside the cards' range is left out.
  const ratio = averageDemandRatio()
  const guides = (
    [
      [1, undefined],
      [2, '2×'],
      [0.5, '½×'],
    ] as const
  ).flatMap(([k, label]): Guide[] => (ratio * k > yDomain[0] && ratio * k < yDomain[1] ? [{ label, dashed: k === 1, y: ratio * k }] : []))

  const highlightLabel = (h: Highlight) => (h === 'owned' ? 'Owned' : h === 'newest' && newest ? `Newest set (${newest})` : 'None')
  const legendItems =
    highlight === 'owned'
      ? ['Owned', 'Not owned']
      : highlight === 'newest' && newest
        ? [`${t(getExpansionById(newest).name)} · few spares listed yet`, 'Other sets']
        : undefined

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
      {options.length > 1 && (
        <div className="mb-2 flex items-center gap-2 text-xs text-neutral-400">
          Highlight
          <ToggleGroup
            type="single"
            value={highlight}
            onValueChange={(v) => v && setChosen(v as Highlight)}
            className="gap-0.5 rounded-md border-1 border-neutral-700 p-0.5"
            aria-label="Highlight"
          >
            {options.map((h) => (
              <ToggleGroupItem key={h} value={h} className="h-7 px-2 text-xs">
                {highlightLabel(h)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-400">
        {legendItems ? (
          <>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: chartConfig.owned.theme.dark }} />
              {legendItems[0]} · {highCount.toLocaleString()}
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full opacity-60" style={{ backgroundColor: chartConfig.rest.theme.dark }} />
              {legendItems[1]} · {(points.length - highCount).toLocaleString()}
            </span>
          </>
        ) : (
          <span>{points.length.toLocaleString()} cards</span>
        )}
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="w-4 border-t border-dashed border-neutral-400" />
          Average: {ratio.toFixed(2)} wishlists per offer
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="w-4 border-t border-dotted border-neutral-500" />
          2× and ½× the average
        </span>
      </div>
      <p className="mb-2 text-xs text-neutral-500">↑ wishlists per offer (higher is more wanted) · → listings, wishlists + offers (further is more traded)</p>

      <div className={`grid gap-2 ${single ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3'}`}>
        {panels.map(({ rarity, highDots, restDots }) => (
          <Panel
            key={rarity}
            title={rarity}
            highDots={highDots}
            restDots={restDots}
            xDomain={xDomain}
            yDomain={yDomain}
            guides={guides}
            plain={plain}
            single={single}
            coarse={coarse}
            picked={pickedPoint}
            onPick={setPicked}
            onSelect={onSelect}
            owned={owned}
          />
        ))}
      </div>
      {coarse && (
        <div className="sticky bottom-19 z-20 mt-2 min-h-[5.5rem] rounded-lg border border-neutral-600 bg-neutral-900/95 p-2 text-xs shadow-lg backdrop-blur">
          {pickedPoint ? (
            <div className="flex items-start gap-2">
              <CardDetails point={pickedPoint} owned={owned} />
              <button
                type="button"
                className="shrink-0 rounded-md border border-neutral-700 px-2.5 py-1.5 text-neutral-200"
                onClick={() => onSelect(pickedPoint.card)}
              >
                Open card
              </button>
            </div>
          ) : (
            <p className="py-6 text-center text-neutral-500">Tap near a dot to see the card.</p>
          )}
        </div>
      )}
      <p className="mt-1 text-[11px] text-neutral-500">
        One panel per rarity, all on the same log scales. Height is (wishlists + 1) / (offers + 1). Cards within 2× of the average are faded so the outliers
        stand out. Cards with no listings at all are left out. {coarse ? 'Tap near a dot to pick the closest card.' : 'Click a dot to open the card.'} The Most
        wanted tab lists the same cards ranked.
      </p>
    </section>
  )
}
