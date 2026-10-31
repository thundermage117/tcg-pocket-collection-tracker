// Personal fork: which booster to open if the pull were a guaranteed ☆☆.
import { Fragment, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Spinner } from '@/components/Spinner'
import { getBoosterValues } from '@/lib/packValue'
import { getCardNameByLang } from '@/lib/utils'
import { getCardValue, isProvisional, kindLabel, PROVISIONAL_VOTES, valuesGeneratedAt } from '@/lib/ValueDB'
import { useCollection, useSelectedCard } from '@/services/collection/useCollection'

type SortKey = 'meanAdj' | 'forMe' | 'pTrainerOrRainbow' | 'pNew'

const sortOptions: { key: SortKey; label: string }[] = [
  { key: 'meanAdj', label: 'Value' },
  { key: 'forMe', label: 'Value for me' },
  { key: 'pNew', label: 'Chance of new' },
  { key: 'pTrainerOrRainbow', label: 'Trainer / rainbow' },
]

const pct = (x: number) => `${Math.round(100 * x)}%`

export default function PackValue() {
  const { t, i18n } = useTranslation(['common/sets', 'common/packs'])
  const { data: collection, isLoading } = useCollection()
  const { setSelectedCardId } = useSelectedCard()
  const [sortKey, setSortKey] = useState<SortKey>('meanAdj')
  const [expanded, setExpanded] = useState<string | undefined>()

  const boosters = useMemo(() => {
    const rows = getBoosterValues(collection).map((b) => ({
      ...b,
      // expected value of a guaranteed ☆☆ to you: duplicates count as worthless
      forMe: b.pNew * (b.meanAdjNew ?? 0),
    }))
    return rows.toSorted((a, b) => b[sortKey] - a[sortKey])
  }, [collection, sortKey])

  if (isLoading) {
    return <Spinner size="lg" overlay />
  }

  return (
    <main className="mx-auto max-w-4xl px-4 pb-12">
      <h1 className="text-2xl font-semibold mb-1">Which pack for a guaranteed ☆☆?</h1>
      <p className="text-sm text-neutral-400 mb-4">
        Value = community vote Elo from pokemontcglivetrade (adjusted for vote count). Every ☆☆ in a pack is equally likely. Deluxe packs excluded. Data from{' '}
        {valuesGeneratedAt}.{collection ? '' : ' Log in to see personalised columns.'}
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {sortOptions.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => setSortKey(o.key)}
            className={`px-3 py-1 rounded-full border text-sm ${sortKey === o.key ? 'bg-neutral-200 text-neutral-900 border-neutral-200' : 'border-neutral-700'}`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-neutral-400 text-left">
            <tr>
              <th className="py-2 pr-2">#</th>
              <th className="py-2 pr-2">Pack</th>
              <th className="py-2 px-2 text-right">Value</th>
              <th className="py-2 px-2 text-right">Top 50</th>
              <th className="py-2 px-2 text-right">Trainer / rainbow</th>
              <th className="py-2 px-2 text-right">New for me</th>
              <th className="py-2 pl-2 text-right">Value for me</th>
            </tr>
          </thead>
          <tbody>
            {boosters.map((b, i) => {
              const id = `${b.expansionId}-${b.packName}`
              const provisional = b.minVotes < PROVISIONAL_VOTES
              return (
                <Fragment key={id}>
                  <tr className="border-t border-neutral-800 cursor-pointer hover:bg-neutral-900" onClick={() => setExpanded(expanded === id ? undefined : id)}>
                    <td className="py-2 pr-2 text-neutral-500">{i + 1}</td>
                    <td className="py-2 pr-2">
                      {t(b.expansionName, { ns: 'common/sets' })}
                      <span className="text-neutral-400"> · {t(b.packName, { ns: 'common/packs' })}</span>
                      {provisional && <span className="ml-2 text-xs text-amber-400">provisional</span>}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">{Math.round(b.meanAdj)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{pct(b.pTop50)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{pct(b.pTrainerOrRainbow)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{collection ? pct(b.pNew) : '–'}</td>
                    <td className="py-2 pl-2 text-right tabular-nums">{collection ? Math.round(b.forMe) : '–'}</td>
                  </tr>
                  {expanded === id && (
                    <tr>
                      <td />
                      <td colSpan={6} className="pb-3">
                        <ul className="grid sm:grid-cols-2 gap-x-6">
                          {b.cards.map((card) => {
                            const v = getCardValue(card.card_id)
                            const have = (collection?.get(card.internal_id)?.amount_owned ?? 0) > 0
                            return (
                              <li key={card.card_id} className="flex justify-between gap-2 py-0.5">
                                <button
                                  type="button"
                                  className={`text-left hover:underline ${have ? 'text-neutral-500' : ''}`}
                                  onClick={() => setSelectedCardId(card.internal_id)}
                                >
                                  {getCardNameByLang(card, i18n.language)}
                                  <span className="text-neutral-500"> · {v?.kind ? kindLabel[v.kind] : ''}</span>
                                  {have && <span className="text-neutral-500"> ✓</span>}
                                </button>
                                <span className="tabular-nums text-neutral-400">
                                  #{v?.rank} · {v?.adj}
                                  {isProvisional(v) && '*'}
                                </span>
                              </li>
                            )
                          })}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-500 mt-4">
        Value for me = chance the ☆☆ is new to you × average value of the ones you're missing. * = fewer than {PROVISIONAL_VOTES} votes, still settling.
      </p>
    </main>
  )
}
