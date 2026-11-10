// Personal fork: one booster on the packs page — its best cards of the chosen rarity, the chance for the chosen filters, tier mix, expandable pool.
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CardThumb, SetLogo } from '@/components/CardThumb'
import { Progress } from '@/components/ui/progress'
import { ownsCard, type PackRarity } from '@/lib/packValue'
import { type Tier, tiers } from '@/lib/rankings'
import { cn } from '@/lib/utils'
import { PROVISIONAL_VOTES } from '@/lib/ValueDB'
import { useSelectedCard } from '@/services/collection/useCollection'
import { useMainWithAlt } from '@/services/profile/useProfileCollection'
import { fill, type PackRow, packStat, type Range, scaleName, type TargetFilters } from '../types'
import { CardTierBadge } from './CardTierBadge'
import { PackPool } from './PackPool'

interface Props {
  pack: PackRow
  position: number
  filters: TargetFilters
  range: Range
  expanded: boolean
  onToggle: () => void
}

export function PackCard({ pack, position, filters, range, expanded, onToggle }: Props) {
  const { t } = useTranslation(['common/sets', 'common/packs'])
  const { data: collection } = useMainWithAlt()
  const { setSelectedCardId } = useSelectedCard()
  const provisional = pack.minVotes < PROVISIONAL_VOTES
  const complete = collection !== undefined && pack.missing === 0
  const headline = packStat(pack, filters)
  // the thumbnails show what you'd be chasing: the best matching cards, topped up with the rest of the pool
  const preview = [...pack.wanted, ...pack.cards.filter((c) => !pack.wanted.includes(c))].slice(0, 3)
  const poolCounts = [
    `${pack.cards.length} ${filters.rarity}`,
    collection && !complete && `${pack.missing} missing`,
    `${pack.wanted.length} match${pack.wanted.length === 1 ? 'es' : ''}`,
  ].filter(Boolean)

  return (
    <article
      className={cn(
        'flex flex-col gap-4 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 transition-colors hover:border-neutral-700',
        expanded && 'sm:col-span-2 lg:col-span-3',
      )}
      style={{ borderTopColor: pack.color, borderTopWidth: 3 }}
    >
      <header className="flex items-start gap-3">
        <span
          className={cn(
            'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums',
            position === 1 && pack.perPack > 0 ? 'bg-amber-400 text-neutral-900' : 'bg-neutral-800 text-neutral-300',
          )}
        >
          {position}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold leading-tight">{t(pack.packName, { ns: 'common/packs' })}</h2>
          <p className="truncate text-xs text-neutral-400">{t(pack.expansionName, { ns: 'common/sets' })}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {provisional && <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">provisional</span>}
            {complete && <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] font-medium text-green-400">all owned</span>}
          </div>
        </div>
        <SetLogo expansionId={pack.expansionId} className="h-9 max-w-[72px]" />
      </header>

      {!expanded && (
        <div className="grid grid-cols-3 gap-2">
          {preview.map((card) => (
            <CardThumb
              key={card.card_id}
              card={card}
              owned={ownsCard(collection, card)}
              badge={<CardTierBadge card={card} />}
              onClick={() => setSelectedCardId(card.internal_id)}
            />
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-sm">
          <span className="font-semibold tabular-nums text-neutral-100">{headline.stat}</span> <span className="text-neutral-400">{headline.caption}</span>
        </p>
        <Progress value={pack.perPack > 0 ? Math.round(100 * fill(pack.perPack, range)) : 0} barColor={pack.color} className="h-1.5" />
        <p className="text-xs text-neutral-500">{poolCounts.join(' · ')}</p>
      </div>

      <TierMix pack={pack} rarity={filters.rarity} showOwned={collection !== undefined} />

      {expanded && <PackPool cards={pack.cards} expansionId={pack.expansionId} rarity={filters.rarity} />}

      <button
        type="button"
        onClick={onToggle}
        className="mt-auto flex cursor-pointer items-center justify-center gap-1 rounded-md py-1.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
      >
        {expanded ? 'Show less' : `Show all ${pack.cards.length} ${filters.rarity}`}
        <ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} />
      </button>
    </article>
  )
}

// cards nobody trades (☆☆☆, Crown Rare) have no tier: a grey segment after E
const unranked: Tier = { name: '–', color: '#525252' }

/** How the pack's cards split across tiers: one segment per tier, the owned part faded. */
function TierMix({ pack, rarity, showOwned }: { pack: PackRow; rarity: PackRarity; showOwned: boolean }) {
  const shown = [...tiers, unranked].map((tier, i) => ({ tier, ...pack.tierMix[i] })).filter((x) => x.total > 0)
  const label = shown
    .map(({ tier, total, owned }) => `${tier === unranked ? 'unranked' : tier.name}: ${total}${showOwned ? ` (${owned} owned)` : ''}`)
    .join(', ')
  return (
    <div title={`${scaleName(rarity)} tiers · ${label}`} role="img" aria-label={`${rarity} per ${scaleName(rarity)} tier: ${label}`}>
      <div className="flex h-2 gap-px overflow-hidden rounded-full">
        {shown.map(({ tier, total, owned }) => (
          <div key={tier.name} className="flex h-full" style={{ flexGrow: total }}>
            <span className="h-full opacity-30" style={{ flexGrow: showOwned ? owned : 0, backgroundColor: tier.color }} />
            <span className="h-full" style={{ flexGrow: showOwned ? total - owned : total, backgroundColor: tier.color }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-px text-[10px] font-semibold text-neutral-500">
        {shown.map(({ tier, total }) => (
          <span key={tier.name} className="truncate text-center" style={{ flexGrow: total, flexBasis: 0 }}>
            {tier.name}
          </span>
        ))}
      </div>
    </div>
  )
}
