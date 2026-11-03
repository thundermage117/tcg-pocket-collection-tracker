import fs from 'node:fs'

// Personal fork: writes frontend/public/pokedex/<locale>.json, the Pokédex entry (category, flavor text, height, weight) per species.
// One file per app locale so a species page fetches only its language; missing translations fall back to English
// (pt-BR has none on PokéAPI). Forms with artwork (frontend/assets/form-sprites.json) get an entry under their PokéAPI id with
// their own height and weight. PokéAPI keeps flavor text per species, so a form's comes from pokemondb.net (its newest entry
// under the form's heading, English only, so every locale gets English) and is empty where pokemondb has none (Ogerpon's masks).
// The category stays the species'.
// Entries only change with a new generation or new forms, so rerun by hand (after download-form-sprites): `tsx scripts/generate-dex-entries.ts`.

const OUT_DIR = 'frontend/public/pokedex'
const FORM_SPRITES = 'frontend/assets/form-sprites.json'
const POKEMONDB = 'https://pokemondb.net/pokedex'
const CRAWL_DELAY = 2000 // pokemondb's robots.txt
// card form name → pokemondb heading, where the words don't overlap
const formHeadings: Record<string, string> = { 'Hisuian Basculin': 'White-Striped Form', 'Paldean Tauros': 'Combat Breed' } // Tauros: the artwork (10250) is the Combat Breed
const DEX_SIZE = 1025
const BATCH = 150
const locales: Record<string, string | undefined> = { 'en-US': 'en' } // English only
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

interface FormRow {
  id: number
  species: number
  speciesName: { name: string } // PokéAPI's slug, which pokemondb's URLs share (mr-mime, nidoran-f)
  height: number
  weight: number
}

async function fetchForms(ids: number[]): Promise<FormRow[]> {
  const query = `{ p: pokemon_v2_pokemon(where: {id: {_in: ${JSON.stringify(ids)}}}) { id species: pokemon_species_id speciesName: pokemon_v2_pokemonspecy { name } height weight } }`
  const response = await fetch('https://beta.pokeapi.co/graphql/v1beta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (!response.ok) {
    throw new Error(`PokéAPI responded ${response.status}`)
  }
  return ((await response.json()) as { data: { p: FormRow[] } }).data.p
}

const decode = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&eacute;/g, 'é')
    .replace(/&rsquo;/g, '’')
    .replace(/&mdash;/g, '—')
    .replace(/&amp;/g, '&')

/** A species page's Pokédex entries by heading (Vulpix, Alolan Vulpix, Mega Charizard X), newest game last. */
async function fetchPokemondbEntries(slug: string): Promise<Map<string, string[]>> {
  const response = await fetch(`${POKEMONDB}/${slug}`, { headers: { 'User-Agent': 'tcg-pocket-collection-tracker (personal Pokédex)' } })
  if (!response.ok) {
    throw new Error(`pokemondb responded ${response.status} for ${slug}`)
  }
  const html = await response.text()
  const start = html.indexOf('<h2>Pokédex entries</h2>')
  const section = start === -1 ? '' : html.slice(start, html.indexOf('<h2>', start + 1))
  const entries = new Map<string, string[]>()
  for (const [, heading, table] of section.matchAll(/<h3>([^<]*)<\/h3>(.*?)<\/table>/gs)) {
    entries.set(
      decode(heading).trim(),
      [...table.matchAll(/<td class="cell-med-text">(.*?)<\/td>/gs)].map(([, text]) => decode(text)),
    )
  }
  return entries
}

const words = (text: string) => new Set(text.toLowerCase().split(/[\s-]+/))
const ignoredWords = new Set(['form', 'forme', 'style'])

/** The heading for a card form: named in formHeadings, or the one sharing the most words beyond the species name (no Gigantamax). */
function formHeading(formName: string, speciesHeading: string, headings: string[]) {
  if (formHeadings[formName]) {
    return formHeadings[formName]
  }
  const formWords = [...words(formName)].filter((w) => !words(speciesHeading).has(w) && !ignoredWords.has(w))
  const scored = headings
    .filter((h) => h !== speciesHeading && !h.startsWith('Gigantamax'))
    .map((h) => ({ h, score: formWords.filter((w) => words(h).has(w)).length }))
    .sort((a, b) => b.score - a.score)
  return scored[0]?.score > 0 ? scored[0].h : undefined
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

const formIds = [...new Set(Object.values(JSON.parse(fs.readFileSync(FORM_SPRITES, 'utf8')) as Record<string, number>))]
const forms = await fetchForms(formIds)

// one page per species with forms, a crawl delay apart
const formNames = new Map<number, string[]>()
for (const [name, id] of Object.entries(JSON.parse(fs.readFileSync(FORM_SPRITES, 'utf8')) as Record<string, number>)) {
  formNames.set(id, [...(formNames.get(id) ?? []), name])
}
const formFlavor = new Map<number, string>()
const pages = new Map<string, Map<string, string[]>>()
const missing: string[] = []
for (const form of forms) {
  const slug = form.speciesName.name
  if (!pages.has(slug)) {
    if (pages.size > 0) {
      await new Promise((r) => setTimeout(r, CRAWL_DELAY))
    }
    pages.set(slug, await fetchPokemondbEntries(slug))
  }
  const page = pages.get(slug) as Map<string, string[]>
  const headings = [...page.keys()]
  for (const name of formNames.get(form.id) ?? []) {
    const heading = formHeading(name, headings[0] ?? '', headings)
    const text = heading && page.get(heading)?.at(-1)
    if (text) {
      formFlavor.set(form.id, clean(text))
    } else {
      missing.push(name)
    }
  }
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
  for (const form of forms) {
    entries[form.id] = { ...entries[form.species], f: formFlavor.get(form.id) ?? '', h: form.height, w: form.weight }
  }
  fs.writeFileSync(`${OUT_DIR}/${locale}.json`, `${JSON.stringify(entries)}\n`)
}
console.log(`No pokemondb entry for: ${missing.join(', ') || 'none'}`)
console.log(
  `Wrote ${rows.length} species and ${forms.length} form entries (${formFlavor.size} with flavor text) for ${Object.keys(locales).length} locales to ${OUT_DIR}`,
)
