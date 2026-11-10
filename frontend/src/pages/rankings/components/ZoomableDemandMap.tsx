// Personal fork: the demand map with real zoom. The dots go on a canvas, which redraws thousands in a few ms where the
// recharts SVG version takes ~350 ms; the grid, axes, guides, labels and rings are SVG on top.
// Gestures follow Google Maps' "cooperative" handling, so the chart never traps the page: one finger scrolls the page
// and taps a card, two fingers pinch and pan. On desktop ⌘/Ctrl + scroll zooms (trackpad pinch arrives as Ctrl + wheel),
// drag pans, shift-drag zooms to a box, and double-click zooms in.
import { type MouseEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMediaQuery } from 'react-responsive'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { getExpansionById } from '@/lib/CardsDB'
import type { DemandPoint } from '@/lib/rankings'
import { getCardNameByLang } from '@/lib/utils'
import { averageDemandRatio } from '@/lib/ValueDB'
import type { Card, ExpansionId } from '@/types'
import { activity, CardDetails, chartConfig, formatCount, type Highlight, logDomain, newestSet, ratioOf, TAP_RADIUS } from './DemandMap'

// canvas can't read the chart's CSS variables; the app is dark-only, so these are the dark steps
const COLORS = { high: chartConfig.owned.theme.dark, rest: chartConfig.rest.theme.dark, surface: chartConfig.surface.theme.dark }
const MARGIN = { top: 8, right: 8, bottom: 36, left: 48 }
const MAX_ZOOM = 40 // the narrowest view, as a fraction of the full span of each axis
const HOVER_RADIUS = 12 // px a mouse may miss a dot by
const LABEL_AREA = 6000 // card names are drawn once the view holds at most one dot per this many px² (~100 on desktop, ~13 on a phone)
const ZOOM_STEP = 1.6 // the + and − buttons

// The visible window, in log10 units of listings (x) and wishlists per offer (y)
interface View {
  x0: number
  x1: number
  y0: number
  y1: number
}

interface Mark {
  lx: number
  ly: number
  point: DemandPoint
  high: boolean
}

// Keeps a span between full / MAX_ZOOM and full, starting at `lo`, slid back inside [f0, f1]
const slide = (lo: number, span: number, f0: number, f1: number): [number, number] => {
  const s = Math.min(Math.max(span, (f1 - f0) / MAX_ZOOM), f1 - f0)
  const start = Math.min(Math.max(lo, f0), f1 - s)
  return [start, start + s]
}

// Scales [a0, a1] by 1 / factor around c, keeping c at the same place on screen
const zoomAxis = (a0: number, a1: number, factor: number, c: number, f0: number, f1: number) => {
  const s = Math.min(Math.max((a1 - a0) / factor, (f1 - f0) / MAX_ZOOM), f1 - f0)
  return slide(c - ((c - a0) / (a1 - a0)) * s, s, f0, f1)
}

// Ticks per decade, coarse to fine; the finest set that stays within `most` ticks wins, so they get finer as the view
// zooms in. Past a few tenths of a decade even 1…9 gives under three, so the ticks fall back to evenly stepped round numbers.
const tickSets = [[1], [1, 3], [1, 2, 5], [1, 1.5, 2, 3, 5, 7], [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9]]
const ticksFor = (lo: number, hi: number, most: number) => {
  const [min, max] = [10 ** lo, 10 ** hi]
  let best: number[] = []
  for (const steps of tickSets) {
    const ticks: number[] = []
    for (let k = Math.floor(lo); 10 ** k <= max; k++) {
      for (const m of steps) {
        const tick = Number((m * 10 ** k).toPrecision(2))
        if (tick >= min && tick <= max) {
          ticks.push(tick)
        }
      }
    }
    if (ticks.length > most) {
      break
    }
    best = ticks
  }
  if (best.length >= 3) {
    return best
  }
  const raw = (max - min) / 3
  const unit = 10 ** Math.floor(Math.log10(raw))
  const step = unit * (raw / unit >= 5 ? 5 : raw / unit >= 2 ? 2 : 1)
  const ticks: number[] = []
  for (let tick = Math.ceil(min / step) * step; tick <= max; tick += step) {
    ticks.push(Number(tick.toPrecision(6)))
  }
  return ticks
}

