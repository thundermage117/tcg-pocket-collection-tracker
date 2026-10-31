// Personal fork: trade check result: verdict, both scores on one scale, reasons and context lines.
import { AlertTriangle, Info } from 'lucide-react'
import { type CardScore, ELO_WEIGHT, FAIR_BAND, THIN_FAIR_BAND, type Verdict, type VerdictKind } from '@/lib/tradeFairness'
import { cn } from '@/lib/utils'

export interface ContextLine {
  text: string
  warn?: boolean
}

const tone: Record<VerdictKind, string> = {
  fair: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  steal: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  overpay: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  unknown: 'border-neutral-700 bg-neutral-800/60 text-neutral-300',
}

const eloShare = Math.round(ELO_WEIGHT * 100)

const markerTone: Record<'give' | 'get', string> = { give: 'bg-amber-400', get: 'bg-violet-400' }

function ScoreScale({ give, get }: { give: CardScore; get: CardScore }) {
  const markers = [
    { side: 'give' as const, label: 'You give', score: give.score },
    { side: 'get' as const, label: 'You get', score: get.score },
  ]
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm">
        {markers.map((m) => (
          <span key={m.side} className="flex items-center gap-1.5 text-neutral-300">
            <span className={cn('size-2.5 rounded-full', markerTone[m.side])} />
            {m.label} <span className="font-semibold tabular-nums text-white">{m.score !== undefined ? Math.round(m.score) : '–'}</span>
          </span>
        ))}
      </div>
      <div className="relative h-2 rounded-full bg-neutral-800">
        {markers.map(
          (m) =>
            m.score !== undefined && (
              <span
                key={m.side}
                title={`${m.label}: ${Math.round(m.score)}`}
                className={cn('absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-neutral-900', markerTone[m.side])}
                style={{ left: `${m.score}%` }}
              />
            ),
        )}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-neutral-500">
        <span>0 least valued</span>
        <span>100 most valued</span>
      </div>
    </div>
  )
}

interface Props {
  verdict: Verdict
  give: CardScore
  get: CardScore
  context: ContextLine[]
}

export function TradeVerdict({ verdict, give, get, context }: Props) {
  return (
    <section className={cn('rounded-xl border p-4', tone[verdict.kind])}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-2xl font-semibold">{verdict.headline}</h2>
        {verdict.gap !== undefined && (
          <span className="text-sm text-neutral-300 tabular-nums">
            {verdict.gap >= 0 ? '+' : '−'}
            {Math.abs(Math.round(verdict.gap))} points for you
          </span>
        )}
      </div>
      {verdict.kind !== 'unknown' && <ScoreScale give={give} get={get} />}
      <ul className="mt-4 flex flex-col gap-1.5 text-sm text-neutral-200">
        {verdict.reasons.map((r) => (
          <li key={r} className="flex gap-2">
            <span className="text-neutral-500">•</span>
            {r}
          </li>
        ))}
      </ul>
      {context.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5 border-t border-white/10 pt-3 text-sm text-neutral-300">
          {context.map((line) => (
            <li key={line.text} className="flex gap-2">
              {line.warn ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" /> : <Info className="mt-0.5 size-4 shrink-0 text-neutral-500" />}
              {line.text}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-neutral-500">
        {`Score = percentile among all tradable cards of this rarity (☆☆: ${eloShare}% vote Elo, ${100 - eloShare}% demand; others: demand). `}
        {`Within ${FAIR_BAND} points is fair (${THIN_FAIR_BAND} when data is thin).`}
      </p>
    </section>
  )
}
