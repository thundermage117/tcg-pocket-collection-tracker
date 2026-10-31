// Personal fork: the filtered LF / FT lists as copy-paste Discord messages.
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { getExpansionById } from '@/lib/CardsDB'
import { formatDiscordTradeList, type TradeGroup } from '@/lib/discordTradeList'
import type { ExpansionId } from '@/types'
import type { SetGroup } from '../tradeGroups'

export function useDiscordMessages(lf: SetGroup[], ft: SetGroup[]): string[] {
  const { t } = useTranslation('common/sets')
  const setName = (id: ExpansionId) => t(getExpansionById(id).name)
  const toGroups = (groups: SetGroup[], title: (id: ExpansionId) => string): TradeGroup[] =>
    groups.map((g) => ({ title: title(g.id), lines: g.items.map(({ name, count }) => ({ name, count })) }))
  return formatDiscordTradeList([
    { title: 'LF', groups: toGroups(lf, setName) },
    { title: 'FT', groups: toGroups(ft, (id) => `${setName(id)} (${id})`) },
  ])
}

export function DiscordExport({ messages }: { messages: string[] }) {
  const [copied, setCopied] = useState<number | undefined>()

  const copy = async (i: number) => {
    await navigator.clipboard.writeText(messages[i])
    setCopied(i)
    setTimeout(() => setCopied(undefined), 1500)
  }

  if (messages.length === 0) {
    return <p className="text-sm text-neutral-400">Nothing to list with these filters.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-neutral-500">Uses the filters above. Split into messages under Discord's 2,000-character limit.</p>
      {messages.map((m, i) => (
        <div key={m} className="rounded-lg border border-neutral-700">
          <div className="flex items-center justify-between border-b border-neutral-700 px-3 py-2 text-sm text-neutral-400">
            <span>
              Message {i + 1} of {messages.length} · {m.length} chars
            </span>
            <Button size="sm" variant="secondary" onClick={() => copy(i)}>
              {copied === i ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied === i ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap p-3 text-sm">{m}</pre>
        </div>
      ))}
    </div>
  )
}
