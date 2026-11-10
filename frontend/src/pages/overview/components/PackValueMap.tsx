// Personal fork: the completion heatmap's "Packs" view. Each set is a tray, each pack a tile inside it, sized by how many
// cards you're missing from its pool. A tile is a mosaic of value tiers, so a pack whose gaps are mostly pink and red
// (SSS, SS) stands out from one that's mostly grey. Laid out by hand (squarify.ts) as HTML, not SVG, so tiles get CSS
// gradients, the heatmap's foil and real buttons.
import { useEffect, useRef, useState } from 'react'
import { Tooltip } from 'react-tooltip'
import { SetLogo } from '@/components/CardThumb'
import { type Tier, tiers } from '@/lib/rankings'
import { packArtworkUrl } from '@/pages/overview/components/BestPackCard'
import { MissingThumbs, previewCount } from '@/pages/overview/components/MissingThumbs'
import type { PackChance } from '@/pages/overview/packChances'
import type { PackGap } from '@/pages/overview/packMap'
import { type Rect, squarify } from '@/pages/overview/squarify'
import type { Card, ExpansionId, Pack } from '@/types'
import './heatmap.css'

export interface MapSet {
  id: ExpansionId
  name: string
  packs: PackGap[]
}

interface Props {
  sets: MapSet[]
  chances: Map<ExpansionId, PackChance[]>
  best?: Pack // the overview's pick, ringed in its pack colour
  packName: (pack: Pack) => string
  onOpen: (expansion: ExpansionId, pack: Pack) => void
}

// cards nobody ranks (☆☆☆, Crown Rare) sit after E, as on the packs page
export const unrankedTier: Tier = { name: 'Unranked', color: '#525252' }
export const tierOf = (i: number) => tiers[i] ?? unrankedTier

const GAP = 3 // between trays
const RIM = 3 // a tray's rim around its packs
const SET_HEAD = 22 // a tray's header strip, when it's big enough to carry one
const PACK_HEAD = 18 // a pack's header strip, likewise
const CHAR_W = 6.4 // rough advance of an 11px glyph; only used to decide whether a label fits

const fits = (text: string, width: number) => text.length * CHAR_W + 8 <= width
const inset = ({ x, y, w, h }: Rect, d: number): Rect => ({ x: x + d, y: y + d, w: Math.max(0, w - 2 * d), h: Math.max(0, h - 2 * d) })
const box = ({ x, y, w, h }: Rect) => ({ left: x, top: y, width: w, height: h })
const formatChance = (pct: number) => `${pct.toFixed(1).replace(/\.0$/, '')}%`

// Tiles are laid out biggest first (squarest), so sort a copy and map rects back to the items
function layout<T>(items: T[], value: (item: T) => number, rect: Rect): { item: T; rect: Rect }[] {
  const sorted = items.filter((it) => value(it) > 0).toSorted((a, b) => value(b) - value(a))
  const rects = squarify(sorted.map(value), rect)
  return sorted.map((item, i) => ({ item, rect: rects[i] }))
}

function useSize() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) {
      return
    }
    const observer = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, size] as const
}

