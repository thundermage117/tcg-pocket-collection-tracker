// Personal fork: the packs page's controls. Goal and Rarity are what most visits change, so they're always on show;
// the rest sit on a second row on desktop and behind "Filters" (a bottom sheet, with removable chips) on phones.
import { SlidersHorizontal, X } from 'lucide-react'
import { useState } from 'react'
import { CountAltSwitch } from '@/components/CountAltSwitch'
import { TabsFilter } from '@/components/Filters'
import { TierChip } from '@/components/TierChip'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { PackRarity } from '@/lib/packValue'
import { tiers } from '@/lib/rankings'
import {
  type Goal,
  goalLabels,
  goalOptions,
  type KindOption,
  kindOptions,
  rarityOptions,
  raritySlug,
  scaleName,
  showKind,
  showRarity,
  type TierOption,
  tierLabel,
  tierMax,
  tierOptions,
} from '../types'

export interface PackControlsProps {
  goal: Goal
  rarity: PackRarity
  defaultRarity: PackRarity
  tier: TierOption
  defaultTier: TierOption
  reachable: (key: TierOption) => boolean
  kind: KindOption
  onlyMissing: boolean
  series: string
  seriesOptions: string[]
  hideComplete: boolean
  hasCollection: boolean // logged in, maybe still loading: "only missing" means something
  collectionLoaded: boolean // "hide fully owned" needs the cards
  update: (changes: Record<string, string | undefined>) => void
}

const tierRange = { hot: 'SSS–S', top: 'SSS–A' }

/** The secondary filters that are off their default, each with the URL change that resets it. */
function activeFilters({ goal, rarity, tier, defaultTier, kind, onlyMissing, series, hideComplete, hasCollection }: PackControlsProps) {
  const chips: { key: string; label: string; reset: Record<string, undefined> }[] = []
  if (goal === 'value') {
    if (hasCollection && !onlyMissing) {
      chips.push({ key: 'owned', label: 'Owned cards count too', reset: { owned: undefined } })
    }
    if (tier !== defaultTier) {
      chips.push({ key: 'tier', label: tier === 'all' ? tierLabel('all', rarity) : `${tier === 'hot' ? 'Hot' : 'Top'} only`, reset: { tier: undefined } })
    }
    if (kind !== 'all') {
      chips.push({ key: 'kind', label: showKind(kind), reset: { kind: undefined } })
    }
  }
  if (series !== 'All') {
    chips.push({ key: 'series', label: `Series ${series}`, reset: { series: undefined } })
  }
  if (hideComplete) {
    chips.push({ key: 'hide', label: 'Hiding fully owned', reset: { hide: undefined } })
  }
  return chips
}

export function PackControls(props: PackControlsProps) {
  const { goal, rarity, defaultRarity, update } = props
  const [sheetOpen, setSheetOpen] = useState(false)
  const chips = activeFilters(props)

  return (
    <div className="mb-5 space-y-3">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <TabsFilter
          label="Goal"
          options={goalOptions}
          value={goal}
          show={(x) => goalLabels[x]}
          onChange={(x) => update({ goal: x === 'value' ? undefined : x, rarity: undefined, owned: undefined })}
        />
        <Button variant="outline" className="ml-auto h-[38px] border-neutral-700 sm:hidden" onClick={() => setSheetOpen(true)}>
          <SlidersHorizontal />
          Filters
          {chips.length > 0 && <span className="rounded-full bg-amber-400 px-1.5 text-xs font-semibold text-neutral-900 tabular-nums">{chips.length}</span>}
        </Button>
        {/* one row that scrolls sideways on phones, rather than eleven options wrapping onto two lines */}
        <div className="w-full min-w-0 overflow-x-auto [scrollbar-width:none] sm:w-auto">
          <TabsFilter
            label="Rarity"
            options={rarityOptions}
            value={rarity}
            show={showRarity}
            onChange={(r) => update({ rarity: r === defaultRarity ? undefined : raritySlug[r] })}
            className="flex w-max flex-nowrap"
          />
        </div>
      </div>

      {chips.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] sm:hidden">
          {chips.map(({ key, label, reset }) => (
            <button
              key={key}
              type="button"
              onClick={() => update(reset)}
              aria-label={`Remove filter: ${label}`}
              className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-neutral-700 bg-neutral-800 py-1 pr-1.5 pl-2.5 text-xs text-neutral-200 hover:bg-neutral-700"
            >
              {label}
              <X className="size-3.5 text-neutral-400" />
            </button>
          ))}
        </div>
      )}

      <div className="hidden flex-wrap items-end gap-x-4 gap-y-3 sm:flex">
        <MoreFilters {...props} idPrefix="packs" />
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-xl border-neutral-800 px-4 pb-8">
          <SheetHeader className="px-0">
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-col items-start gap-4">
            <MoreFilters {...props} idPrefix="packs-sheet" compact />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

