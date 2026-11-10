// Personal fork: the Unique cards ring split by rarity family, so it shows what the collection is made of, not only
// how far along it is. Each family's arc is its share of the cards in view; the bright part is what's owned.
import { useEffect, useState } from 'react'
import type { Card, Rarity } from '@/types'

// Validated for the neutral-800 tile (dataviz validate_palette.js, dark mode: band, chroma, CVD and contrast pass).
// Promos are "other", so a neutral grey rather than a fifth hue.
const families = [
  { key: '◊', label: '◊', color: '#3a86ec' },
  { key: '☆', label: '☆', color: '#b08d0c' },
  { key: '✵', label: '✵', color: '#c85fd0' },
  { key: 'Crown Rare', label: '♛', color: '#d9692b' },
  { key: 'P', label: 'Promo', color: '#8a8a8a' },
] as const

const familyOf = (r: Rarity) => families.find((f) => r.startsWith(f.key)) ?? families[families.length - 1]

function countByFamily(cards: Card[]) {
  const ids = new Map<string, Set<number>>()
  for (const c of cards) {
    const key = familyOf(c.rarity).key
    let set = ids.get(key)
    if (!set) {
      set = new Set()
      ids.set(key, set)
    }
    set.add(c.internal_id)
  }
  return (key: string) => ids.get(key)?.size ?? 0
}

interface Props {
  availableCards: Card[]
  collectedCards: Card[]
  className?: string
}

const size = 180
const stroke = 18
const radius = (size - stroke) / 2
const circumference = 2 * Math.PI * radius
const gap = 3 // along the circle, between families

// 0 → 1 over the first moment after mount (eased), so the ring grows and its number counts up once. Later changes
// (filters, the alt switch) use the arcs' CSS transition instead.
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

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

export function RarityRing({ availableCards, collectedCards, className }: Props) {
  const available = countByFamily(availableCards)
  const collected = countByFamily(collectedCards)
  const total = new Set(availableCards.map((c) => c.internal_id)).size
  const owned = new Set(collectedCards.map((c) => c.internal_id)).size
  const intro = useIntro()

  const shown = families.map((f) => ({ ...f, available: available(f.key), collected: collected(f.key) })).filter((f) => f.available > 0)
  const gapLen = shown.length > 1 ? gap : 0

  let start = 0
  const arcs = shown.map((f) => {
    const len = (f.available / total) * circumference
    const arc = { ...f, start, len: Math.max(0, len - gapLen), fill: Math.max(0, len - gapLen) * (f.collected / f.available) * intro }
    start += len
    return arc
  })

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${size} ${size}`} className={className} role="img" aria-label={`${owned} of ${total} unique cards`}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`} fill="none" strokeWidth={stroke}>
          {total === 0 && <circle cx={size / 2} cy={size / 2} r={radius} stroke="#404040" strokeWidth={stroke / 2} />}
          {arcs.map((a) => (
            <g key={a.key}>
              <title>{`${a.label}: ${a.collected} / ${a.available}`}</title>
              {/* the family's whole share, dim; then the owned part on top */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={a.color}
                strokeOpacity={0.22}
                strokeDasharray={`${a.len} ${circumference - a.len}`}
                strokeDashoffset={-a.start}
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={a.color}
                strokeDasharray={`${a.fill} ${circumference - a.fill}`}
                strokeDashoffset={-a.start}
                style={{ transition: intro < 1 ? undefined : 'stroke-dasharray 0.5s' }}
              />
            </g>
          ))}
        </g>
        <text x="50%" y="45%" textAnchor="middle" dominantBaseline="central" className="font-semibold text-4xl" fill="#FFFFFF">
          {Math.round(owned * intro)}
        </text>
        <text x="50%" y="63%" textAnchor="middle" dominantBaseline="central" className="font-semibold text-sm" fill="#A3A3A3">
          / {total}
        </text>
      </svg>
      {shown.length > 1 && (
        <ul
          className="mt-2 flex flex-wrap justify-center gap-x-2.5 gap-y-0.5 text-[11px] text-neutral-300 tabular-nums sm:mt-3 sm:text-xs"
          aria-label="By rarity"
        >
          {shown.map((f) => (
            <li key={f.key} className="flex items-center gap-1" title={`${f.label}: ${f.collected} / ${f.available}`}>
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: f.color }} />
              <span>{f.label}</span>
              <span className="text-neutral-500">
                {f.collected}/{f.available}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
