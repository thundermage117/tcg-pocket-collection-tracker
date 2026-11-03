// Personal fork: the rankings page's demand map — every card on a log–log scatter of offers (supply) against wishlists (demand).
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
import type { Card, ExpansionId } from '@/types'

// The app is dark-only, but both steps are given so the chart wrapper's theme scopes stay complete.
// The highlighted group (owned cards, or the newest set) is the one categorical hue; the rest is context grey, also drawn
// smaller and underneath.
const chartConfig = {
  owned: { label: 'Highlighted', theme: { light: '#2a78d6', dark: '#3987e5' } },
  rest: { label: 'Rest', theme: { light: '#a3a3a3', dark: '#737373' } },
  surface: { theme: { light: '#fcfcfb', dark: '#1a1a1a' } },
} satisfies ChartConfig

// log scales can't show 0, so every count is plotted as count + 1: a card nobody offers sits on the left edge.
// Ticks go at 10^k + 1 and are labelled with the real count (0, 10, 100, …); the axes span the decades the data covers.
const plotted = (count: number) => count + 1
const formatCount = (n: number) => (n >= 1000 ? `${n / 1000}k` : `${n}`)
const decadeTicks = (values: number[]) => {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const ticks = [1]
  for (let p = 10; ticks[ticks.length - 1] < max; p *= 10) {
    ticks.push(p + 1)
  }
  return ticks.filter((_, i) => i + 1 === ticks.length || ticks[i + 1] > min)
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
  label?: string // the average line is named in the legend; the 2× and ½× lines get a label at their end
  dashed: boolean
  endsOnTop: boolean // clipped by the top edge rather than the right one
  segment: readonly [{ x: number; y: number }, { x: number; y: number }]
}

type Scales = { x: ScaleFunction; y: ScaleFunction }

