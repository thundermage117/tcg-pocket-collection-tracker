import fs from 'node:fs'
import * as cheerio from 'cheerio'

// Personal fork: fills in `evolves_from` on Stage 1 / Stage 2 cards in cards.json that don't have it yet: cards scraped
// before scraper.ts recorded it, and Promo-B cards from backfill-promo-b.ts (Serebii has no "Evolves from").
// A card takes the value from another printing of the same name (an ex evolves like its plain card); names no printing
// has yet are read from one card's Limitless page ("Pokémon - Stage 1 - Evolves from Alolan Vulpix").
// Run after the scrapers: `tsx scripts/backfill-evolves-from.ts && pnpm lint:fix`.

const BASE_URL = 'https://pocket.limitlesstcg.com'
const CARDS_JSON = 'frontend/assets/cards.json'
const CONCURRENCY = 8

interface CardRow {
  card_id: string
  name: string
  evolution_type: string
  evolves_from?: string
  [key: string]: unknown
}

const baseName = (name: string) => name.replace(/ ex$/, '')
const evolves = (card: CardRow) => card.evolution_type === 'stage1' || card.evolution_type === 'stage2'

const cards = JSON.parse(fs.readFileSync(CARDS_JSON, 'utf8')) as CardRow[]
const known = new Map(cards.flatMap((c) => (c.evolves_from ? [[baseName(c.name), c.evolves_from] as const] : [])))

// one Limitless page per name nothing knows yet; card_id is "<expansion>-<number>" (P-A-5 for promos)
const todo = new Map<string, string>()
for (const card of cards) {
  const name = baseName(card.name)
  if (evolves(card) && !card.evolves_from && !known.has(name) && !todo.has(name)) {
    todo.set(name, card.card_id)
  }
}

const failed: string[] = []
async function fetchEvolvesFrom(name: string, cardId: string) {
  const split = cardId.lastIndexOf('-')
  const url = `${BASE_URL}/cards/${cardId.slice(0, split)}/${cardId.slice(split + 1)}`
  const response = await fetch(url)
  // the page breaks the line after "Evolves from"
  const typeLine = response.ok
    ? cheerio
        .load(await response.text())('p.card-text-type')
        .text()
        .replace(/\s+/g, ' ')
        .trim()
    : ''
  const match = /Evolves from (.+)$/.exec(typeLine)
  if (match) {
    known.set(name, baseName(match[1].trim()))
  } else {
    failed.push(`${name} (${url})`)
  }
}

const entries = [...todo]
for (let i = 0; i < entries.length; i += CONCURRENCY) {
  await Promise.all(entries.slice(i, i + CONCURRENCY).map(([name, cardId]) => fetchEvolvesFrom(name, cardId)))
}

// rebuilt so evolves_from sits right after evolution_type, where scraper.ts puts it
let filled = 0
const updated = cards.map((card) => {
  const evolvesFrom = known.get(baseName(card.name))
  if (!evolves(card) || card.evolves_from || !evolvesFrom) {
    return card
  }
  filled++
  return Object.fromEntries(
    Object.entries(card).flatMap(([key, value]) =>
      key === 'evolution_type'
        ? [
            [key, value],
            ['evolves_from', evolvesFrom],
          ]
        : [[key, value]],
    ),
  )
})

fs.writeFileSync(CARDS_JSON, JSON.stringify(updated, null, 2))
console.log(`Filled evolves_from on ${filled} cards (${todo.size - failed.length} names read from Limitless)`)
if (failed.length > 0) {
  console.log(`No "Evolves from" for: ${failed.join(', ')}`)
}
