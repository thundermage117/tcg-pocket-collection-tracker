// Personal fork: format "Looking for" / "For trade" lists as Discord messages.
// Pure (no app imports) so it can be checked in isolation: see scripts/value/check-discord.ts.

export const DISCORD_LIMIT = 2000

export interface TradeLine {
  name: string
  cardId: string // e.g. "A1-266"
  rarity: string
  count?: number // spare copies, shown as ×N when > 1
}

export interface TradeSection {
  title: string
  lines: TradeLine[] // already sorted within each rarity
}

// Highest rarity first
export const RARITY_ORDER = ['✵✵', '✵', '☆☆', '☆', '◊◊◊◊', '◊◊◊', '◊◊', '◊']

function formatLine(line: TradeLine) {
  const [set, number] = line.cardId.split('-')
  return `${line.name} — ${set} #${number}${line.count && line.count > 1 ? ` ×${line.count}` : ''}`
}

/** Returns one or more messages, each at most `limit` characters. */
export function formatDiscordTradeList(sections: TradeSection[], limit = DISCORD_LIMIT): string[] {
  const lines: string[] = []
  for (const section of sections) {
    if (section.lines.length === 0) {
      continue
    }
    if (lines.length) {
      lines.push('')
    }
    lines.push(`**${section.title}**`)
    const byRarity = Map.groupBy(section.lines, (l) => l.rarity)
    const rarities = [...byRarity.keys()].sort((a, b) => rank(a) - rank(b))
    for (const rarity of rarities) {
      lines.push(`__${rarity}__`)
      for (const line of byRarity.get(rarity) ?? []) {
        lines.push(formatLine(line))
      }
    }
  }
  return chunk(lines, limit)
}

function rank(rarity: string) {
  const i = RARITY_ORDER.indexOf(rarity)
  return i === -1 ? RARITY_ORDER.length : i
}

function chunk(lines: string[], limit: number): string[] {
  const messages: string[] = []
  let current = ''
  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line
    if (next.length > limit && current) {
      messages.push(current)
      current = line.slice(0, limit)
    } else {
      current = next.slice(0, limit)
    }
  }
  if (current.trim()) {
    messages.push(current)
  }
  return messages
}
