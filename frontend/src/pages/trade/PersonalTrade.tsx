// Personal fork: trade settings + copy-paste Discord lists (replaces upstream's offers/matches tabs).
import { Check, Copy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Spinner } from '@/components/Spinner'
import { Button } from '@/components/ui/button'
import { getCardByInternalId } from '@/lib/CardsDB'
import { formatDiscordTradeList, RARITY_ORDER, type TradeLine } from '@/lib/discordTradeList'
import { getCardNameByLang } from '@/lib/utils'
import { demandRatio, getCardValue, valueSortKey } from '@/lib/ValueDB'
import TradeSettings from '@/pages/trade/TradeSettings.tsx'
import { useAccount } from '@/services/account/useAccount'
import { useCollection, useTradingCards } from '@/services/collection/useCollection'
import { defaultRaritySettings, type Rarity, tradableRarities } from '@/types'

export default function PersonalTrade() {
  const { i18n } = useTranslation()
  const { data: account } = useAccount()
  const { data: collection } = useCollection()
  const { data: trading, isLoading } = useTradingCards()
  const [rarities, setRarities] = useState<Rarity[]>(['☆☆', '☆', '◊◊◊◊'])
  const [copied, setCopied] = useState<number | undefined>()

  const messages = useMemo(() => {
    if (!trading || !collection || !account) {
      return []
    }
    const keepByRarity = Object.fromEntries(account.trade_rarity_settings.map((s) => [s.rarity, s.to_keep]))
    const toLines = (ids: number[], withCount: boolean): TradeLine[] =>
      ids.flatMap((id) => {
        const card = getCardByInternalId(id)
        if (!card || !rarities.includes(card.rarity)) {
          return []
        }
        const row = collection.get(card.internal_id)
        const keep = row?.amount_wanted ?? keepByRarity[card.rarity] ?? defaultRaritySettings.to_keep
        return [
          {
            name: getCardNameByLang(card, i18n.language),
            cardId: card.card_id,
            rarity: card.rarity,
            count: withCount ? (row?.amount_owned ?? 0) - keep : undefined,
          },
        ]
      })
    const wanted = toLines(trading.wanted, false).toSorted((a, b) => valueSortKey(b.cardId) - valueSortKey(a.cardId))
    const extra = toLines(trading.extra, true).toSorted((a, b) => demandRatio(getCardValue(b.cardId)) - demandRatio(getCardValue(a.cardId)))
    return formatDiscordTradeList([
      { title: '🔎 Looking for', lines: wanted },
      { title: '🔁 For trade', lines: extra },
    ])
  }, [trading, collection, account, rarities, i18n.language])

  const copy = async (i: number) => {
    await navigator.clipboard.writeText(messages[i])
    setCopied(i)
    setTimeout(() => setCopied(undefined), 1500)
  }

  const toggle = (r: Rarity) => setRarities((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]))

  return (
    <div className="mx-auto max-w-[900px] px-4 pb-12">
      <section className="mb-10">
        <h2 className="text-xl text-center mb-2">Discord trade list</h2>
        <p className="text-sm text-neutral-400 text-center mb-4">
          Built from your keep/collect settings below. Looking for = sorted by value, For trade = sorted by demand. Split into messages under Discord's
          2,000-character limit.
        </p>
        <div className="flex flex-wrap justify-center gap-2 mb-4">
          {RARITY_ORDER.filter((r) => (tradableRarities as readonly string[]).includes(r)).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => toggle(r as Rarity)}
              className={`px-3 py-1 rounded-full border text-sm ${rarities.includes(r as Rarity) ? 'bg-neutral-200 text-neutral-900 border-neutral-200' : 'border-neutral-700'}`}
            >
              {r}
            </button>
          ))}
        </div>
        {isLoading && <Spinner size="md" />}
        {!isLoading && !account && <p className="text-center text-neutral-400">Log in to build your trade list.</p>}
        {account && messages.length === 0 && !isLoading && <p className="text-center text-neutral-400">Nothing to list for these rarities.</p>}
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
