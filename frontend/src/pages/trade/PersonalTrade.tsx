// Personal fork: LF / FT card grids with filters, Discord export and trade settings (replaces upstream's offers/matches tabs).
import { ChevronDown } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DropdownFilter, TabsFilter } from '@/components/Filters'
import SearchInput from '@/components/filters/SearchInput'
import { Spinner } from '@/components/Spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatRarity } from '@/components/utils'
import { expansions, getCardByInternalId, getExpansionById } from '@/lib/CardsDB'
import { RARITY_ORDER } from '@/lib/discordTradeList'
import { getCardNameByLang } from '@/lib/utils'
import { demandRatio, getCardValue, valueSortKey } from '@/lib/ValueDB'
import TradeSettings from '@/pages/trade/TradeSettings.tsx'
import { useAccount } from '@/services/account/useAccount'
import { useCollection, useTradingCards } from '@/services/collection/useCollection'
import { defaultRaritySettings, type ExpansionId, type Rarity, tradableRarities } from '@/types'
import { DiscordExport } from './components/DiscordExport'
import { TradeGrid } from './components/TradeGrid'
import { cardNumber, groupBySet, type SortMode, type TradeItem } from './tradeGroups'

type Side = 'lf' | 'ft'
type SetOption = 'all' | ExpansionId
// `${expansionId}|${packName}`; a set's "everypack" cards count as part of every pack
type PackOption = 'all' | `${ExpansionId}|${string}`

const rarityOptions = RARITY_ORDER.filter((r) => (tradableRarities as readonly string[]).includes(r)) as Rarity[]
const sortOptions: SortMode[] = ['list', 'value']

const VIEW_STORAGE_KEY = 'trade-view'

function loadView(): { rarity: Rarity; mode: SortMode } {
  try {
    const saved = JSON.parse(localStorage.getItem(VIEW_STORAGE_KEY) ?? '{}')
    return { rarity: rarityOptions.includes(saved.rarity) ? saved.rarity : '☆', mode: sortOptions.includes(saved.mode) ? saved.mode : 'list' }
  } catch {
    return { rarity: '☆', mode: 'list' }
  }
}

function Collapsible({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-xl border border-neutral-800 bg-neutral-900/60">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-medium hover:bg-neutral-800/60 [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="size-4 text-neutral-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-neutral-800 p-4">{children}</div>
    </details>
  )
}