export function PackValueMap({ sets, chances, best, packName, onOpen }: Props) {
  const [ref, size] = useSize()
  const trays = layout(sets, (s) => s.packs.reduce((sum, p) => sum + p.missing, 0), { x: 0, y: 0, ...size })
  // nothing missing out of something in view: a pack with no cards under the filters isn't "complete"
  const inView = (set: MapSet, pack: Pack) => (chances.get(set.id)?.find((c) => c.pack === pack)?.available ?? 0) > 0
  const complete = sets.flatMap((s) => s.packs.filter((p) => p.missing === 0 && inView(s, p.pack)).map((p) => ({ set: s, pack: p.pack })))
  // the tooltip finds a block's cards by its data-gap key
  const gaps = new Map(sets.flatMap((s) => s.packs.flatMap((p) => p.byTier.map((t) => [`${s.id}|${p.pack.name}|${t.tier}`, t.cards] as [string, Card[]]))))

  const renderPack = (set: MapSet, gap: PackGap, rect: Rect, index: number) => {
    const { pack } = gap
    const chance = chances.get(set.id)?.find((c) => c.pack === pack)
    const name = packName(pack)
    const head = rect.h >= 56 && rect.w >= 64
    const body = inset({ x: 0, y: head ? PACK_HEAD : 0, w: rect.w, h: rect.h - (head ? PACK_HEAD : 0) }, 2)
    const artwork = rect.w >= 150 && rect.h >= 120 ? packArtworkUrl(pack) : undefined
    const isBest = pack === best
    return (
      <div
        key={pack.name}
        className="heat-in absolute overflow-hidden rounded-md bg-neutral-900"
        style={{
          ...box(rect),
          boxShadow: isBest ? `inset 0 0 0 1.5px ${pack.color}, 0 0 14px -2px ${pack.color}` : `inset 0 0 0 1px ${pack.color}66`,
          zIndex: isBest ? 1 : undefined,
          ['--in-delay' as string]: `${index * 0.03}s`,
        }}
      >
        {head && (
          <button
            type="button"
            className="absolute inset-x-0 top-0 flex items-center gap-1.5 px-1.5 text-left text-[11px] text-neutral-200 transition-colors hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
            style={{ height: PACK_HEAD + 2 }}
            onClick={() => onOpen(set.id, pack)}
            data-tooltip-id="pack-value-map"
            data-tooltip-content={`${set.name} · ${name}: ${gap.missing} missing${chance ? ` · ${formatChance(chance.pct)} chance of a new card` : ''}`}
            aria-label={`${name}: ${gap.missing} missing`}
          >
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: pack.color }} />
            <span className={`min-w-0 grow truncate ${isBest ? 'font-semibold' : ''}`}>{name}</span>
            {chance && rect.w >= 120 && <span className="shrink-0 text-neutral-400 tabular-nums">{formatChance(chance.pct)}</span>}
          </button>
        )}
        {layout(gap.byTier, (t) => t.cards.length, body)
          // keep the tier order on screen: SSS first, then down, whatever the layout's size order was
          .toSorted((a, b) => a.item.tier - b.item.tier)
          .map(({ item, rect: r }) => {
            const tier = tierOf(item.tier)
            const n = item.cards.length
            const full = `${tier === unrankedTier ? '–' : tier.name} ${n}`
            const label = r.h >= 15 ? (fits(full, r.w) ? full : fits(String(n), r.w) ? String(n) : '') : ''
            const foil = item.tier <= 1
            return (
              <button
                key={item.tier}
                type="button"
                className={`absolute flex items-start justify-start rounded-[3px] px-1 pt-0.5 font-semibold text-[11px] tabular-nums leading-tight transition-[filter] hover:brightness-115 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-white ${foil ? 'heat-foil' : ''}`}
                style={{
                  ...box(inset(r, 0.5)),
                  backgroundColor: tier.color,
                  // a soft top light, so blocks read as tiles rather than flat paint
                  backgroundImage: 'linear-gradient(180deg, rgb(255 255 255 / 0.22), rgb(255 255 255 / 0) 55%, rgb(0 0 0 / 0.12))',
                  color: tier === unrankedTier ? '#e5e5e5' : '#171717',
                  ['--foil-delay' as string]: `${(index + item.tier) * 0.15}s`,
                }}
                onClick={() => onOpen(set.id, pack)}
                data-tooltip-id="pack-value-map"
                data-tooltip-content={`${set.name} · ${name} — ${tier === unrankedTier ? 'unranked' : tier.name}: ${n} missing`}
                data-gap={`${set.id}|${pack.name}|${item.tier}`}
                aria-label={`${name}: ${n} ${tier === unrankedTier ? 'unranked' : tier.name} missing`}
              >
                {label}
              </button>
            )
          })}
        {artwork && (
          // the pack's Pokémon printed faintly over its mosaic, as on the overview's pick
          <img
            src={artwork}
            alt=""
            decoding="async"
            className="pointer-events-none absolute right-0 bottom-0 h-[78%] max-w-[70%] object-contain object-right-bottom opacity-35 mix-blend-luminosity"
          />
        )}
      </div>
    )
  }

  let packIndex = 0
  return (
    <div>
      <div ref={ref} className="relative h-[34rem] lg:h-[38rem]">
        {trays.map(({ item: set, rect }) => {
          const tray = inset(rect, GAP / 2)
          const missing = set.packs.reduce((sum, p) => sum + p.missing, 0)
          const head = tray.h >= 90 && tray.w >= 110
          const inner = inset({ x: 0, y: head ? SET_HEAD : 0, w: tray.w, h: tray.h - (head ? SET_HEAD : 0) }, RIM)
          return (
            <section
              key={set.id}
              className="absolute rounded-lg bg-neutral-950/70 ring-1 ring-neutral-700/70"
              style={box(tray)}
              aria-label={`${set.name}: ${missing} missing`}
            >
              {head && (
                <header className="flex items-center gap-1.5 overflow-hidden px-1.5 text-[11px] whitespace-nowrap" style={{ height: SET_HEAD + RIM }}>
                  <SetLogo expansionId={set.id} className="h-4 w-auto shrink-0" />
                  <span className="text-neutral-500 tabular-nums">{set.id}</span>
                  <span className="min-w-0 truncate text-neutral-200">{set.name}</span>
                  <span className="ml-auto shrink-0 text-neutral-500 tabular-nums">{missing}</span>
                </header>
              )}
              {layout(set.packs, (p) => p.missing, inner).map(({ item, rect: r }) => renderPack(set, item, inset(r, 1), packIndex++))}
            </section>
          )
        })}
        {size.w > 0 && trays.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center text-neutral-400 text-sm">No pack has a card you're missing.</p>
        )}
      </div>
      {complete.length > 0 && (
        <ul className="mt-3 flex flex-wrap items-center gap-1.5 text-xs" aria-label="Complete packs">
          <li className="mr-1 text-neutral-400">Complete:</li>
          {complete.map(({ set, pack }) => (
            <li
              key={`${set.id}|${pack.name}`}
              className="heat-foil relative flex items-center gap-1 rounded-full bg-neutral-700/60 px-2 py-0.5 text-neutral-200"
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: pack.color }} />
              <span className="text-neutral-500 tabular-nums">{set.id}</span>
              {packName(pack)} ✓
            </li>
          ))}
        </ul>
      )}
      <Tooltip
        id="pack-value-map"
        className="z-30"
        opacity={1}
        render={({ content, activeAnchor }) => {
          const cards = gaps.get(activeAnchor?.getAttribute('data-gap') ?? '') ?? []
          return (
            <div className={cards.length > 0 ? 'w-64' : undefined}>
              <p>{content}</p>
              {cards.length > 0 && <MissingThumbs cards={cards.slice(0, previewCount)} missing={cards.length} className="mt-1.5" />}
            </div>
          )
        }}
      />
    </div>
  )
}