// Renders inside the chart to reach its scales: labels the guide lines, rings the tapped dot, and hands the scales
// out so a tap can be matched to the nearest dot in pixels
function PlotOverlay({ guides, picked, scalesRef }: { guides: Guide[]; picked?: Dot; scalesRef: RefObject<Scales | undefined> }) {
  const x = useXAxisScale()
  const y = useYAxisScale()
  if (!x || !y) {
    return null
  }
  scalesRef.current = { x, y }
  const ringX = picked && x(picked.x)
  const ringY = picked && y(picked.y)
  return (
    // above the dots (scatter is z 600), so the ring around a tapped dot isn't buried in its cluster
    <ZIndexLayer zIndex={DefaultZIndexes.activeDot}>
      <g className="pointer-events-none">
        {guides.map(({ label, endsOnTop, segment }) => {
          const ex = x(segment[1].x)
          const ey = y(segment[1].y)
          // on the top edge the label sits just below the line's end, on the right edge just above it
          return label && ex !== undefined && ey !== undefined ? (
            <text key={label} x={ex - 4} y={endsOnTop ? ey + 12 : ey - 4} textAnchor="end" className="fill-neutral-500 text-[10px]">
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

interface Props {
  points: DemandPoint[]
  owned?: (card: Card) => boolean // left out when ownership isn't shown: every dot is drawn the same
  onSelect: (card: Card) => void
}

export function DemandMap({ points, owned, onSelect }: Props) {
  const { t } = useTranslation('common/sets')
  // Touch: a tap picks the nearest dot and shows it below the chart, where "Open card" is a real button
  const coarse = useMediaQuery({ query: '(pointer: coarse)' })
  const [picked, setPicked] = useState<DemandPoint>()
  const scalesRef = useRef<Scales>(undefined)

  // The newest-set highlight only means something when the map holds it alongside other sets
  const newest: ExpansionId | undefined = useMemo(() => {
    const id = newestSet(points)
    return id && points.some((p) => p.card.expansion !== id) ? id : undefined
  }, [points])
  const options: Highlight[] = [owned ? 'owned' : 'none', ...(newest ? (['newest'] as const) : [])]
  const [chosen, setChosen] = useState<Highlight>(owned ? 'owned' : 'none')
  const highlight = options.includes(chosen) ? chosen : options[0]

  const { highDots, restDots, xTicks, yTicks } = useMemo(() => {
    const isHigh = (card: Card) => (highlight === 'owned' ? !!owned?.(card) : highlight === 'newest' ? card.expansion === newest : false)
    const highDots: Dot[] = []
    const restDots: Dot[] = []
    for (const point of points) {
      ;(isHigh(point.card) ? highDots : restDots).push({ x: plotted(point.offers), y: plotted(point.wish), point })
    }
    return {
      highDots,
      restDots,
      xTicks: decadeTicks(points.map((p) => plotted(p.offers))),
      yTicks: decadeTicks(points.map((p) => plotted(p.wish))),
    }
  }, [points, owned, highlight, newest])
  const plain = highlight === 'none'
  const pickedDot = picked && (highDots.find((d) => d.point === picked) ?? restDots.find((d) => d.point === picked))

  // The average wishlists per offer (what demandScore shrinks toward), as the line wishlists = ratio × offers, plus
  // fainter lines at 2× and ½× it, splitting the map into hot / normal / cold bands. Each is clipped to the plot and
  // drawn in plotted (count + 1) space, so it is straight; that is off by under one count near 0.
  const ratio = averageDemandRatio()
  const [xMin, xMax] = [xTicks[0], xTicks[xTicks.length - 1]]
  const [yMin, yMax] = [yTicks[0], yTicks[yTicks.length - 1]]
  const guides = (
    [
      [1, undefined],
      [2, '2×'],
      [0.5, '½×'],
    ] as const
  ).flatMap(([k, label]): Guide[] => {
    const r = ratio * k
    const startX = Math.max(xMin, yMin / r)
    const endX = Math.min(xMax, yMax / r)
    return startX < endX
      ? [
          {
            label,
            dashed: k === 1,
            endsOnTop: endX < xMax,
            segment: [
              { x: startX, y: startX * r },
              { x: endX, y: endX * r },
            ],
          },
        ]
      : []
  })

  // a 2px-wide surface ring keeps overlapping dots apart; the transparent circle is a ~22px hit area for hover and click
  const dot = (fill: string, r: number) => (props: unknown) => {
    const { cx, cy, payload } = props as { cx?: number; cy?: number; payload?: Dot }
    if (cx === undefined || cy === undefined || !payload) {
      return <g />
    }
    return (
      <g className="cursor-pointer">
        <circle cx={cx} cy={cy} r={11} fill="transparent" />
        <circle cx={cx} cy={cy} r={r} fill={fill} stroke="var(--color-surface)" strokeWidth={1} />
      </g>
    )
  }

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
    setPicked(best?.point)
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
              {legendItems[0]} · {highDots.length.toLocaleString()}
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full opacity-60" style={{ backgroundColor: chartConfig.rest.theme.dark }} />
              {legendItems[1]} · {restDots.length.toLocaleString()}
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

      {/* biome-ignore lint/a11y/noStaticElementInteractions: touch-only nearest-dot picking; the Most wanted tab is the list view */}
      <div className="relative" onClick={coarse ? tap : undefined}>
        <ChartContainer
          config={chartConfig}
          className="aspect-square w-full sm:aspect-[16/9] [&_g]:outline-hidden"
          role="img"
          aria-label={`Scatter of ${points.length} cards, offers against wishlists on log scales. Cards above the dashed line are more wanted than average.`}
        >
          <ScatterChart margin={{ top: 8, right: 8, bottom: 20, left: 4 }}>
            <CartesianGrid stroke="#262626" strokeWidth={1} />
            <XAxis
              type="number"
              dataKey="x"
              scale="log"
              domain={[xMin, xMax]}
              ticks={xTicks}
              tickFormatter={(v: number) => formatCount(v - 1)}
              allowDataOverflow
              tickLine={false}
              axisLine={false}
              label={{ value: 'Offers (trade lists)', position: 'insideBottom', offset: -14, className: 'fill-neutral-400' }}
            />
            <YAxis
              type="number"
              dataKey="y"
              scale="log"
              domain={[yMin, yMax]}
              ticks={yTicks}
              tickFormatter={(v: number) => formatCount(v - 1)}
              allowDataOverflow
              tickLine={false}
              axisLine={false}
              width={44}
              label={{ value: 'Wishlists', angle: -90, position: 'insideLeft', offset: 10, className: 'fill-neutral-400' }}
            />
            {guides.map(({ label, dashed, segment }) => (
              <ReferenceLine
                key={label ?? 'average'}
                segment={segment}
                stroke={dashed ? '#a3a3a3' : '#525252'}
                strokeDasharray={dashed ? '4 4' : '1 3'}
                strokeWidth={1}
                ifOverflow="visible"
              />
            ))}
            {!coarse && <ChartTooltip content={tooltip} cursor={false} isAnimationActive={false} />}
            {/* highlighted last, so it draws on top of the context dots */}
            <Scatter
              data={restDots}
              shape={dot(plain ? 'var(--color-owned)' : 'var(--color-rest)', plain ? 3 : 2.5)}
              opacity={plain ? 0.85 : 0.6}
              onClick={coarse ? undefined : select}
              isAnimationActive={false}
            />
            {!plain && <Scatter data={highDots} shape={dot('var(--color-owned)', 3.5)} onClick={coarse ? undefined : select} isAnimationActive={false} />}
            <PlotOverlay guides={guides} picked={coarse ? pickedDot : undefined} scalesRef={scalesRef} />
          </ScatterChart>
        </ChartContainer>
        <span className="pointer-events-none absolute top-3 left-14 text-[11px] text-neutral-500">↖ more wanted than average</span>
        <span className="pointer-events-none absolute right-3 bottom-12 text-[11px] text-neutral-500">more offered than average ↘</span>
      </div>
      {coarse && (
        <div className="mt-2 min-h-[5.5rem] rounded-lg border border-neutral-800 bg-neutral-900 p-2 text-xs">
          {pickedDot ? (
            <div className="flex items-start gap-2">
              <CardDetails point={pickedDot.point} owned={owned} />
              <button
                type="button"
                className="shrink-0 rounded-md border border-neutral-700 px-2.5 py-1.5 text-neutral-200"
                onClick={() => onSelect(pickedDot.point.card)}
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
        Log scales, each count plotted as count + 1 so zeros sit on the axes. Cards with no listings at all are left out.{' '}
        {coarse ? 'Tap near a dot to pick the closest card.' : 'Click a dot to open the card.'} The Most wanted tab lists the same cards ranked.
      </p>
    </section>
  )
}
