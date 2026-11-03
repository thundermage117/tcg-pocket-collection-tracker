// Personal fork: the rankings page's demand map — every card on a log–log scatter of offers (supply) against wishlists (demand).
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CartesianGrid, ReferenceLine, Scatter, ScatterChart, type TooltipContentProps, XAxis, YAxis } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { type ChartConfig, ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { getExpansionById } from '@/lib/CardsDB'
import { getLocalizedImagePath } from '@/lib/imageLocales'
import type { DemandPoint } from '@/lib/rankings'
import { getCardNameByLang } from '@/lib/utils'
import { averageDemandRatio } from '@/lib/ValueDB'
import type { Card } from '@/types'

// The app is dark-only, but both steps are given so the chart wrapper's theme scopes stay complete.
// Owned is the one categorical hue; the rest is context grey, also drawn smaller and underneath.
const chartConfig = {
  owned: { label: 'Owned', theme: { light: '#2a78d6', dark: '#3987e5' } },
  rest: { label: 'Not owned', theme: { light: '#a3a3a3', dark: '#737373' } },
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

interface Dot {
  x: number
  y: number
  point: DemandPoint
}

interface Props {
  points: DemandPoint[]
  owned?: (card: Card) => boolean // left out when ownership isn't shown: every dot is drawn the same
  onSelect: (card: Card) => void
}

export function DemandMap({ points, owned, onSelect }: Props) {
  const { t, i18n } = useTranslation('common/sets')

  const { ownedDots, restDots, xTicks, yTicks } = useMemo(() => {
    const ownedDots: Dot[] = []
    const restDots: Dot[] = []
    for (const point of points) {
      ;(owned?.(point.card) ? ownedDots : restDots).push({ x: plotted(point.offers), y: plotted(point.wish), point })
    }
    return {
      ownedDots,
      restDots,
      xTicks: decadeTicks(points.map((p) => plotted(p.offers))),
      yTicks: decadeTicks(points.map((p) => plotted(p.wish))),
    }
  }, [points, owned])

  // The average wishlists per offer (what demandScore shrinks toward), as the line wishlists = ratio × offers,
  // clipped to the plot. Drawn in plotted (count + 1) space, so it is straight; that is off by under one count near 0.
  const ratio = averageDemandRatio()
  const [xMin, xMax] = [xTicks[0], xTicks[xTicks.length - 1]]
  const [yMin, yMax] = [yTicks[0], yTicks[yTicks.length - 1]]
  const startX = Math.max(xMin, yMin / ratio)
  const endX = Math.min(xMax, yMax / ratio)
  const line =
    startX < endX
      ? ([
          { x: startX, y: startX * ratio },
          { x: endX, y: endX * ratio },
        ] as const)
      : undefined

  // a 2px-wide surface ring keeps overlapping dots apart; the transparent circle is a ~22px hit area for hover and tap
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

  const tooltip = ({ active, payload }: TooltipContentProps<ValueType, NameType>) => {
    const hovered = active ? (payload?.[0]?.payload as Dot | undefined)?.point : undefined
    if (!hovered) {
      return null
    }
    const { card } = hovered
    const name = getCardNameByLang(card, i18n.language)
    return (
      <div className="flex w-64 max-w-[75vw] gap-3 rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-xs shadow-xl">
        <img src={getLocalizedImagePath(card, i18n.language)} alt="" className="aspect-[367/512] w-14 shrink-0 rounded object-cover" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div>
            <div className="truncate font-medium text-neutral-100">{name}</div>
            <div className="truncate text-neutral-400">
              {t(getExpansionById(card.expansion).name)} · {card.card_id} · {card.rarity}
            </div>
          </div>
          <dl className="grid grid-cols-[1fr_auto] gap-x-2 text-neutral-400">
            <dt>Wishlists</dt>
            <dd className="text-right font-medium text-neutral-100 tabular-nums">{hovered.wish.toLocaleString()}</dd>
            <dt>Offers</dt>
            <dd className="text-right font-medium text-neutral-100 tabular-nums">{hovered.offers.toLocaleString()}</dd>
            <dt>Adj. demand</dt>
            <dd className="text-right font-medium text-neutral-100 tabular-nums">×{hovered.score.toFixed(2)}</dd>
          </dl>
          {owned && <div className="text-neutral-500">{owned(card) ? 'In your collection' : 'Not in your collection'}</div>}
        </div>
      </div>
    )
  }

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-400">
        {owned ? (
          <>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: chartConfig.owned.theme.dark }} />
              Owned · {ownedDots.length.toLocaleString()}
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full opacity-60" style={{ backgroundColor: chartConfig.rest.theme.dark }} />
              Not owned · {restDots.length.toLocaleString()}
            </span>
          </>
        ) : (
          <span>{points.length.toLocaleString()} cards</span>
        )}
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="w-4 border-t border-dashed border-neutral-400" />
          Average: {ratio.toFixed(2)} wishlists per offer
        </span>
      </div>

      <div className="relative">
        <ChartContainer
          config={chartConfig}
          className="aspect-square w-full sm:aspect-[16/9]"
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
            {line && <ReferenceLine segment={line} stroke="#a3a3a3" strokeDasharray="4 4" strokeWidth={1} ifOverflow="visible" />}
            <ChartTooltip content={tooltip} cursor={false} isAnimationActive={false} />
            {/* owned last, so it draws on top of the context dots */}
            <Scatter
              data={restDots}
              shape={dot(owned ? 'var(--color-rest)' : 'var(--color-owned)', owned ? 2.5 : 3)}
              opacity={owned ? 0.6 : 0.85}
              onClick={select}
              isAnimationActive={false}
            />
            {owned && <Scatter data={ownedDots} shape={dot('var(--color-owned)', 3.5)} onClick={select} isAnimationActive={false} />}
          </ScatterChart>
        </ChartContainer>
        <span className="pointer-events-none absolute top-3 left-14 text-[11px] text-neutral-500">↖ more wanted than average</span>
        <span className="pointer-events-none absolute right-3 bottom-12 text-[11px] text-neutral-500">more offered than average ↘</span>
      </div>
      <p className="mt-1 text-[11px] text-neutral-500">
        Log scales, each count plotted as count + 1 so zeros sit on the axes. Cards with no listings at all are left out. Tap or click a dot to open the card.
        The Most wanted tab lists the same cards ranked.
      </p>
    </section>
  )
}
