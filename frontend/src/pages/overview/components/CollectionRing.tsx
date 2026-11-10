// Personal fork: the Unique cards ring, with a thinner inner ring for the newest set (the progress checked most).
// Both follow the overview's filters.
import { useEffect, useState } from 'react'
import { latestExpansion } from '@/lib/altSupport'
import type { Card } from '@/types'

interface Props {
  availableCards: Card[]
  collectedCards: Card[]
  className?: string
}

const size = 180
const center = size / 2
const outer = { r: 81, stroke: 16, color: '#92C5FD' } // upstream's ring colour
const inner = { r: 62, stroke: 7, color: '#a78bfa' } // the unlock tile's violet: both are about the newest set
const track = '#404040'

const unique = (cards: Card[]) => new Set(cards.map((c) => c.internal_id)).size

// Never round a gap up to 100% or a single card down to 0% (same as the heatmap)
const formatPct = (have: number, total: number) => (have === total ? 100 : have > 0 ? Math.max(1, Math.min(99, Math.floor((100 * have) / total))) : 0)

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// 0 → 1 over the first moment after mount (eased), so the rings grow and the number counts up once. Later changes
// (filters, the alt switch) use the arcs' CSS transition instead.
function useIntro(duration = 800) {
  const [t, setT] = useState(() => (reduced() ? 1 : 0))
  useEffect(() => {
    if (reduced()) {
      return
    }
    const start = performance.now()
    let frame = requestAnimationFrame(function step(now) {
      const x = Math.min(1, (now - start) / duration)
      setT(1 - (1 - x) ** 3)
      if (x < 1) {
        frame = requestAnimationFrame(step)
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [])
  return t
}

function Arc({ r, stroke, color, value, animate }: { r: number; stroke: number; color: string; value: number; animate: boolean }) {
  const circumference = 2 * Math.PI * r
  return (
    <>
      <circle cx={center} cy={center} r={r} fill="none" stroke={track} strokeWidth={stroke / 2} />
      <circle
        cx={center}
        cy={center}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - value)}
        transform={`rotate(-90 ${center} ${center})`}
        style={{ transition: animate ? 'stroke-dashoffset 0.5s' : undefined }}
      />
    </>
  )
}

export function CollectionRing({ availableCards, collectedCards, className }: Props) {
  const intro = useIntro()
  const total = unique(availableCards)
  const owned = unique(collectedCards)
  const latestTotal = unique(availableCards.filter((c) => c.expansion === latestExpansion.id))
  const latestOwned = unique(collectedCards.filter((c) => c.expansion === latestExpansion.id))
  const showLatest = latestTotal > 0 // the filters can leave the newest set with nothing in view

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label={`${owned} of ${total} unique cards${showLatest ? `; ${latestExpansion.id}: ${latestOwned} of ${latestTotal}` : ''}`}
    >
      <Arc {...outer} value={total === 0 ? 0 : (owned / total) * intro} animate={intro === 1} />
      {showLatest && (
        <g>
          <title>{`Newest set, ${latestExpansion.id}: ${latestOwned} / ${latestTotal}`}</title>
          <Arc {...inner} value={(latestOwned / latestTotal) * intro} animate={intro === 1} />
        </g>
      )}
      <text x="50%" y={showLatest ? 76 : 82} textAnchor="middle" dominantBaseline="central" className="font-semibold text-3xl" fill="#FFFFFF">
        {Math.round(owned * intro)}
      </text>
      <text x="50%" y={showLatest ? 101 : 110} textAnchor="middle" dominantBaseline="central" className="font-semibold text-sm" fill="#A3A3A3">
        / {total}
      </text>
      {showLatest && (
        // the dot ties the label to the inner ring; the text itself stays in text colours
        <text x="50%" y={121} textAnchor="middle" dominantBaseline="central" className="font-semibold text-xs tabular-nums" fill="#D4D4D4">
          <tspan fill={inner.color}>●</tspan> {latestExpansion.id} {formatPct(latestOwned, latestTotal)}%
        </text>
      )}
    </svg>
  )
}
