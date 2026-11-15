// Personal fork: which pack the alt should open (lib/altSupport.ts, bestAltPacks). Its own Wonder Pick unlock first,
// then the ☆-and-up cards main needs that neither account has.
import { useTranslation } from 'react-i18next'
import { CardThumb, SetLogo } from '@/components/CardThumb'
import { type AltPackRow, GIFT_QUEUE_FULL, latestExpansion, type AltPackPick as Pick } from '@/lib/altSupport'
import { gives, packOdds } from '@/pages/packs/types'
import { useSelectedCard } from '@/services/collection/useCollection'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** What one pack does for the alt, in one line: the odds that rank it in this phase, then what else it gives. */
function reason(row: AltPackRow, phase: Pick['phase']) {
  const rare = row.rareChance > 0 && `${packOdds(row.rareChance)} ${gives(row.rareChance)} a ☆+ main needs (${row.rareTargets.length} here)`
  const common =
    row.commonExpected > 0 &&
    (row.commonExpected >= 1 ? `≈${row.commonExpected.toFixed(1)} ◊ for main per pack` : `1 ◊ for main every ${Math.round(1 / row.commonExpected)} packs`)
  const lead =
    phase === 'unlock'
      ? row.unlockChance > 0 && `${packOdds(row.unlockChance)} ${gives(row.unlockChance)} an unlock card the alt is missing (${row.unlockTargets.length} here)`
      : rare
  const rest = phase === 'unlock' ? [rare, common] : [common]
  return { lead: lead || 'Nothing for the alt here', rest: rest.filter(Boolean) as string[] }
}

function Row({ row, phase, position }: { row: AltPackRow; phase: Pick['phase']; position: number }) {
  const { t } = useTranslation(['common/sets', 'common/packs'])
  const { lead, rest } = reason(row, phase)
  return (
    <li
      className="flex items-start gap-3 rounded-lg border border-neutral-800 bg-neutral-900/60 p-3"
      style={{ borderLeftColor: row.pack.color, borderLeftWidth: 3 }}
    >
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-xs font-bold text-neutral-300 tabular-nums">
        {position}
      </span>
      <div className="min-w-0 text-sm">
        <p className="truncate font-medium">
          {t(row.pack.name, { ns: 'common/packs' })} <span className="text-neutral-400">· {t(row.expansion.name, { ns: 'common/sets' })}</span>
        </p>
        <p className="text-neutral-300">{lead}</p>
        {rest.length > 0 && <p className="text-xs text-neutral-500">{rest.join(' · ')}</p>}
      </div>
    </li>
  )
}

/** The section's note: why the list is ranked the way it is right now. */
export function AltPackNote({ pick }: { pick: Pick }) {
  const { t } = useTranslation(['common/sets'])
  return pick.phase === 'unlock'
    ? `The alt still needs ${plural(pick.unlockLeft, 'card')} of ${t(latestExpansion.name, { ns: 'common/sets' })} that main can't gift it. Finish those first: then its daily 24-hour Wonder Picks show ☆☆ it's missing, which it can trade to main.`
    : `Ranked by the chance of a ☆ or rarer card main needs and neither account has. ${
        pick.giftQueue >= GIFT_QUEUE_FULL
          ? `◊–◊◊◊◊ don't count: the alt already holds ${pick.giftQueue} for main, and main takes one gift a day.`
          : '◊–◊◊◊◊ main needs break ties.'
      } Check the alt's 24-hour Wonder Picks every day too.`
}

export function AltPackPick({ pick }: { pick: Pick }) {
  const { t } = useTranslation(['common/sets', 'common/packs'])
  const { setSelectedCardId } = useSelectedCard()
  const [best, ...others] = pick.packs

  if (!best) {
    return <p className="py-6 text-center text-neutral-500">Nothing left the alt can pull for main.</p>
  }

  const { lead, rest } = reason(best, pick.phase)
  const preview = (pick.phase === 'unlock' ? [...best.unlockTargets, ...best.rareTargets] : [...best.rareTargets, ...best.commonTargets]).slice(0, 4)

  return (
    <>
      <div
        className="flex flex-col gap-4 rounded-xl border border-neutral-800 p-4 sm:flex-row sm:items-center sm:p-5"
        style={{ background: `linear-gradient(120deg, ${best.pack.color}33, transparent 70%)` }}
      >
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs font-medium tracking-wider text-amber-400 uppercase">Alt: open this</p>
          <div className="flex items-center gap-3">
            <SetLogo expansionId={best.expansion.id} className="hidden h-10 max-w-[90px] sm:block" />
            <div className="min-w-0">
              <h3 className="truncate text-xl font-semibold">{t(best.pack.name, { ns: 'common/packs' })}</h3>
              <p className="truncate text-sm text-neutral-400">{t(best.expansion.name, { ns: 'common/sets' })}</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-neutral-200">{lead}.</p>
          {rest.length > 0 && <p className="mt-1 text-xs text-neutral-400">Also: {rest.join(' · ')}.</p>}
        </div>
        {preview.length > 0 && (
          <div className="grid w-full grid-cols-4 gap-2 sm:w-72">
            {preview.map((card) => (
              <CardThumb key={card.internal_id} card={card} label={card.rarity} onClick={() => setSelectedCardId(card.internal_id)} />
            ))}
          </div>
        )}
      </div>
      {others.length > 0 && (
        <ol className="mt-3 grid gap-2 md:grid-cols-2">
          {others.slice(0, 4).map((row, i) => (
            <Row key={`${row.expansion.id}-${row.pack.name}`} row={row} phase={pick.phase} position={i + 2} />
          ))}
        </ol>
      )}
    </>
  )
}
