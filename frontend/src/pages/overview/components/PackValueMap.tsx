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
import type { PackGap, TierGap } from '@/pages/overview/packMap'
import { type Rect, squarify } from '@/pages/overview/squarify'
import type { ValueOption } from '@/pages/overview/valueTiers'
import { gives, newPerPack, oneIn, packOdds } from '@/pages/packs/types'
import type { Card, ExpansionId, Pack, Rarity } from '@/types'
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
  focusTier?: number // the key's highlighted tier: other tiers' blocks fade back
  fadeLow: boolean // Value shows every card: D, E and unranked blocks step back so the top tiers carry the map
  sizeBy: 'missing' | 'odds' // cards missing, or how many of them one pack gives on average (rare tiers shrink to their pull odds)
  value: ValueOption // the overview's filters, for the hover text's "an S+ ☆☆ you're missing"
  rarity: Rarity[]
  packName: (pack: Pack) => string
  onOpen: (expansion: ExpansionId, pack: Pack) => void // a pack's missing cards
  onOpenTier: (expansion: ExpansionId, tier: number) => void // a set's missing cards of one tier
}

// cards nobody ranks (☆☆☆, Crown Rare) sit after E, as on the packs page
export const unrankedTier: Tier = { name: 'Unranked', color: '#525252' }
export const tierOf = (i: number) => tiers[i] ?? unrankedTier

const LOW_TIER = 6 // D: it and everything below fade back under fadeLow
const GAP = 3 // between trays
const RIM = 3 // a tray's rim around its packs
const SET_HEAD = 22 // a tray's header strip, when it's big enough to carry one
const PACK_HEAD = 18 // a pack's header strip, likewise
const CHAR_W = 6.4 // rough advance of an 11px glyph; only used to decide whether a label fits

const fits = (text: string, width: number) => text.length * CHAR_W + 8 <= width
const inset = ({ x, y, w, h }: Rect, d: number): Rect => ({ x: x + d, y: y + d, w: Math.max(0, w - 2 * d), h: Math.max(0, h - 2 * d) })
const box = ({ x, y, w, h }: Rect) => ({ left: x, top: y, width: w, height: h })
// A block's odds, longest that fits first: "1 in 50" (one in every 50 packs gives one), "1/50"; "1.4" at one or more
const blockOdds = (odds: number) => (odds >= 0.95 ? [odds.toFixed(1)] : odds > 0 ? [`1 in ${Math.round(1 / odds)}`, `1/${Math.round(1 / odds)}`] : ['0'])
// A pack header's: "1.4 new/pack", or "1 new/4 packs" below one, never a "0.0"
const headerOdds = (odds: number) => (odds >= 0.95 ? `${odds.toFixed(1)} new/pack` : odds > 0 ? `1 new/${Math.round(1 / odds)} packs` : 'none')

// The next tier cut above the Value filter, for "12 of your 40 missing cards are A+"
const nextCut: Record<ValueOption, { name: string; maxTier: number }> = {
  all: { name: 'A+', maxTier: 3 },
  top: { name: 'S+', maxTier: 2 },
  hot: { name: 'SSS', maxTier: 0 },
}

/** The packs page's sentences (pages/packs/types.ts), worded for the overview's filters: "1 in 3 packs gives an S+ ☆☆ you're missing". */
function sentences(value: ValueOption, rarity: Rarity[]) {
  const quality = value === 'hot' ? 'S+' : value === 'top' ? 'A+' : ''
  const one = rarity.length === 1 ? rarity[0] : 'card'
  const many = [quality, rarity.length === 1 ? rarity[0] : 'cards'].filter(Boolean).join(' ')
  const target = `${quality ? 'an' : 'a'} ${[quality, one].filter(Boolean).join(' ')} you're missing`
  const are = (n: number) => (n === 1 ? 'is' : 'are')
  return {
    /** "1 in 3 packs gives an S+ card you're missing" (p: chance of at least one) */
    chance: (p: number) => (p > 0 ? `${packOdds(p)} ${gives(p)} ${target}` : `No pack gives ${target}`),
    /** "12 of your 40 missing cards are A+" */
    quality: (gap: PackGap) => {
      const cut = nextCut[value]
      const n = gap.byTier.filter((t) => t.tier <= cut.maxTier).reduce((sum, t) => sum + t.cards.length, 0)
      return `${n === 0 ? 'None' : n} of your ${gap.missing} missing ${many} ${are(n)} ${cut.name}`
    },
    /** "4 of your 25 missing S+ cards are SS" */
    tier: (n: number, gap: PackGap, tier: number) =>
      `${n} of your ${gap.missing} missing ${many} ${are(n)} ${tier < tiers.length ? tiers[tier].name : 'unranked (nobody trades them)'}`,
    /** "1 in 27 packs gives one", "≈1.4 of them per pack" (odds: expected count) */
    tierOdds: (odds: number) => (odds >= 0.5 ? `≈${odds.toFixed(1)} of them per pack opened` : `${oneIn(odds)} packs gives one`),
    /** "≈1.8 new cards per pack", "1 new card every 6 packs" */
    perPack: (odds: number) => {
      const { stat, caption } = newPerPack(odds)
      return `${stat} ${caption}`
    },
  }
}

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

