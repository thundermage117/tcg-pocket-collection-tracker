// Personal fork: LF / FT card grids with filters, Discord export and trade settings (replaces upstream's offers/matches tabs).
import { Check, ChevronDown, Copy, Flame, Scale } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { DropdownFilter, TabsFilter } from '@/components/Filters'
import SearchInput from '@/components/filters/SearchInput'
import { Spinner } from '@/components/Spinner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatRarity } from '@/components/utils'
import { ValueDataAge } from '@/components/ValueDataAge'
import { expansions, getCardByInternalId, getExpansionById } from '@/lib/CardsDB'
import { RARITY_ORDER } from '@/lib/discordTradeList'
import { getCardNameByLang } from '@/lib/utils'
import { demandRatio, getCardValue, valueSortKey } from '@/lib/ValueDB'
import TradeSettings from '@/pages/trade/TradeSettings.tsx'
import { useAccount } from '@/services/account/useAccount'
import { useLoginDialog } from '@/services/auth/useAuth'
import { useCollection, useTradingCards } from '@/services/collection/useCollection'
import { defaultRaritySettings, type ExpansionId, type Rarity, tradableRarities } from '@/types'
import { DiscordExport, useDiscordMessages } from './components/DiscordExport'
import { hotLabel, TradeGrid } from './components/TradeGrid'
import { cardNumber, groupBySet, markHot, type SortMode, type TradeItem } from './tradeGroups'

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

const DISCORD_SECTION_ID = 'discord-export'

const ratioOf = (item: TradeItem) => demandRatio(getCardValue(item.card.card_id))

function Collapsible({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <details id={id} className="group rounded-xl border border-neutral-800 bg-neutral-900/60">
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
  const [hotOnly, setHotOnly] = useState(false)
  const [copied, setCopied] = useState(false)
  const { setIsLoginDialogOpen } = useLoginDialog()

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
    return { lf: markHot(toItems(trading.wanted, false), ratioOf), ft: markHot(toItems(trading.extra, true), ratioOf) }
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
    (!query || item.name.toLowerCase().includes(query)) &&
    (!hotOnly || item.hot === true)

  const lf = groupBySet(items.lf.filter(matches), view.mode, true)
  const ft = groupBySet(items.ft.filter(matches), view.mode, false)
  const count = (groups: typeof lf) => groups.reduce((n, g) => n + g.items.length, 0)
  const spareCopies = ft.reduce((n, g) => n + g.items.reduce((m, i) => m + (i.count ?? 0), 0), 0)
  const messages = useDiscordMessages(lf, ft)

  // one message copies straight away; several need picking, so open the export section
  const copyForDiscord = async () => {
    if (messages.length === 1) {
      await navigator.clipboard.writeText(messages[0])
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      return
    }
    const section = document.getElementById(DISCORD_SECTION_ID) as HTMLDetailsElement | null
    if (section) {
      section.open = true
      section.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12">
      <header className="mb-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold sm:text-3xl">Trade</h1>
          <Link to="/trade/check" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <Scale className="size-4" />
            Check a trade
          </Link>
        </div>
        <p className="mt-1 text-sm text-neutral-400">Cards you're looking for and spares you can offer, based on your keep / collect settings.</p>
        <ValueDataAge className="mt-2" />
      </header>

      {!account && !isLoading ? (
        <div className="flex flex-col items-center gap-3 py-12 text-neutral-400">
          <p>Log in to see your trade lists.</p>
          <Button onClick={() => setIsLoginDialogOpen(true)}>Log in</Button>
        </div>
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

          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <Tabs value={side} onValueChange={(v) => setSide(v as Side)}>
              <TabsList className="inline-flex rounded-md border-1 border-neutral-700 bg-neutral-800">
                <TabsTrigger className="rounded-sm" value="lf">
                  Looking for <span className="ml-1.5 text-neutral-400 tabular-nums">{count(lf)}</span>
                </TabsTrigger>
                <TabsTrigger className="rounded-sm" value="ft">
                  For trade <span className="ml-1.5 text-neutral-400 tabular-nums">{count(ft)}</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex flex-wrap items-center gap-4">
              <label htmlFor="trade-hot-only" className="flex cursor-pointer items-center gap-2 text-sm text-neutral-300" title={hotLabel[side]}>
                <Switch id="trade-hot-only" checked={hotOnly} onCheckedChange={setHotOnly} />
                <Flame className="size-3.5 text-orange-500" />
                {side === 'ft' ? 'In demand only' : 'Scarce only'}
              </label>
              <Button variant="outline" size="sm" disabled={messages.length === 0} onClick={copyForDiscord}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? 'Copied' : messages.length > 1 ? `Copy for Discord (${messages.length} messages)` : 'Copy for Discord'}
              </Button>
            </div>
          </div>

          {isLoading ? (
            <Spinner size="md" />
          ) : side === 'lf' ? (
            <TradeGrid side="lf" groups={lf} empty="Nothing you're looking for matches these filters." />
          ) : (
            <>
              {spareCopies > 0 && <p className="-mt-2 mb-4 text-sm text-neutral-400">{spareCopies} spare copies in total.</p>}
              <TradeGrid side="ft" groups={ft} empty="No spares match these filters." />
            </>
          )}

          <div className="mt-8 flex flex-col gap-3">
            <Collapsible id={DISCORD_SECTION_ID} title="Copy for Discord">
              <DiscordExport messages={messages} />
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