type Gesture =
  | { kind: 'press'; x: number; y: number; view: View; shift: boolean; touch: boolean; moved: boolean }
  | { kind: 'pinch'; view: View; d: number; mx: number; my: number }

interface Props {
  points: DemandPoint[]
  owned?: (card: Card) => boolean // left out when ownership isn't shown: every dot is drawn the same
  onSelect: (card: Card) => void
}

export function ZoomableDemandMap({ points, owned, onSelect }: Props) {
  const { t, i18n } = useTranslation('common/sets')
  // Touch: a tap picks the nearest dot and shows it below the chart, where "Open card" is a real button
  const coarse = useMediaQuery({ query: '(pointer: coarse)' })
  const chartRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(0)
  const [hovered, setHovered] = useState<Mark>()
  const [picked, setPicked] = useState<DemandPoint>()
  const [box, setBox] = useState<{ x0: number; y0: number; x1: number; y1: number }>()
  const [hint, setHint] = useState(false)
  const hintTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<Gesture>(undefined)

  useEffect(() => {
    const el = chartRef.current
    if (!el) {
      return
    }
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const height = width < 600 ? width : Math.round((width * 9) / 16)
  const pw = Math.max(width - MARGIN.left - MARGIN.right, 1)
  const ph = Math.max(height - MARGIN.top - MARGIN.bottom, 1)

  // The newest-set highlight only means something when the map holds it alongside other sets
  const newest: ExpansionId | undefined = useMemo(() => {
    const id = newestSet(points)
    return id && points.some((p) => p.card.expansion !== id) ? id : undefined
  }, [points])
  const options: Highlight[] = [owned ? 'owned' : 'none', ...(newest ? (['newest'] as const) : [])]
  const [chosen, setChosen] = useState<Highlight>(owned ? 'owned' : 'none')
  const highlight = options.includes(chosen) ? chosen : options[0]
  const plain = highlight === 'none'

  // the axes hug the data, as in the classic map; a new filter means a new full view, which drops any zoom
  const full: View = useMemo(() => {
    const [x0, x1] = logDomain(points.map(activity)).map(Math.log10)
    const [y0, y1] = logDomain(points.map(ratioOf)).map(Math.log10)
    return { x0, x1, y0, y1 }
  }, [points])
  // highlighted last, so they draw on top
  const marks = useMemo(() => {
    const isHigh = (card: Card) => (highlight === 'owned' ? !!owned?.(card) : highlight === 'newest' ? card.expansion === newest : false)
    const all = points.map((point) => ({ lx: Math.log10(activity(point)), ly: Math.log10(ratioOf(point)), point, high: isHigh(point.card) }))
    return [...all.filter((m) => !m.high), ...all.filter((m) => m.high)]
  }, [points, owned, highlight, newest])
  const highCount = marks.filter((m) => m.high).length

  const [zoom, setZoom] = useState<{ view: View; full: View }>()
  const view = zoom?.full === full ? zoom.view : full
  const update = (next: (v: View) => View) => setZoom((z) => ({ full, view: next(z?.full === full ? z.view : full) }))
  const zoomLevel = Math.max((full.x1 - full.x0) / (view.x1 - view.x0), (full.y1 - full.y0) / (view.y1 - view.y0))

  const sx = (lx: number, v = view) => MARGIN.left + ((lx - v.x0) / (v.x1 - v.x0)) * pw
  const sy = (ly: number, v = view) => MARGIN.top + (1 - (ly - v.y0) / (v.y1 - v.y0)) * ph
  const lxAt = (px: number, v: View) => v.x0 + ((px - MARGIN.left) / pw) * (v.x1 - v.x0)
  const lyAt = (py: number, v: View) => v.y0 + (1 - (py - MARGIN.top) / ph) * (v.y1 - v.y0)
  const inPlot = (x: number, y: number, pad = 0) => x >= MARGIN.left - pad && x <= MARGIN.left + pw + pad && y >= MARGIN.top - pad && y <= MARGIN.top + ph + pad

  const zoomAt = (v: View, factor: number, px: number, py: number): View => {
    const [x0, x1] = zoomAxis(v.x0, v.x1, factor, lxAt(px, v), full.x0, full.x1)
    const [y0, y1] = zoomAxis(v.y0, v.y1, factor, lyAt(py, v), full.y0, full.y1)
    return { x0, x1, y0, y1 }
  }
  const pan = (v: View, dx: number, dy: number): View => {
    const [x0, x1] = slide(v.x0 - (dx / pw) * (v.x1 - v.x0), v.x1 - v.x0, full.x0, full.x1)
    const [y0, y1] = slide(v.y0 + (dy / ph) * (v.y1 - v.y0), v.y1 - v.y0, full.y0, full.y1)
    return { x0, x1, y0, y1 }
  }
  // A window around [x0, x1] × [y0, y1] (log units), widened to the zoom limit if needed
  const fit = (x0: number, x1: number, y0: number, y1: number): View => {
    const axis = (a0: number, a1: number, f0: number, f1: number) => {
      const s = Math.max(a1 - a0, (f1 - f0) / MAX_ZOOM)
      return slide((a0 + a1) / 2 - s / 2, s, f0, f1)
    }
    const [vx0, vx1] = axis(x0, x1, full.x0, full.x1)
    const [vy0, vy1] = axis(y0, y1, full.y0, full.y1)
    return { x0: vx0, x1: vx1, y0: vy0, y1: vy1 }
  }

  // Nearest dot to a pixel within `radius`; a straight scan, since a few thousand distances take well under a millisecond
  const nearest = (px: number, py: number, radius: number) => {
    let best: Mark | undefined
    let bestDist = radius ** 2
    for (const m of marks) {
      const d = (sx(m.lx) - px) ** 2 + (sy(m.ly) - py) ** 2
      if (d <= bestDist) {
        best = m
        bestDist = d
      }
    }
    return best
  }

  // Redrawn on every render: a full pass over the dots is a few ms
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !width) {
      return
    }
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.save()
    ctx.beginPath()
    ctx.rect(MARGIN.left, MARGIN.top, pw, ph)
    ctx.clip()
    // a 1px surface ring keeps overlapping dots apart
    ctx.strokeStyle = COLORS.surface
    ctx.lineWidth = 1
    for (const m of marks) {
      const [x, y] = [sx(m.lx), sy(m.ly)]
      if (!inPlot(x, y, 5)) {
        continue
      }
      ctx.globalAlpha = plain ? 0.85 : m.high ? 1 : 0.6
      ctx.fillStyle = plain || m.high ? COLORS.high : COLORS.rest
      ctx.beginPath()
      ctx.arc(x, y, plain ? 3 : m.high ? 3.5 : 2.5, 0, 2 * Math.PI)
      ctx.fill()
      ctx.stroke()
    }
    ctx.restore()
  })

  const local = (e: { clientX: number; clientY: number }) => {
    const rect = chartRef.current?.getBoundingClientRect()
    return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) }
  }

  // Wheel and two-finger touch need non-passive listeners to stop the page scrolling, which React's onWheel can't give;
  // they read the latest render through a ref
  const onWheel = (e: WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) {
      // a plain scroll stays with the page; say how to zoom instead, like an embedded map
      setHint(true)
      clearTimeout(hintTimer.current)
      hintTimer.current = setTimeout(() => setHint(false), 1200)
      return
    }
    e.preventDefault()
    setHint(false)
    const p = local(e)
    // d3-zoom's wheel delta: trackpad pinches arrive as small Ctrl + wheel steps, hence the ×10
    const delta = -e.deltaY * (e.deltaMode === 1 ? 0.05 : e.deltaMode ? 1 : 0.002) * (e.ctrlKey ? 10 : 1)
    // at most ~1.4× a step, so a mouse wheel notch (deltaY ~100) doesn't leap
    update((v) => zoomAt(v, 2 ** Math.max(-0.5, Math.min(0.5, delta)), p.x, p.y))
  }
  const wheelRef = useRef(onWheel)
  wheelRef.current = onWheel
  useEffect(() => {
    const el = chartRef.current
    if (!el) {
      return
    }
    const wheel = (e: WheelEvent) => wheelRef.current(e)
    const touch = (e: TouchEvent) => e.touches.length > 1 && e.preventDefault()
    const gestureStart = (e: Event) => e.preventDefault() // Safari's own pinch-to-zoom-the-page
    el.addEventListener('wheel', wheel, { passive: false })
    el.addEventListener('touchmove', touch, { passive: false })
    el.addEventListener('gesturestart', gestureStart)
    return () => {
      el.removeEventListener('wheel', wheel)
      el.removeEventListener('touchmove', touch)
      el.removeEventListener('gesturestart', gestureStart)
      clearTimeout(hintTimer.current)
    }
  }, [])

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const p = local(e)
    pointers.current.set(e.pointerId, p)
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      gesture.current = { kind: 'pinch', view, d: Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }
      setBox(undefined)
      return
    }
    if (pointers.current.size > 2 || (e.pointerType === 'mouse' && e.button !== 0)) {
      return
    }
    gesture.current = { kind: 'press', x: p.x, y: p.y, view, shift: e.shiftKey, touch: e.pointerType !== 'mouse', moved: false }
    if (e.pointerType === 'mouse') {
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const p = local(e)
    if (pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, p)
    }
    const g = gesture.current
    if (g?.kind === 'pinch') {
      if (pointers.current.size >= 2) {
        const [a, b] = [...pointers.current.values()]
        const zoomed = zoomAt(g.view, Math.hypot(a.x - b.x, a.y - b.y) / g.d, g.mx, g.my)
        setZoom({ full, view: pan(zoomed, (a.x + b.x) / 2 - g.mx, (a.y + b.y) / 2 - g.my) })
      }
      return
    }
    if (g?.kind === 'press') {
      if (!g.moved && Math.hypot(p.x - g.x, p.y - g.y) < 5) {
        return
      }
      g.moved = true
      if (g.touch) {
        return // one finger belongs to the page
      }
      if (g.shift) {
        setBox({ x0: g.x, y0: g.y, x1: p.x, y1: p.y })
      } else {
        setHovered(undefined)
        setZoom({ full, view: pan(g.view, p.x - g.x, p.y - g.y) })
      }
      return
    }
    if (e.pointerType === 'mouse') {
      const m = inPlot(p.x, p.y) ? nearest(p.x, p.y, HOVER_RADIUS) : undefined
      setHovered((prev) => (prev?.point === m?.point ? prev : m))
    }
  }

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const p = local(e)
    pointers.current.delete(e.pointerId)
    const g = gesture.current
    if (g?.kind === 'pinch') {
      // the finger left behind doesn't start a new press
      if (pointers.current.size === 0) {
        gesture.current = undefined
      }
      return
    }
    gesture.current = undefined
    setBox(undefined)
    if (g?.kind !== 'press') {
      return
    }
    if (g.shift && g.moved) {
      if (Math.abs(p.x - g.x) > 8 && Math.abs(p.y - g.y) > 8) {
        const [ax, bx] = [lxAt(g.x, view), lxAt(p.x, view)]
        const [ay, by] = [lyAt(g.y, view), lyAt(p.y, view)]
        setZoom({ full, view: fit(Math.min(ax, bx), Math.max(ax, bx), Math.min(ay, by), Math.max(ay, by)) })
      }
      return
    }
    if (!g.moved) {
      const m = nearest(p.x, p.y, g.touch ? TAP_RADIUS : HOVER_RADIUS)
      if (g.touch) {
        setPicked(m?.point)
      } else if (m) {
        onSelect(m.point.card)
      }
    }
  }

  const onPointerCancel = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId)
    gesture.current = undefined
    setBox(undefined)
  }

  const onDoubleClick = (e: MouseEvent<HTMLDivElement>) => {
    const p = local(e)
    if (!coarse && inPlot(p.x, p.y)) {
      update((v) => zoomAt(v, 2, p.x, p.y))
    }
  }

  const fitHighlighted = () => {
    const high = marks.filter((m) => m.high)
    const [x0, x1] = [Math.min(...high.map((m) => m.lx)), Math.max(...high.map((m) => m.lx))]
    const [y0, y1] = [Math.min(...high.map((m) => m.ly)), Math.max(...high.map((m) => m.ly))]
    const [padX, padY] = [(x1 - x0) * 0.08 + 0.02, (y1 - y0) * 0.08 + 0.02]
    setZoom({ full, view: fit(x0 - padX, x1 + padX, y0 - padY, y1 + padY) })
  }

  // The average wishlists per offer (what demandScore shrinks toward), plus fainter lines at 2× and ½× it, splitting the
  // map into hot / normal / cold bands
  const ratio = averageDemandRatio()
  const guides = (
    [
      [1, undefined],
      [2, '2×'],
      [0.5, '½×'],
    ] as const
  ).flatMap(([k, label]) => {
    const y = sy(Math.log10(ratio * k))
    return inPlot(MARGIN.left, y) ? [{ label, dashed: k === 1, y }] : []
  })
  const xTicks = ticksFor(view.x0, view.x1, width < 600 ? 4 : 7)
  const yTicks = ticksFor(view.y0, view.y1, 6)

  // Card names once few enough dots are in view for the plot's size, highlighted first; a name that would overlap one already placed is
  // skipped. Width is estimated from the length, which is close enough at 10px.
  const visible = width ? marks.filter((m) => inPlot(sx(m.lx), sy(m.ly))) : []
  const labels: { x: number; y: number; end: boolean; name: string; key: string }[] = []
  const labelLimit = Math.round((pw * ph) / LABEL_AREA)
  if (visible.length <= labelLimit) {
    const placed: [number, number, number, number][] = []
    for (const m of [...visible].reverse()) {
      const name = getCardNameByLang(m.point.card, i18n.language)
      const [x, y] = [sx(m.lx), sy(m.ly)]
      const w = name.length * 5.6 + 2
      const end = x + 6 + w > MARGIN.left + pw
      const r: [number, number, number, number] = end ? [x - 6 - w, y - 6, x - 6, y + 6] : [x + 6, y - 6, x + 6 + w, y + 6]
      if (!placed.some((o) => r[0] < o[2] && r[2] > o[0] && r[1] < o[3] && r[3] > o[1])) {
        placed.push(r)
        labels.push({ x: end ? x - 6 : x + 6, y: y + 3, end, name, key: m.point.card.card_id })
      }
    }
  }

  const ring = coarse ? marks.find((m) => m.point === picked) : hovered
  const pickedPoint = picked && points.includes(picked) ? picked : undefined
  const tipLeft = hovered && sx(hovered.lx) > width - 290 ? sx(hovered.lx) - 268 : (hovered ? sx(hovered.lx) : 0) + 12
  const tipTop = hovered ? Math.min(Math.max(sy(hovered.ly) - 50, 0), height - 130) : 0

  const highlightLabel = (h: Highlight) => (h === 'owned' ? 'Owned' : h === 'newest' && newest ? `Newest set (${newest})` : 'None')
  const legendItems =
    highlight === 'owned'
      ? ['Owned', 'Not owned']
      : highlight === 'newest' && newest
        ? [`${t(getExpansionById(newest).name)} · few spares listed yet`, 'Other sets']
        : undefined
  const button = 'flex h-7 min-w-7 items-center justify-center rounded-md border border-neutral-700 bg-neutral-900/90 px-2 text-xs text-neutral-200'

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
      {options.length > 1 && (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
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
          {!plain && highCount > 0 && (
            <button type="button" className={button} onClick={fitHighlighted}>
              Zoom to {highlight === 'owned' ? 'owned' : newest}
            </button>
          )}
        </div>
      )}
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-400">
        {legendItems ? (
          <>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: COLORS.high }} />
              {legendItems[0]} · {highCount.toLocaleString()}
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full opacity-60" style={{ backgroundColor: COLORS.rest }} />
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

      {/* one finger keeps scrolling the page (pan-y); everything else is the chart's */}
      <div
        ref={chartRef}
        role="img"
        aria-label={`Scatter of ${points.length} cards, wishlists per offer against total listings on log scales. Cards above the dashed line are more wanted than average.`}
        className={`relative w-full select-none ${zoomLevel > 1.01 && !coarse ? 'cursor-grab active:cursor-grabbing' : ''} ${hovered ? 'cursor-pointer' : ''}`}
        style={{ height: height || undefined, touchAction: 'pan-y' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={() => setHovered(undefined)}
        onDoubleClick={onDoubleClick}
      >
        <canvas ref={canvasRef} className="absolute inset-0" style={{ width, height }} />
        {width > 0 && (
          <svg aria-hidden width={width} height={height} className="pointer-events-none absolute inset-0 text-[11px]">
            {xTicks.map((tick) => {
              const x = sx(Math.log10(tick))
              return (
                <g key={`x${tick}`}>
                  <line x1={x} x2={x} y1={MARGIN.top} y2={MARGIN.top + ph} stroke="#262626" />
                  <text x={x} y={MARGIN.top + ph + 14} textAnchor="middle" className="fill-neutral-500">
                    {formatCount(tick)}
                  </text>
                </g>
              )
            })}
            {yTicks.map((tick) => {
              const y = sy(Math.log10(tick))
              return (
                <g key={`y${tick}`}>
                  <line x1={MARGIN.left} x2={MARGIN.left + pw} y1={y} y2={y} stroke="#262626" />
                  <text x={MARGIN.left - 6} y={y + 4} textAnchor="end" className="fill-neutral-500">
                    {tick}
                  </text>
                </g>
              )
            })}
            <text x={MARGIN.left + pw / 2} y={height - 4} textAnchor="middle" className="fill-neutral-400 text-xs">
              Listings (wishlists + offers)
            </text>
            <text transform={`translate(12 ${MARGIN.top + ph / 2}) rotate(-90)`} textAnchor="middle" className="fill-neutral-400 text-xs">
              Wishlists per offer
            </text>
            {guides.map(({ label, dashed, y }) => (
              <g key={label ?? 'average'}>
                <line x1={MARGIN.left} x2={MARGIN.left + pw} y1={y} y2={y} stroke={dashed ? '#a3a3a3' : '#525252'} strokeDasharray={dashed ? '4 4' : '1 3'} />
                {label && (
                  <text x={MARGIN.left + pw - 4} y={y - 4} textAnchor="end" className="fill-neutral-400 text-[11px]">
                    {label}
                  </text>
                )}
              </g>
            ))}
            {labels.map((l) => (
              <text
                key={l.key}
                x={l.x}
                y={l.y}
                textAnchor={l.end ? 'end' : 'start'}
                className="fill-neutral-200 text-[10px]"
                stroke={COLORS.surface}
                strokeWidth={3}
                paintOrder="stroke"
              >
                {l.name}
              </text>
            ))}
            {ring && inPlot(sx(ring.lx), sy(ring.ly)) && <circle cx={sx(ring.lx)} cy={sy(ring.ly)} r={8} fill="none" stroke="#f5f5f5" strokeWidth={1.5} />}
            {box && (
              <rect
                x={Math.min(box.x0, box.x1)}
                y={Math.min(box.y0, box.y1)}
                width={Math.abs(box.x1 - box.x0)}
                height={Math.abs(box.y1 - box.y0)}
                fill="#3987e51a"
                stroke={COLORS.high}
                strokeDasharray="3 3"
              />
            )}
          </svg>
        )}
        {/* only at full view: zoomed in, the average line is often off screen and the corners hold dots */}
        {zoomLevel <= 1.01 && (
          <>
            <span className="pointer-events-none absolute text-xs text-neutral-400" style={{ top: MARGIN.top + 4, left: MARGIN.left + 6 }}>
              ↑ more wanted than average
            </span>
            <span className="pointer-events-none absolute text-xs text-neutral-400" style={{ top: MARGIN.top + ph - 18, left: MARGIN.left + 6 }}>
              ↓ more offered than average
            </span>
          </>
        )}
        {/* the controls stop their own pointer events, so a press on them is never a pan or a pick */}
        <div className="absolute flex items-center gap-1" style={{ top: MARGIN.top + 6, right: MARGIN.right + 6 }} onPointerDown={(e) => e.stopPropagation()}>
          {zoomLevel > 1.01 && <span className="mr-1 text-xs text-neutral-400 tabular-nums">{zoomLevel.toFixed(1)}×</span>}
          <button
            type="button"
            className={button}
            aria-label="Zoom in"
            onClick={() => update((v) => zoomAt(v, ZOOM_STEP, MARGIN.left + pw / 2, MARGIN.top + ph / 2))}
          >
            +
          </button>
          <button
            type="button"
            className={button}
            aria-label="Zoom out"
            disabled={zoomLevel <= 1.01}
            onClick={() => update((v) => zoomAt(v, 1 / ZOOM_STEP, MARGIN.left + pw / 2, MARGIN.top + ph / 2))}
          >
            −
          </button>
          {zoomLevel > 1.01 && (
            <button type="button" className={button} onClick={() => setZoom(undefined)}>
              Reset
            </button>
          )}
        </div>
        {hint && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded-md bg-neutral-950/85 px-3 py-1.5 text-sm text-neutral-200">Use ⌘ or Ctrl + scroll to zoom</span>
          </div>
        )}
        {hovered && !coarse && (
          <div
            className="pointer-events-none absolute flex w-64 max-w-[75vw] rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-xs shadow-xl"
            style={{ left: tipLeft, top: tipTop }}
          >
            <CardDetails point={hovered.point} owned={owned} />
          </div>
        )}
      </div>
      {coarse && (
        <div className="mt-2 min-h-[5.5rem] rounded-lg border border-neutral-800 bg-neutral-900 p-2 text-xs">
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
            <p className="py-6 text-center text-neutral-500">Tap near a dot to see the card. Pinch with two fingers to zoom.</p>
          )}
        </div>
      )}
      <p className="mt-1 text-xs text-neutral-400">
        {coarse
          ? 'Pinch with two fingers to zoom and drag with two to move; one finger scrolls the page. '
          : '⌘/Ctrl + scroll or pinch to zoom, drag to move, shift-drag to zoom to a box, double-click to zoom in. '}
        Names appear once you zoom in far enough ({labelLimit} or fewer cards in view). Log scales; height is (wishlists + 1) / (offers + 1). Cards with no
        listings at all are left out. {coarse ? 'Tap near a dot to pick the closest card.' : 'Click a dot to open the card.'} The Most wanted tab lists the same
        cards ranked.
      </p>
    </section>
  )
}