export function PackValueMap({ sets, chances, best, focusTier, fadeLow, sizeBy, value, rarity, packName, onOpen, onOpenTier }: Props) {
  const packSize = (p: PackGap) => (sizeBy === 'odds' ? p.odds : p.missing)
  const tierSize = (t: TierGap) => (sizeBy === 'odds' ? t.odds : t.cards.length)
  const say = sentences(value, rarity)
  const [ref, size] = useSize()
  // Tiles glide to their new place when the filters change, but only once the first layout is down: before the box is
  // measured every rect is empty, and growing them all out of the corner on first paint would just be noise
  const [moving, setMoving] = useState(false)
  useEffect(() => {
    if (size.w > 0 && !moving) {
      const frame = requestAnimationFrame(() => setMoving(true))
      return () => cancelAnimationFrame(frame)
    }
  }, [size.w, moving])
  const trays = layout(sets, (s) => s.packs.reduce((sum, p) => sum + packSize(p), 0), { x: 0, y: 0, ...size })
  // nothing missing out of something in view: a pack with no cards under the filters isn't "complete"
  const inView = (set: MapSet, pack: Pack) => (chances.get(set.id)?.find((c) => c.pack === pack)?.available ?? 0) > 0
  const complete = sets.flatMap((s) => s.packs.filter((p) => p.missing === 0 && inView(s, p.pack)).map((p) => ({ set: s, pack: p.pack })))
  // Hover text by data-tip key: a pack ("A4|hoohpack") or one of its tier blocks ("A4|hoohpack|1"), in the packs page's words
  const tips = new Map<string, { title: string; lines: string[]; cards?: Card[] }>()
  for (const s of sets) {
    for (const gap of s.packs) {
      const chance = chances.get(s.id)?.find((c) => c.pack === gap.pack)
      const title = `${packName(gap.pack)} · ${s.name}`
      const perPack = gap.odds > 0 ? [say.perPack(gap.odds)] : []
      tips.set(`${s.id}|${gap.pack.name}`, { title, lines: [say.chance((chance?.pct ?? 0) / 100), say.quality(gap), ...perPack] })
      for (const t of gap.byTier) {
        const odds = t.odds > 0 ? [say.tierOdds(t.odds)] : []
        tips.set(`${s.id}|${gap.pack.name}|${t.tier}`, { title, lines: [say.tier(t.cards.length, gap, t.tier), ...odds], cards: t.cards })
      }
    }
  }

  const renderPack = (set: MapSet, gap: PackGap, rect: Rect, index: number) => {
    const { pack } = gap
    const chance = chances.get(set.id)?.find((c) => c.pack === pack)
    const packTitle = packName(pack)
    const head = rect.h >= 56 && rect.w >= 64
    // a big tile says in words what its size means: what's left in it, or what opening it gives
    const caption = rect.w >= 200 && rect.h >= 130 ? (sizeBy === 'odds' ? say.chance((chance?.pct ?? 0) / 100) : say.quality(gap)) : undefined
    const body = inset({ x: 0, y: head ? PACK_HEAD : 0, w: rect.w, h: rect.h - (head ? PACK_HEAD : 0) }, 2)
    const artwork = rect.w >= 150 && rect.h >= 120 ? packArtworkUrl(pack) : undefined
    const isBest = pack === best
    // with a tier picked out, a pack without any of it steps back as a whole
    const lacksFocus = focusTier !== undefined && !gap.byTier.some((t) => t.tier === focusTier)
    return (
      <div
        key={pack.name}
        className={`heat-in pm-move absolute overflow-hidden rounded-md bg-neutral-900 ${lacksFocus ? 'opacity-40' : ''}`}
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
            data-tip={`${set.id}|${pack.name}`}
            aria-label={`${packTitle}: ${gap.missing} missing`}
          >
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: pack.color }} />
            <span className={`min-w-0 grow truncate ${isBest ? 'font-semibold' : ''}`}>{packTitle}</span>
            {/* what sizes the tile, so the two modes read differently at a glance */}
            {/* the words only where they leave the pack's name room: "139 left" / "1 new/4 packs", else "139" / "1/4" */}
            {rect.w >= 100 && (
              <span className="shrink-0 text-neutral-400 tabular-nums">
                {sizeBy === 'odds' ? (rect.w >= 160 ? headerOdds(gap.odds) : blockOdds(gap.odds).at(-1)) : rect.w >= 160 ? `${gap.missing} left` : gap.missing}
              </span>
            )}
          </button>
        )}
        {layout(gap.byTier, tierSize, body)
          // keep the tier order on screen: SSS first, then down, whatever the layout's size order was
          .toSorted((a, b) => a.item.tier - b.item.tier)
          .map(({ item, rect: r }) => {
            const tier = tierOf(item.tier)
            const n = item.cards.length
            // the number is what sizes the block: cards missing, or how often a pack gives one
            const values = sizeBy === 'odds' ? blockOdds(item.odds) : [String(n)]
            const name = tier === unrankedTier ? '–' : tier.name
            const label = r.h >= 15 ? ([...values.map((v) => `${name} ${v}`), ...values].find((text) => fits(text, r.w)) ?? '') : ''
            const foil = item.tier <= 1
            const dimmed = focusTier !== undefined && item.tier !== focusTier
            // a picked-out tier wins over the low-tier fade, so highlighting E still shows E at full strength
            const faded = !dimmed && focusTier === undefined && fadeLow && item.tier >= LOW_TIER
            return (
              <button
                key={item.tier}
                type="button"
                className={`pm-move absolute flex items-start justify-start rounded-[3px] px-1 pt-0.5 font-semibold text-[11px] tabular-nums leading-tight hover:brightness-115 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-white ${foil ? 'heat-foil' : ''} ${dimmed ? 'opacity-15 saturate-50' : faded ? 'opacity-45' : ''}`}
                style={{
                  ...box(inset(r, 0.5)),
                  backgroundColor: tier.color,
                  // a soft top light, so blocks read as tiles rather than flat paint
                  backgroundImage: 'linear-gradient(180deg, rgb(255 255 255 / 0.22), rgb(255 255 255 / 0) 55%, rgb(0 0 0 / 0.12))',
                  color: tier === unrankedTier ? '#e5e5e5' : '#171717',
                  ['--foil-delay' as string]: `${(index + item.tier) * 0.15}s`,
                }}
                // a ranked tier opens on Rankings, which lists exactly those cards; unranked ones have no tier there
                onClick={() => (tierOf(item.tier) === unrankedTier ? onOpen(set.id, pack) : onOpenTier(set.id, item.tier))}
                data-tooltip-id="pack-value-map"
                data-tip={`${set.id}|${pack.name}|${item.tier}`}
                aria-label={`${packTitle}: ${n} ${tier === unrankedTier ? 'unranked' : tier.name} missing`}
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
        {caption && (
          <p className="pointer-events-none absolute bottom-1.5 left-1.5 line-clamp-2 text-balance max-w-[calc(100%-0.75rem)] rounded bg-neutral-950/80 px-1.5 py-0.5 text-[11px] text-neutral-100 leading-snug backdrop-blur-sm">
            {caption}
          </p>
        )}
      </div>
    )
  }

  let packIndex = 0
  return (
    <div>
      <div ref={ref} className={`relative h-[34rem] lg:h-[38rem] ${moving ? 'pack-map-moving' : ''}`}>
        {trays.map(({ item: set, rect }) => {
          const tray = inset(rect, GAP / 2)
          const missing = set.packs.reduce((sum, p) => sum + p.missing, 0)
          const head = tray.h >= 90 && tray.w >= 110
          const inner = inset({ x: 0, y: head ? SET_HEAD : 0, w: tray.w, h: tray.h - (head ? SET_HEAD : 0) }, RIM)
          return (
            <section
              key={set.id}
              className="pm-move absolute rounded-lg bg-neutral-950/70 ring-1 ring-neutral-700/70"
              style={box(tray)}
              aria-label={`${set.name}: ${missing} missing`}
            >
              {head && (
                <header className="flex items-center gap-1.5 overflow-hidden px-1.5 text-[11px] whitespace-nowrap" style={{ height: SET_HEAD + RIM }}>
                  <SetLogo expansionId={set.id} className="h-4 w-auto shrink-0" />
                  <span className="text-neutral-500 tabular-nums">{set.id}</span>
                  <span className="min-w-0 truncate text-neutral-200">{set.name}</span>
                  {/* a set's packs aren't opened together, so their per-pack odds don't add up to anything: count only */}
                  {sizeBy === 'missing' && <span className="ml-auto shrink-0 text-neutral-500 tabular-nums">{missing} left</span>}
                </header>
              )}
              {layout(set.packs, packSize, inner).map(({ item, rect: r }) => renderPack(set, item, inset(r, 1), packIndex++))}
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
        render={({ activeAnchor }) => {
          const tip = tips.get(activeAnchor?.getAttribute('data-tip') ?? '')
          if (!tip) {
            return null
          }
          const cards = tip.cards ?? []
          return (
            <div className="max-w-64">
              <p className="font-semibold">{tip.title}</p>
              {tip.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
              {cards.length > 0 && <MissingThumbs cards={cards.slice(0, previewCount)} missing={cards.length} className="mt-1.5 w-64" />}
            </div>
          )
        }}
      />
    </div>
  )
}
