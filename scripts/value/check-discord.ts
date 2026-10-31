// Sanity check for frontend/src/lib/discordTradeList.ts:  pnpm tsx scripts/value/check-discord.ts
import assert from 'node:assert/strict'
import { DISCORD_LIMIT, formatDiscordTradeList, type TradeGroup } from '../../frontend/src/lib/discordTradeList.ts'

const group = (title: string, names: string[], counts?: number[]): TradeGroup => ({
  title,
  lines: names.map((name, i) => ({ name, count: counts?.[i] })),
})

// Small list: one message, LF without counts, FT with ×N (including ×1), empty groups/sections dropped
const small = formatDiscordTradeList([
  {
    title: 'LF',
    groups: [group('Ruler of the Skies', ['Cyclizar', 'Dragonair', 'Accelgor']), group('Empty', []), group('Space-Time Smackdown', ['Mamoswine', 'Tangrowth'])],
  },
  {
    title: 'FT',
    groups: [group('Mythical Island (A1a)', ['Dedenne', 'Salandit'], [1, 1]), group('Deluxe Pack: ex (A4b)', ['Floragato', "Farfetch'd"], [10, 7])],
  },
  { title: 'Nothing', groups: [group('Empty', [])] },
])
assert.equal(small.length, 1)
assert.equal(
  small[0],
  [
    'LF',
    '',
    'Ruler of the Skies',
    'Cyclizar',
    'Dragonair',
    'Accelgor',
    '',
    'Space-Time Smackdown',
    'Mamoswine',
    'Tangrowth',
    '',
    '',
    'FT',
    '',
    'Mythical Island (A1a)',
    'Dedenne ×1',
    'Salandit ×1',
    '',
    'Deluxe Pack: ex (A4b)',
    'Floragato ×10',
    "Farfetch'd ×7",
  ].join('\n'),
)

// Many groups: several messages, none over the limit, no group split, continued messages repeat the section title
const names = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => `${prefix} card ${i}`)
const many = formatDiscordTradeList([
  { title: 'FT', groups: Array.from({ length: 40 }, (_, i) => group(`Set ${i} (X${i})`, names(6, `Set ${i}`), Array(6).fill(2))) },
])
assert.ok(many.length > 1)
assert.ok(many.every((m) => m.length <= DISCORD_LIMIT))
assert.ok(many.every((m) => m.startsWith('FT\n\nSet ')))
for (let i = 0; i < 40; i++) {
  assert.equal(many.filter((m) => m.includes(`Set ${i} (X${i})`)).length, 1)
  assert.equal(many.filter((m) => m.includes(`Set ${i} card 5 ×2`)).length, 1, `set ${i} split across messages`)
}

// One group over the limit on its own: split by line, nothing lost
const huge = formatDiscordTradeList([{ title: 'FT', groups: [group('Huge (H)', names(300, 'Huge'), Array(300).fill(3))] }])
assert.ok(huge.length > 1)
assert.ok(huge.every((m) => m.length <= DISCORD_LIMIT))
assert.equal(
  huge
    .join('\n')
    .split('\n')
    .filter((l) => l.startsWith('Huge card ')).length,
  300,
)

console.log(`ok: small list = 1 message, 40 sets = ${many.length} messages, 300-card set = ${huge.length} messages`)
