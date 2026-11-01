import fs from 'node:fs'

// Personal fork: writes frontend/public/pokedex/<locale>.json, the Pokédex entry (category, flavor text, height, weight) per species.
// One file per app locale so a species page fetches only its language; missing translations fall back to English
// (pt-BR has none on PokéAPI). Entries only change with a new generation, so rerun by hand: `tsx scripts/generate-dex-entries.ts`.

const OUT_DIR = 'frontend/public/pokedex'
const DEX_SIZE = 1025
const BATCH = 150
const locales: Record<string, string | undefined> = { 'en-US': 'en', 'es-ES': 'es', 'pt-BR': undefined, 'fr-FR': 'fr', 'it-IT': 'it', 'de-DE': 'de' }
const apiLanguages = Object.values(locales).filter((l) => l !== undefined)

interface SpeciesRow {
  id: number
  names: { genus: string; lang: { name: string } }[]
  texts: { flavor_text: string; lang: { name: string } }[] // newest game first
  pokemon: { height: number; weight: number }[]
}

// g: category ("Seed Pokémon"), f: flavor text, h: height in decimetres, w: weight in hectograms (PokéAPI units)
export interface DexEntry {
  g: string
  f: string
  h: number
  w: number
}

async function fetchBatch(first: number, last: number): Promise<SpeciesRow[]> {
  const langFilter = `{pokemon_v2_language: {name: {_in: ${JSON.stringify(apiLanguages)}}}}`
  const query = `{ s: pokemon_v2_pokemonspecies(where: {id: {_gte: ${first}, _lte: ${last}}}, order_by: {id: asc}) {
    id
    names: pokemon_v2_pokemonspeciesnames(where: ${langFilter}) { genus lang: pokemon_v2_language { name } }
    texts: pokemon_v2_pokemonspeciesflavortexts(where: ${langFilter}, order_by: {version_id: desc}) { flavor_text lang: pokemon_v2_language { name } }
    pokemon: pokemon_v2_pokemons(where: {is_default: {_eq: true}}) { height weight }
  } }`
  const response = await fetch('https://beta.pokeapi.co/graphql/v1beta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (!response.ok) {
    throw new Error(`PokéAPI responded ${response.status}`)
  }
  const body = (await response.json()) as { data?: { s: SpeciesRow[] }; errors?: unknown }
  if (!body.data) {
    throw new Error(`PokéAPI query failed: ${JSON.stringify(body.errors)}`)
  }
  return body.data.s
}

// Game text keeps the cartridge's line breaks, form feeds and soft hyphens
const clean = (text: string) =>
  text
    .replace(/­\n/g, '')
    .replace(/[\n\f­]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const rows: SpeciesRow[] = []
for (let first = 1; first <= DEX_SIZE; first += BATCH) {
  rows.push(...(await fetchBatch(first, Math.min(first + BATCH - 1, DEX_SIZE))))
}

fs.mkdirSync(OUT_DIR, { recursive: true })
for (const [locale, lang] of Object.entries(locales)) {
  const entries: Record<number, DexEntry> = {}
  for (const row of rows) {
    const genus = (l: string | undefined) => row.names.find((n) => n.lang.name === l)?.genus
    const text = (l: string | undefined) => row.texts.find((t) => t.lang.name === l)?.flavor_text
    entries[row.id] = {
      g: genus(lang) || genus('en') || '',
      f: clean(text(lang) || text('en') || ''),
      h: row.pokemon[0]?.height ?? 0,
      w: row.pokemon[0]?.weight ?? 0,
    }
  }
  fs.writeFileSync(`${OUT_DIR}/${locale}.json`, `${JSON.stringify(entries)}\n`)
}
console.log(`Wrote ${rows.length} entries for ${Object.keys(locales).length} locales to ${OUT_DIR}`)
