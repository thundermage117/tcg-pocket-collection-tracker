// Personal fork: trade settings + copy-paste Discord lists (replaces upstream's offers/matches tabs).
import { Check, Copy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Spinner } from '@/components/Spinner'
import { Button } from '@/components/ui/button'
import { expansions, getCardByInternalId, getExpansionById } from '@/lib/CardsDB'
import { formatDiscordTradeList, RARITY_ORDER, type TradeGroup } from '@/lib/discordTradeList'
import { getCardNameByLang } from '@/lib/utils'
import { demandRatio, getCardValue, valueSortKey } from '@/lib/ValueDB'
import TradeSettings from '@/pages/trade/TradeSettings.tsx'
import { useAccount } from '@/services/account/useAccount'
import { useCollection, useTradingCards } from '@/services/collection/useCollection'
import { defaultRaritySettings, type ExpansionId, type Rarity, tradableRarities } from '@/types'

type SortMode = 'list' | 'value'

interface Item {
  expansion: ExpansionId
  name: string
  number: number
  count?: number
  key: number // value (LF) or demand (FT), higher first
}

const releaseOrder = new Map(expansions.map((e, i) => [e.id, i]))

const cardNumber = (cardId: string) => Number(cardId.slice(cardId.lastIndexOf('-') + 1))

// FT (has counts): most copies first. LF: descending card number.
const listOrder = (a: Item, b: Item) => (a.count === undefined || b.count === undefined ? b.number - a.number : b.count - a.count || a.number - b.number)

/**
 * List: LF newest set first and cards by descending number; FT oldest set first and cards by count.
 * Value: cards by key, sets by their best card.
 */
function sortGroups(items: Item[], mode: SortMode, newestFirst: boolean, title: (id: ExpansionId) => string): TradeGroup[] {
  const bySet = [...Map.groupBy(items, (i) => i.expansion)].map(([id, setItems]) => {
    const sorted = setItems.toSorted(mode === 'value' ? (a, b) => b.key - a.key : listOrder)
    return { id, items: sorted, best: Math.max(...setItems.map((i) => i.key)) }
  })
  const order = (id: ExpansionId) => releaseOrder.get(id) ?? 0
  bySet.sort((a, b) => (mode === 'value' ? b.best - a.best : newestFirst ? order(b.id) - order(a.id) : order(a.id) - order(b.id)))
  return bySet.map((s) => ({ title: title(s.id), lines: s.items.map(({ name, count }) => ({ name, count })) }))
}

export default function PersonalTrade() {
  const { t, i18n } = useTranslation('common/sets')
  const { data: account } = useAccount()
  const { data: collection } = useCollection()
  const { data: trading, isLoading } = useTradingCards()
  const [rarity, setRarity] = useState<Rarity>('☆')
  const [mode, setMode] = useState<SortMode>('list')
  const [copied, setCopied] = useState<number | undefined>()

  const messages = useMemo(() => {
    if (!trading || !collection || !account) {
      return []
    }
    const keepByRarity = Object.fromEntries(account.trade_rarity_settings.map((s) => [s.rarity, s.to_keep]))
    const toItems = (ids: number[], forTrade: boolean): Item[] =>
      ids.flatMap((id) => {
        const card = getCardByInternalId(id)
        if (!card || card.rarity !== rarity) {
          return []
        }
        const row = collection.get(card.internal_id)
        const keep = row?.amount_wanted ?? keepByRarity[card.rarity] ?? defaultRaritySettings.to_keep
        return [
          {
            expansion: card.expansion,
            name: getCardNameByLang(card, i18n.language),
            number: cardNumber(card.card_id),
            count: forTrade ? (row?.amount_owned ?? 0) - keep : undefined,
            key: forTrade ? demandRatio(getCardValue(card.card_id)) : valueSortKey(card.card_id),
          },
        ]
      })
    const setName = (id: ExpansionId) => t(getExpansionById(id).name)
    return formatDiscordTradeList([
      { title: 'LF', groups: sortGroups(toItems(trading.wanted, false), mode, true, setName) },
      { title: 'FT', groups: sortGroups(toItems(trading.extra, true), mode, false, (id) => `${setName(id)} (${id})`) },
    ])
  }, [trading, collection, account, rarity, mode, i18n.language, t])

  const copy = async (i: number) => {
    await navigator.clipboard.writeText(messages[i])
    setCopied(i)
    setTimeout(() => setCopied(undefined), 1500)
  }

  const chip = (active: boolean) =>
    `px-3 py-1 rounded-full border text-sm ${active ? 'bg-neutral-200 text-neutral-900 border-neutral-200' : 'border-neutral-700'}`

  return (
    <div className="mx-auto max-w-[900px] px-4 pb-12">
      <section className="mb-10">
        <h2 className="text-xl text-center mb-2">Discord trade list</h2>
        <p className="text-sm text-neutral-400 text-center mb-4">
          Built from your keep/collect settings below, grouped by expansion. List: LF newest set first, FT oldest set first by copies. Value: LF by value, FT by
          demand. Split into messages under Discord's 2,000-character limit.
        </p>
        <div className="flex flex-wrap justify-center gap-2 mb-3">
          {RARITY_ORDER.filter((r) => (tradableRarities as readonly string[]).includes(r)).map((r) => (
            <button key={r} type="button" onClick={() => setRarity(r as Rarity)} className={chip(rarity === r)}>
              {r}
            </button>
          ))}
        </div>
        <div className="flex justify-center gap-2 mb-4">
          {(['list', 'value'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={chip(mode === m)}>
              {m === 'list' ? 'List' : 'Value'}
            </button>
          ))}
        </div>
        {isLoading && <Spinner size="md" />}
        {!isLoading && !account && <p className="text-center text-neutral-400">Log in to build your trade list.</p>}
        {account && messages.length === 0 && !isLoading && <p className="text-center text-neutral-400">Nothing to list for this rarity.</p>}
        <div className="flex flex-col gap-4">
          {messages.map((m, i) => (
            <div key={m} className="rounded-lg border border-neutral-700">
              <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-700 text-sm text-neutral-400">
                <span>
                  Message {i + 1} of {messages.length} · {m.length} chars
                </span>
                <Button size="sm" variant="secondary" onClick={() => copy(i)}>
                  {copied === i ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copied === i ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <pre className="whitespace-pre-wrap text-sm p-3 max-h-80 overflow-y-auto">{m}</pre>
            </div>
          ))}
        </div>
      </section>
      <TradeSettings />
    </div>
  )
}
