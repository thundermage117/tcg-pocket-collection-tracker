// Personal fork: "how many packs until…" — the chance of at least one hit within n packs, 1 − (1 − p)^n, for every
// pack in the ranking. The best pick is the one coloured line; the rest are grey context behind it.
import { ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, type TooltipContentProps, XAxis, YAxis } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { type ChartConfig, ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { cn } from '@/lib/utils'
import type { PackRow, SortKey } from '../types'

// Only goals with a per-pack chance have a curve; "best average card" and the trainer share are properties of the pool
const curveGoals: Partial<Record<SortKey, string>> = {
  perPackNew: "a ☆☆ you're missing",
  perPackTop50: 'a top-50 ☆☆',
}

const FREE_PACKS_PER_DAY = 2 // two pack hourglass refills a day
const STEPS = 120
const TOOLTIP_ROWS = 5

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

function useOddsChart(packs: PackRow[], sortKey: SortKey, goal: string | undefined) {
  return useMemo(() => {
    const live = goal ? packs.filter((p) => p[sortKey] > 0) : []
    if (live.length === 0) {
      return undefined
    }
    const best = live[0]
    const p = best[sortKey]
    // the axis runs until the best pick is all but certain; slower packs flatten out below it
    const maxN = niceCeil(Math.max(packsFor(p, 0.95), 10))
    const ns = [...new Set(Array.from({ length: STEPS + 1 }, (_, i) => Math.round((i * maxN) / STEPS)))]
    const rows: Row[] = ns.map((n) => {
      const row: Row = { n } as Row
      for (const pack of live) {
        row[pack.id] = chanceWithin(pack[sortKey], n)
      }
      return row
    })
    return { live, best, maxN, rows, half: packsFor(p, 0.5), most: packsFor(p, 0.9) }
  }, [packs, sortKey, goal])
}

export function PackOdds({ packs, sortKey }: { packs: PackRow[]; sortKey: SortKey }) {
  const { t } = useTranslation('common/packs')
  const goal = curveGoals[sortKey]
  const chart = useOddsChart(packs, sortKey, goal)
  const [open, setOpen] = useState(false)

  if (!goal || !chart) {
    return null
  }
  const { best, half, most } = chart
  const name = (pack: PackRow) => t(pack.packName)

  return (
    <section className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 sm:p-4">
      {/* the sentence is the answer, so the chart behind it starts folded and the pack list sits higher */}
      <button type="button" aria-expanded={open} onClick={() => setOpen((x) => !x)} className="flex w-full cursor-pointer items-start gap-3 text-left">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-base sm:text-lg">How many packs until you get {goal}?</h2>
          <p className="mt-1 text-sm text-neutral-300">
            <span className="font-medium">{name(best)}</span>: a 50% chance within <span className="font-semibold tabular-nums">{half.toLocaleString()}</span>{' '}
            packs (≈ {days(half).toLocaleString()} days of free packs), 90% within <span className="font-semibold tabular-nums">{most.toLocaleString()}</span>.
          </p>
        </div>
        <span className="mt-0.5 flex shrink-0 items-center gap-1 text-xs text-neutral-400">
          {open ? 'Hide chart' : 'Chart'}
          <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
        </span>
      </button>
      {open && <PackOddsChart chart={chart} goal={goal} sortKey={sortKey} name={name} />}
    </section>
  )
}

function PackOddsChart({
  chart: { live, best, maxN, rows, half, most },
  goal,
  sortKey,
  name,
}: {
  chart: NonNullable<ReturnType<typeof useOddsChart>>
  goal: string
  sortKey: SortKey
  name: (pack: PackRow) => string
}) {
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
              <span className="font-medium text-neutral-100 tabular-nums">{pct(chanceWithin(pack[sortKey], n))}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <>
      <div className="mt-3 mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-400">
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
                y={chanceWithin(best[sortKey], n)}
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
        {sortKey === 'perPackNew' ? '; in practice they dip slightly after each new card you pull' : ''}. Days count two free packs a day.
      </p>
    </>
  )
}
