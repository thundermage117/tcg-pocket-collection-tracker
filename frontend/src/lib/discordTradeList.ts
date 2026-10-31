// Personal fork: format "LF" / "FT" lists as Discord messages, grouped by expansion.
// Pure (no app imports) so it can be checked in isolation: see scripts/value/check-discord.ts.

export const DISCORD_LIMIT = 2000

export interface TradeLine {
  name: string
  count?: number // shown as ×N when set
}

export interface TradeGroup {
  title: string // e.g. "Pulsing Aura" or "Mythical Island (A1a)"
  lines: TradeLine[] // already in display order
}

export interface TradeSection {
  title: string // e.g. "LF"
  groups: TradeGroup[] // already in display order
}

// Highest rarity first
export const RARITY_ORDER = ['✵✵', '✵', '☆☆', '☆', '◊◊◊◊', '◊◊◊', '◊◊', '◊']

function formatLine(line: TradeLine) {
  return line.count === undefined ? line.name : `${line.name} ×${line.count}`
}

/**
 * Returns one or more messages, each at most `limit` characters. A group is only split across
 * messages when it alone is over the limit; a message that continues a section repeats its title.
 */
export function formatDiscordTradeList(sections: TradeSection[], limit = DISCORD_LIMIT): string[] {
  const messages: string[] = []
  let current = ''
  for (const section of sections) {
    const groups = section.groups.filter((g) => g.lines.length > 0)
    groups.forEach((group, i) => {
      const block = [group.title, ...group.lines.map(formatLine)].join('\n')
      const next = i === 0 ? `${current ? `${current}\n\n\n` : ''}${section.title}\n\n${block}` : `${current}\n\n${block}`
      if (next.length <= limit) {
        current = next
        return
      }
      if (current) {
        messages.push(current)
      }
      const pieces = splitLines(`${section.title}\n\n${block}`, limit)
      messages.push(...pieces.slice(0, -1))
      current = pieces.at(-1) ?? ''
    })
  }
  if (current.trim()) {
    messages.push(current)
  }
  return messages
}

function splitLines(text: string, limit: number): string[] {
  const pieces: string[] = []
  let current = ''
  for (const line of text.split('\n')) {
    const next = current ? `${current}\n${line}` : line
    if (next.length > limit && current) {
      pieces.push(current)
      current = line.slice(0, limit)
    } else {
      current = next.slice(0, limit)
    }
  }
  pieces.push(current)
  return pieces
}
