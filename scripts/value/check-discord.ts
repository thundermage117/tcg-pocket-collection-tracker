// Sanity check for frontend/src/lib/discordTradeList.ts:  pnpm tsx scripts/value/check-discord.ts
import assert from 'node:assert/strict'
import { DISCORD_LIMIT, formatDiscordTradeList, type TradeLine } from '../../frontend/src/lib/discordTradeList.ts'

const line = (i: number, rarity: string, count?: number): TradeLine => ({ name: `Card ${i}`, cardId: `A1-${i}`, rarity, count })

// Small list: one message, rarities ordered high -> low, ×N only for count > 1
const small = formatDiscordTradeList([
  { title: 'Looking for', lines: [line(1, '☆'), line(2, '☆☆')] },
  { title: 'For trade', lines: [line(3, '◊◊◊◊', 2), line(4, '◊◊◊◊', 1)] },
  { title: 'Empty', lines: [] },
])
assert.equal(small.length, 1)
assert.equal(
  small[0],
  ['**Looking for**', '__☆☆__', 'Card 2 — A1 #2', '__☆__', 'Card 1 — A1 #1', '', '**For trade**', '__◊◊◊◊__', 'Card 3 — A1 #3 ×2', 'Card 4 — A1 #4'].join('\n'),
)

// Large list: split into several messages, none over the limit, no lines lost
const big = formatDiscordTradeList([{ title: 'For trade', lines: Array.from({ length: 300 }, (_, i) => line(i, '◊◊◊', 3)) }])
assert.ok(big.length > 1)
assert.ok(big.every((m) => m.length <= DISCORD_LIMIT))
const allLines = big.join('\n').split('\n')
assert.equal(allLines.filter((l) => l.startsWith('Card ')).length, 300)

console.log(`ok: small list = 1 message, 300 cards = ${big.length} messages (max ${Math.max(...big.map((m) => m.length))} chars)`)