export default function PersonalTrade() {
  const { t, i18n } = useTranslation(['common/sets', 'common/packs'])
  const { data: account } = useAccount()
  const { data: collection } = useCollection()
  const { data: trading, isLoading } = useTradingCards()
  const [view, setView] = useState(loadView)
  const [side, setSide] = useState<Side>('lf')
  const [set, setSet] = useState<SetOption>('all')
  const [pack, setPack] = useState<PackOption>('all')
  const [search, setSearch] = useState('')

  const updateView = (next: Partial<typeof view>) => {
    const merged = { ...view, ...next }
    setView(merged)
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(merged))
    } catch {
      // storage unavailable: keep the choice for this visit only
    }
  }

  // every LF / FT item of the selected rarity, before set / pack / search filters
  const items = useMemo(() => {
    if (!trading || !collection || !account) {
      return { lf: [], ft: [] }
    }
    const keepByRarity = Object.fromEntries(account.trade_rarity_settings.map((s) => [s.rarity, s.to_keep]))
    const toItems = (ids: number[], forTrade: boolean): TradeItem[] =>
      ids.flatMap((id) => {
        const card = getCardByInternalId(id)
        if (!card || card.rarity !== view.rarity) {
          return []
        }
        const row = collection.get(card.internal_id)
        const keep = row?.amount_wanted ?? keepByRarity[card.rarity] ?? defaultRaritySettings.to_keep
        return [
          {
            card,
            name: getCardNameByLang(card, i18n.language),
            number: cardNumber(card.card_id),
            count: forTrade ? (row?.amount_owned ?? 0) - keep : undefined,
            key: forTrade ? demandRatio(getCardValue(card.card_id)) : valueSortKey(card.card_id),
          },
        ]
      })
    return { lf: toItems(trading.wanted, false), ft: toItems(trading.extra, true) }
  }, [trading, collection, account, view.rarity, i18n.language])

  const all = [...items.lf, ...items.ft]
  const setOptions: SetOption[] = ['all', ...expansions.filter((e) => all.some((i) => i.card.expansion === e.id)).map((e) => e.id)]
  const packOptions: PackOption[] = [
    'all',
    ...expansions
      .filter((e) => (set === 'all' ? setOptions.includes(e.id) : e.id === set))
      .flatMap((e) => e.packs.filter((p) => p.name !== 'everypack').map((p): PackOption => `${e.id}|${p.name}`)),
  ]
  const showPack = (option: PackOption) => {
    if (option === 'all') {
      return 'All packs'
    }
    const [id, name] = option.split('|') as [ExpansionId, string]
    const packName = t(name, { ns: 'common/packs' })
    return set === 'all' ? `${t(getExpansionById(id).name, { ns: 'common/sets' })} · ${packName}` : packName
  }

  const query = search.trim().toLowerCase()
  const [packSet, packName] = pack === 'all' ? [] : pack.split('|')
  const matches = (item: TradeItem) =>
    (set === 'all' || item.card.expansion === set) &&
    (pack === 'all' || (item.card.expansion === packSet && (item.card.pack === packName || item.card.pack === 'everypack'))) &&
    (!query || item.name.toLowerCase().includes(query))

  const lf = groupBySet(items.lf.filter(matches), view.mode, true)
  const ft = groupBySet(items.ft.filter(matches), view.mode, false)
  const count = (groups: typeof lf) => groups.reduce((n, g) => n + g.items.length, 0)
  const spareCopies = ft.reduce((n, g) => n + g.items.reduce((m, i) => m + (i.count ?? 0), 0), 0)

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold sm:text-3xl">Trade</h1>
        <p className="mt-1 text-sm text-neutral-400">Cards you're looking for and spares you can offer, based on your keep / collect settings.</p>
      </header>

      {!account && !isLoading ? (
        <p className="py-12 text-center text-neutral-400">Log in to see your trade lists.</p>
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <TabsFilter label="Rarity" options={rarityOptions} value={view.rarity} onChange={(rarity) => updateView({ rarity })} show={formatRarity} />
              <TabsFilter
                label="Sort"
                options={sortOptions}
                value={view.mode}
                onChange={(mode) => updateView({ mode })}
                show={(m) => (m === 'list' ? 'Card number' : 'Value')}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <SearchInput value={search} setValue={setSearch} />
              <DropdownFilter
                label="Set"
                options={setOptions}
                value={set}
                onChange={(x) => {
                  setSet(x)
                  setPack('all')
                }}
                show={(id) => (id === 'all' ? 'All sets' : t(getExpansionById(id).name, { ns: 'common/sets' }))}
              />
              <DropdownFilter label="Pack" options={packOptions} value={pack} onChange={setPack} show={showPack} />
            </div>
          </div>

          <Tabs value={side} onValueChange={(v) => setSide(v as Side)} className="mb-5">
            <TabsList className="inline-flex rounded-md border-1 border-neutral-700 bg-neutral-800">
              <TabsTrigger className="rounded-sm" value="lf">
                Looking for <span className="ml-1.5 text-neutral-400 tabular-nums">{count(lf)}</span>
              </TabsTrigger>
              <TabsTrigger className="rounded-sm" value="ft">
                For trade <span className="ml-1.5 text-neutral-400 tabular-nums">{count(ft)}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {isLoading ? (
            <Spinner size="md" />
          ) : side === 'lf' ? (
            <TradeGrid groups={lf} empty="Nothing you're looking for matches these filters." />
          ) : (
            <>
              {spareCopies > 0 && <p className="-mt-2 mb-4 text-sm text-neutral-400">{spareCopies} spare copies in total.</p>}
              <TradeGrid groups={ft} empty="No spares match these filters." />
            </>
          )}

          <div className="mt-8 flex flex-col gap-3">
            <Collapsible title="Copy for Discord">
              <DiscordExport lf={lf} ft={ft} />
            </Collapsible>
            <Collapsible title="Keep / collect settings">
              <TradeSettings />
            </Collapsible>
          </div>
        </>
      )}
    </main>
  )
}
