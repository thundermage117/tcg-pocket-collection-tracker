// Personal fork: "how many packs until…" — the chance of at least one hit within n packs, 1 − (1 − p)^n, for every
// pack in the ranking. The best pick is the one coloured line; the rest are grey context behind it. A dashed vertical
// line marks when the best pick's pack points (5 a pack, kept per expansion) buy the cheapest wanted card outright,
// counting from the points you say you already have in that set.
import { ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, type TooltipContentProps, XAxis, YAxis } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { type ChartConfig, ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { Input } from '@/components/ui/input'
import { PACK_POINTS_PER_PACK, packPointCost } from '@/lib/tradeFairness'
import { cn } from '@/lib/utils'
import { describeTarget, type PackRow, type TargetFilters } from '../types'

const FREE_PACKS_PER_DAY = 2 // two pack hourglass refills a day
const STEPS = 120
const TOOLTIP_ROWS = 5
const MAX_PACK_POINTS = 2500 // the game caps each expansion's balance
const POINTS_KEY = 'packPointsBySet' // { [expansionId]: points }, this browser only

function loadPoints(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(POINTS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

const chartConfig = {
  best: { label: 'Best pick', theme: { light: '#2a78d6', dark: '#3987e5' } },
  rest: { label: 'Other packs', theme: { light: '#a3a3a3', dark: '#737373' } },
} satisfies ChartConfig

const chanceWithin = (p: number, n: number) => 1 - (1 - p) ** n
// Packs needed for a `target` chance of at least one hit
const packsFor = (p: number, target: number) => Math.ceil(Math.log(1 - target) / Math.log(1 - p))
const pct = (x: number) => `${x >= 0.995 && x < 1 ? '>99' : Math.round(100 * x)}%`
const days = (n: number) => Math.max(1, Math.round(n / FREE_PACKS_PER_DAY))

// Rounds the x-axis end up to 1, 2, 2.5 or 5 × 10^k, so the ticks land on round pack counts
function niceCeil(x: number) {
  const magnitude = 10 ** Math.floor(Math.log10(x))
  return ([1, 2, 2.5, 5, 10].find((m) => m * magnitude >= x) ?? 10) * magnitude
}

type Row = { n: number } & Record<string, number>

export function PackOdds({ packs, filters }: { packs: PackRow[]; filters: TargetFilters }) {
  const { t } = useTranslation('common/packs')
  const goal = describeTarget(filters)
  const [pointsBySet, setPointsBySet] = useState(loadPoints)
  const [chartOpen, setChartOpen] = useState(false)
  const bestSet = packs.find((p) => p.perPack > 0)?.expansionId
  const have = (bestSet && pointsBySet[bestSet]) || 0

  const setHave = (value: string) => {
    if (!bestSet) {
      return
    }
    const points = Math.min(MAX_PACK_POINTS, Math.max(0, Math.floor(Number(value) || 0)))
    const next = { ...pointsBySet, [bestSet]: points }
    setPointsBySet(next)
    try {
      localStorage.setItem(POINTS_KEY, JSON.stringify(next))
    } catch {
      // storage blocked: the value still holds for this visit
    }
  }

  const chart = useMemo(() => {
    const live = packs.filter((p) => p.perPack > 0)
    if (live.length === 0) {
      return undefined
    }
    const best = live[0]
    const p = best.perPack
    // packs of the best pick's set until its pack points, on top of `have`, buy the cheapest wanted card; undefined if none has a price
    const costs = best.wanted.map((c) => packPointCost[c.rarity]).filter((c) => c !== undefined)
    const cost = costs.length > 0 ? Math.min(...costs) : undefined
    const exchange = cost === undefined ? undefined : Math.ceil(Math.max(0, cost - have) / PACK_POINTS_PER_PACK)
    // the axis runs until the best pick is all but certain, or to the pack points line if that comes later
    const maxN = niceCeil(Math.max(packsFor(p, 0.95), 10, exchange ?? 0))
    const ns = [...new Set(Array.from({ length: STEPS + 1 }, (_, i) => Math.round((i * maxN) / STEPS)))]
    const rows: Row[] = ns.map((n) => {
      const row: Row = { n } as Row
      for (const pack of live) {
        row[pack.id] = chanceWithin(pack.perPack, n)
      }
      return row
    })
    return { live, best, maxN, rows, half: packsFor(p, 0.5), most: packsFor(p, 0.9), cost, exchange }
  }, [packs, have])

  // a pull nearly every pack (◊ you're missing, say) is a flat line at 100%: nothing to chart
  if (!chart || chart.most <= 2) {
    return null
  }
  const { live, best, maxN, rows, half, most, cost, exchange } = chart
  const setName = t(best.expansionName, { ns: 'common/sets' })
  const name = (pack: PackRow) => t(pack.packName)
  const rest = live.slice(1)

  const tooltip = ({ active, label }: TooltipContentProps<ValueType, NameType>) => {
    const n = Number(label)
    if (!active || Number.isNaN(n)) {
      return null
    }
    return (
      <div className="w-60 rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-xs shadow-xl">
        <div className="font-medium text-neutral-100">After {n.toLocaleString()} packs</div>
        <div className="mb-1.5 text-neutral-400">
          ≈ {days(n).toLocaleString()} {days(n) === 1 ? 'day' : 'days'} of free packs
        </div>
        <ul className="flex flex-col gap-0.5">
          {live.slice(0, TOOLTIP_ROWS).map((pack) => (
            <li key={pack.id} className="flex items-center gap-2">
              <span aria-hidden className="w-3 shrink-0 border-t-2" style={{ borderColor: pack === best ? 'var(--color-best)' : 'var(--color-rest)' }} />
              <span className="min-w-0 flex-1 truncate text-neutral-300">
                {name(pack)} <span className="text-neutral-400">{pack.expansionId}</span>
              </span>
              <span className="font-medium text-neutral-100 tabular-nums">{pct(chanceWithin(pack.perPack, n))}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <section className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 sm:p-4">
      <h2 className="font-semibold text-base sm:text-lg">How many packs until you get {goal}?</h2>
      <p className="mt-1 text-sm text-neutral-300">
        <span className="font-medium">{name(best)}</span>: a 50% chance within <span className="font-semibold tabular-nums">{half.toLocaleString()}</span> packs
        (≈ {days(half).toLocaleString()} {days(half) === 1 ? 'day' : 'days'} of free packs), 90% within{' '}
        <span className="font-semibold tabular-nums">{most.toLocaleString()}</span>.
        {exchange !== undefined &&
          (exchange === 0 ? (
            <> You already have the {cost?.toLocaleString()} pack points to exchange for one.</>
          ) : (
            <>
              {' '}
              Pack points make it certain at <span className="font-semibold tabular-nums">{exchange.toLocaleString()}</span> packs (≈{' '}
              {days(exchange).toLocaleString()} {days(exchange) === 1 ? 'day' : 'days'}).
            </>
          ))}
      </p>
      {cost !== undefined && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-300">
          <Input
            aria-label={`Pack points you have in ${setName}`}
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_PACK_POINTS}
            step={5}
            value={have || ''}
            placeholder="Pack points"
            onChange={(e) => setHave(e.target.value)}
            className="h-8 w-32 tabular-nums"
          />
        </div>
      )}
      {/* the sentence is the answer, so the chart behind it starts folded and the pack list sits higher */}
      <button
        type="button"
        aria-expanded={chartOpen}
        onClick={() => setChartOpen((x) => !x)}
        className="mt-2 flex cursor-pointer items-center gap-1 text-neutral-400 text-sm hover:text-white"
      >
        {chartOpen ? 'Hide chart' : 'Show chart'}
        <ChevronDown className={cn('size-4 transition-transform', chartOpen && 'rotate-180')} />
      </button>
      {chartOpen && (
        <>
          <div className="mt-2 mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-400">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="w-4 border-t-2" style={{ borderColor: chartConfig.best.theme.dark }} />
              Best pick: {name(best)}
            </span>
            {rest.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="w-4 border-t opacity-70" style={{ borderColor: chartConfig.rest.theme.dark }} />
                Other packs · {rest.length}
              </span>
            )}
            {exchange !== undefined && (
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="h-3 border-l border-dashed border-amber-400" />
                Pack points exchange
              </span>
            )}
          </div>

          <ChartContainer
            config={chartConfig}
            className="aspect-[4/3] w-full sm:aspect-[21/9] [&_g]:outline-hidden"
            role="img"
            aria-label={`Chance of ${goal} against packs opened, for ${live.length} packs. ${name(best)} reaches 50% after ${half} packs and 90% after ${most}.`}
          >
            <LineChart data={rows} margin={{ top: 12, right: 12, bottom: 20, left: 4 }}>
              <CartesianGrid stroke="#262626" strokeWidth={1} vertical={false} />
              <XAxis
                type="number"
                dataKey="n"
                domain={[0, maxN]}
                tickCount={6}
                allowDecimals={false}
                tickLine={false}
                axisLine={{ stroke: '#383835' }}
                label={{ value: 'Packs opened', position: 'insideBottom', offset: -14, className: 'fill-neutral-400' }}
              />
              <YAxis
                domain={[0, 1]}
                ticks={[0, 0.25, 0.5, 0.75, 1]}
                tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <ReferenceLine y={0.5} stroke="#737373" strokeDasharray="4 4" strokeWidth={1} />
              {exchange !== undefined && (
                <ReferenceLine
                  x={exchange}
                  stroke="#fbbf24"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: exchange === 0 ? `${cost?.toLocaleString()} pts · now` : `${cost?.toLocaleString()} pts · ${exchange} packs`,
                    position: exchange > 0.7 * maxN ? 'insideTopRight' : 'insideTopLeft',
                    offset: 6,
                    className: 'fill-amber-400 text-[11px]',
                  }}
                />
              )}
              <ChartTooltip content={tooltip} cursor={{ stroke: '#737373', strokeWidth: 1 }} isAnimationActive={false} />
              {/* grey context first, the best pick last so it draws on top */}
              {rest.map((pack) => (
                <Line
                  key={pack.id}
                  dataKey={pack.id}
                  type="monotone"
                  stroke="var(--color-rest)"
                  strokeOpacity={0.45}
                  strokeWidth={1}
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
              ))}
              <Line
                dataKey={best.id}
                type="monotone"
                stroke="var(--color-best)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: 'var(--color-best)', fill: '#1a1a1a', strokeWidth: 2 }}
                isAnimationActive={false}
              />
              {[
                [half, 0.5],
                [most, 0.9],
              ].map(([n, target]) =>
                n <= maxN ? (
                  <ReferenceDot
                    key={target}
                    x={n}
                    y={chanceWithin(best.perPack, n)}
                    r={4}
                    fill="var(--color-best)"
                    stroke="#1a1a1a"
                    strokeWidth={2}
                    // 50% sits right of its dot, clear of the y-axis's 50% tick; 90% left, clear of the flattening curve
                    label={{
                      value: `${Math.round(target * 100)}% · ${n}`,
                      position: target === 0.5 ? 'right' : 'left',
                      offset: 8,
                      className: 'fill-neutral-300 text-[11px]',
                    }}
                  />
                ) : null,
              )}
            </LineChart>
          </ChartContainer>
          <p className="mt-1 text-xs text-neutral-400">
            Chance of at least one {goal.replace(/^an? /, '')} within that many packs, from each pack's real pull odds. It assumes the odds stay put
            {filters.onlyMissing ? '; in practice they dip slightly after each new card you pull' : ''}. Days count two free packs a day. The pack points line
            counts from the points you entered for {setName}: every pack earns 5, points stay with their expansion (capped at 2,500), and the cheapest wanted
            card costs {cost?.toLocaleString() ?? '–'}.
          </p>
        </>
      )}
    </section>
  )
}
