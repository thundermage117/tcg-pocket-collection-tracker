// Personal fork: the species page's hero effects (step transition, swipe settle, glow, pointer depth) and its small panels.
import type { ReactNode, RefObject } from 'react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { PackChance } from '@/pages/overview/packChances'
import { oneIn } from '@/pages/packs/types'
import type { CardType, ExpansionId } from '@/types'
import { ProgressBar, surface, typeColors } from './SpeciesTile'

/**
 * Marks a step to the previous or next species for the view transition: the page slides out one side and the next species in
 * from the other (pokedex.css), instead of the two heroes, which go by different names, crossfading on top of each other.
 * Cleared once the transition is over.
 */
let stepTimer = 0
export function markStep(direction: 'prev' | 'next') {
  document.documentElement.dataset.dexStep = direction
  clearTimeout(stepTimer)
  stepTimer = window.setTimeout(() => delete document.documentElement.dataset.dexStep, 600)
}

/** The hero back from where a swipe dragged it: eased back when the swipe fell short, at once for the next species. */
export function settleHero(hero: HTMLElement | null, animate: boolean) {
  if (hero) {
    hero.style.transition = animate ? 'transform 200ms ease-out, opacity 200ms ease-out' : ''
    hero.style.transform = ''
    hero.style.opacity = ''
  }
}

/** The hero's glow: soft-edged (closest-side, so it's gone before the box's edge); dual types side by side. */
export const heroGlow = (types: CardType[]) =>
  types.length === 1
    ? `radial-gradient(closest-side at 50% 45%, ${typeColors[types[0]]}66, transparent)`
    : `radial-gradient(closest-side at 38% 40%, ${typeColors[types[0]]}55, transparent), radial-gradient(closest-side at 62% 55%, ${typeColors[types[1]]}55, transparent)`

// lifts the frameless hero artwork off the page
export const heroShadow = 'drop-shadow-[0_20px_22px_rgba(0,0,0,0.5)]'
// follows the pointer by up to 12px (--px/--py, -1…1, set by useHeroDepth)
export const heroDepth = 'transition-[translate] duration-500 ease-out [translate:calc(var(--px,0)*12px)_calc(var(--py,0)*8px)]'

/**
 * Depth in the hero: the pointer's offset from the hero's centre (-1…1 across half the window) as --px/--py on it, which the
 * artwork follows and the dex number counters. CSS variables, not state, so moving the mouse doesn't re-render the page.
 * Desktop only: off for touch, pens and reduced motion.
 */
export function useHeroDepth(ref: RefObject<HTMLElement | null>, deps: unknown[]) {
  useEffect(() => {
    const hero = ref.current
    if (!hero || !matchMedia('(hover: hover) and (pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }
    const set = (x: number, y: number) => {
      hero.style.setProperty('--px', x.toFixed(3))
      hero.style.setProperty('--py', y.toFixed(3))
    }
    const clamp = (v: number) => Math.max(-1, Math.min(1, v))
    let frame = 0
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') {
        return
      }
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const r = hero.getBoundingClientRect()
        set(clamp((e.clientX - r.left - r.width / 2) / (window.innerWidth / 2)), clamp((e.clientY - r.top - r.height / 2) / (window.innerHeight / 2)))
      })
    }
    // the pointer leaving the window: back to rest
    const onLeave = () => {
      cancelAnimationFrame(frame)
      set(0, 0)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      set(0, 0)
    }
  }, deps)
}

/** Wide soft ellipses from the top corners, the first type on the left and the second (or the same) on the right. */
export const pageGlow = (types: CardType[], caught: boolean) => {
  const alpha = caught ? '38' : '1c'
  const [left, right = left] = types.map((t) => typeColors[t])
  return `radial-gradient(ellipse 65% 100% at 15% 0%, ${left}${alpha}, transparent), radial-gradient(ellipse 55% 85% at 90% 0%, ${right}${alpha}, transparent)`
}

/** The pack most likely to give a missing printing: its set's logo on the pack's colour, the odds, and how much of this species it holds. */
export function BestPack({ best, name }: { best: PackChance & { expansionId: ExpansionId }; name: string }) {
  const { t } = useTranslation(['common/sets', 'common/packs'])
  return (
    <div
      className={cn('relative overflow-hidden rounded-xl p-3', surface)}
      style={{ backgroundImage: `linear-gradient(120deg, ${best.pack.color}33, transparent 65%)` }}
    >
      <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">Best pack for a missing one</p>
      <div className="mt-2 flex items-center gap-3">
        <img src={`/images/sets/en-US/${best.expansionId}.webp`} alt="" className="h-10 w-20 shrink-0 object-contain" />
        <div className="min-w-0">
          <p className="dex-display truncate font-semibold text-[1.05rem]">
            {t(best.pack.name, { ns: 'common/packs' })} <span className="font-normal text-neutral-400 text-sm">{best.expansionId}</span>
          </p>
          <p className="text-neutral-300 text-sm">
            <span className="font-semibold tabular-nums">{oneIn(best.pct / 100)}</span> packs gives a missing {name}
          </p>
        </div>
      </div>
      <p className="mt-2 text-neutral-400 text-xs tabular-nums">
        {best.collected}/{best.available} of its {name} cards owned
      </p>
      <ProgressBar value={best.collected} max={best.available} color={best.pack.color} className="mt-1 h-1" />
    </div>
  )
}

export function Stat({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl px-3 py-2', surface, className)}>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">{label}</dt>
      <dd className="text-neutral-200">{children}</dd>
    </div>
  )
}
