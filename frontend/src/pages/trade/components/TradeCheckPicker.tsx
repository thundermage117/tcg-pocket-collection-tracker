// Personal fork: card picker for one side of the trade check, with list sources (spares, LF, best asks, all cards).
import { type ReactNode, useState } from 'react'
import { CardThumb } from '@/components/CardThumb'
import { TabsFilter } from '@/components/Filters'
import SearchInput from '@/components/filters/SearchInput'
import { Button } from '@/components/ui/button'
import { formatRarity } from '@/components/utils'
import { RARITY_ORDER } from '@/lib/discordTradeList'
import { searchPredicate } from '@/lib/filters'
import { type Card, type Rarity, tradableRarities } from '@/types'
import { cardScore, scoreHint } from '../tradeCheckData'

export interface PickItem {
  card: Card
  label?: string // bottom-left corner, e.g. spare count
  badge?: ReactNode
}

export interface PickSource {
  id: string
  label: string
  items: PickItem[]
  empty: string
}

const PAGE = 48
const rarityOptions = RARITY_ORDER.filter((r) => (tradableRarities as readonly string[]).includes(r)) as Rarity[]
type RarityOption = 'all' | Rarity

interface Props {
  title: string
  sources: PickSource[]
  lockedRarity?: Rarity // the "I get" side only shows cards of the rarity you give
  note?: ReactNode
  onPick: (card: Card) => void
}

export function TradeCheckPicker({ title, sources, lockedRarity, note, onPick }: Props) {
  // unset until picked, so the first source wins once the logged-in lists load
  const [sourceId, setSourceId] = useState<string>()
  const [search, setSearch] = useState('')
  const [rarity, setRarity] = useState<RarityOption>('all')
  const [shown, setShown] = useState(PAGE)

  const source = sources.find((s) => s.id === sourceId) ?? sources[0]
  const matchesSearch = searchPredicate(search.trim())
  const items = source.items.filter(
    (i) => (lockedRarity ? i.card.rarity === lockedRarity : rarity === 'all' || i.card.rarity === rarity) && (!search.trim() || matchesSearch(i.card)),
  )

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {note && <p className="-mt-1 mb-3 text-sm text-neutral-400">{note}</p>}
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          {sources.length > 1 && (
            <TabsFilter
              options={sources.map((s) => s.id)}
              value={source.id}
              onChange={(id) => {
                setSourceId(id)
                setShown(PAGE)
              }}
              show={(id) => sources.find((s) => s.id === id)?.label ?? id}
            />
          )}
          {!lockedRarity && (
            <TabsFilter<RarityOption>
              options={['all', ...rarityOptions]}
              value={rarity}
              onChange={(r) => {
                setRarity(r)
                setShown(PAGE)
              }}
              show={(r) => (r === 'all' ? 'All' : formatRarity(r))}
            />
          )}
        </div>
        <SearchInput value={search} setValue={setSearch} className="sm:max-w-xs" />
      </div>

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-400">{search.trim() ? 'No cards match this search.' : source.empty}</p>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-6 md:grid-cols-8">
            {items.slice(0, shown).map((item) => {
              const score = cardScore(item.card)
              return (
                <div key={item.card.card_id} className="flex min-w-0 flex-col gap-0.5">
                  <CardThumb
                    card={item.card}
                    label={item.label ?? (score.score !== undefined ? String(Math.round(score.score)) : undefined)}
                    labelTitle={item.label ? undefined : 'Value score: percentile within the rarity (0–100)'}
                    badge={item.badge}
                    onClick={() => onPick(item.card)}
                  />
                  <span className="truncate text-center text-[11px] text-neutral-400 tabular-nums">{scoreHint(score)}</span>
                </div>
              )
            })}
          </div>
          {items.length > shown && (
            <div className="mt-4 flex items-center justify-center gap-3 text-sm text-neutral-400">
              Showing {shown} of {items.length}
              <Button variant="outline" size="sm" onClick={() => setShown((n) => n + PAGE * 2)}>
                Show more
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