/** Everything but Goal and Rarity; `compact` (the phone sheet) names the tier ranges instead of drawing their chips. */
function MoreFilters({
  goal,
  rarity,
  tier,
  defaultTier,
  reachable,
  kind,
  onlyMissing,
  series,
  seriesOptions,
  hideComplete,
  hasCollection,
  collectionLoaded,
  update,
  idPrefix,
  compact = false,
}: PackControlsProps & { idPrefix: string; compact?: boolean }) {
  const value = goal === 'value'
  return (
    <>
      {value && (
        <div className="flex flex-col gap-1">
          <span className="px-0.5 text-[11px] font-medium uppercase tracking-wider text-neutral-400">Which cards count</span>
          <ToggleGroup
            type="single"
            value={tier}
            onValueChange={(v) => v && update({ tier: v === defaultTier ? undefined : v })}
            className="rounded-md border-1 border-neutral-700 bg-neutral-800"
          >
            {tierOptions.map((key) => (
              <ToggleGroupItem
                key={key}
                value={key}
                disabled={!reachable(key)}
                title={
                  reachable(key) ? tierLabel(key, rarity) : `No ${showRarity(rarity)} is in ${tierRange[key as 'hot' | 'top']} (${scaleName(rarity)} tiers)`
                }
                className="gap-1.5 px-3"
              >
                {key === 'all' ? (
                  'Any'
                ) : (
                  <>
                    {compact ? (
                      <span className="text-[10px] text-neutral-400">{tierRange[key]}</span>
                    ) : (
                      <span className="flex gap-0.5">
                        {tiers.slice(0, tierMax[key] + 1).map((t) => (
                          <TierChip key={t.name} tier={t} />
                        ))}
                      </span>
                    )}
                    {key === 'hot' ? 'Hot' : 'Top'}
                  </>
                )}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}
      {value && rarity === '☆☆' && (
        <TabsFilter label="Style" options={kindOptions} value={kind} show={showKind} onChange={(x) => update({ kind: x === 'all' ? undefined : x })} />
      )}
      <TabsFilter label="Series" options={seriesOptions} value={series} onChange={(x) => update({ series: x === 'All' ? undefined : x })} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 sm:pb-2">
        {value && hasCollection && (
          <label htmlFor={`${idPrefix}-only-missing`} className="flex cursor-pointer items-center gap-2 text-sm text-neutral-300">
            <Switch id={`${idPrefix}-only-missing`} checked={onlyMissing} onCheckedChange={(on) => update({ owned: on ? undefined : '1' })} />
            Only cards I'm missing
          </label>
        )}
        {collectionLoaded && (
          <label htmlFor={`${idPrefix}-hide-complete`} className="flex cursor-pointer items-center gap-2 text-sm text-neutral-300">
            <Switch id={`${idPrefix}-hide-complete`} checked={hideComplete} onCheckedChange={(on) => update({ hide: on ? '1' : undefined })} />
            Hide fully owned
          </label>
        )}
        <CountAltSwitch id={`${idPrefix}-count-alt`} />
      </div>
    </>
  )
}
