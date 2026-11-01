import fs from 'node:fs'
import sharp from 'sharp'

// Personal fork: artwork for card forms (Alolan Vulpix, Mega Charizard X, Heat Rotom, …) for the Pokédex's form sections.
// Matches each form card name to a PokéAPI form, writes frontend/assets/form-sprites.json ({ "Alolan Vulpix": 10103 })
// and downloads the artwork to frontend/public/images/sprites/<PokéAPI id>.webp (form ids start at 10001, clear of dex numbers).
// Forms PokéAPI has no artwork for yet (new Megas) and Team Rocket's cards fall back to the species artwork.
// Rerun after a set adds forms: `tsx scripts/download-form-sprites.ts`.

const CARDS = 'frontend/assets/cards.json'
const TRANSLATIONS = 'frontend/assets/pokemon_translations.json'
const OUT_JSON = 'frontend/assets/form-sprites.json'
const OUT_DIR = 'frontend/public/images/sprites'
const DEX_SIZE = 1025
const SIZE = 256
const artworkUrl = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`

const regions: Record<string, string> = { alolan: 'alola', galarian: 'galar', hisuian: 'hisui', paldean: 'paldea' }
const skipWords = new Set(['forme', 'form', 'ex'])
// PokéAPI names these differently from the cards
const overrides: Record<string, string> = { 'Hisuian Basculin': 'basculin-white-striped' }

interface Form {
  id: number
  name: string
  pokemon_species_id: number
}

const dexNumbers = new Map(
  Object.keys(JSON.parse(fs.readFileSync(TRANSLATIONS, 'utf8')))
    .slice(0, DEX_SIZE)
    .map((key, i) => [key, i + 1]),
)

// Same rule as speciesKey in frontend/src/lib/pokedex.ts: the longest run of words that is a species, leading words dropped first
function splitName(name: string) {
  const words = name.toLowerCase().split(' ')
  for (let end = words.length; end > 0; end--) {
    for (let start = 0; start < end; start++) {
      const dexNr = dexNumbers.get(words.slice(start, end).join(' '))
      if (dexNr) {
        return { dexNr, extra: [...words.slice(0, start), ...words.slice(end)] }
      }
    }
  }
  return undefined
}

const response = await fetch('https://beta.pokeapi.co/graphql/v1beta', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: '{ p: pokemon_v2_pokemon(where: {id: {_gt: 10000}}) { id name pokemon_species_id } }' }),
})
if (!response.ok) {
  throw new Error(`PokéAPI responded ${response.status}`)
}
const forms = ((await response.json()) as { data: { p: Form[] } }).data.p.filter((f) => !/-(gmax|totem)/.test(f.name))

const cards = JSON.parse(fs.readFileSync(CARDS, 'utf8')) as { name: string; card_type: string }[]
const formNames = [...new Set(cards.filter((c) => c.card_type === 'pokémon').map((c) => c.name.replace(/ ex$/, '')))].sort()

const mapping: Record<string, number> = {}
const unmatched: string[] = []
for (const name of formNames) {
  const split = splitName(name)
  if (!split || split.extra.length === 0 || name.startsWith("Team Rocket's")) {
    continue
  }
  const extra = split.extra.filter((w) => !skipWords.has(w)).map((w) => regions[w] ?? w)
  const ofSpecies = forms.filter((f) => f.pokemon_species_id === split.dexNr)
  const has = (f: Form, words: string[]) => words.every((w) => f.name.split('-').includes(w))
  // every extra word (mega + x), else just the first (Dusk Mane → necrozma-dusk)
  const form = overrides[name]
    ? forms.find((f) => f.name === overrides[name])
    : (ofSpecies.find((f) => has(f, extra)) ?? ofSpecies.find((f) => has(f, extra.slice(0, 1))))
  if (form) {
    mapping[name] = form.id
  } else {
    unmatched.push(name)
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true })
const failed: number[] = []
for (const id of new Set(Object.values(mapping))) {
  if (fs.existsSync(`${OUT_DIR}/${id}.webp`)) {
    continue
  }
  const art = await fetch(artworkUrl(id))
  if (!art.ok) {
    failed.push(id)
    continue
  }
  await sharp(Buffer.from(await art.arrayBuffer()))
    .resize(SIZE, SIZE, { fit: 'inside' })
    .webp({ quality: 80 })
    .toFile(`${OUT_DIR}/${id}.webp`)
}
// a form whose artwork failed to download falls back to the species artwork
for (const [name, id] of Object.entries(mapping)) {
  if (failed.includes(id)) {
    delete mapping[name]
  }
}

fs.writeFileSync(OUT_JSON, `${JSON.stringify(mapping)}\n`)
console.log(`Mapped ${Object.keys(mapping).length} forms; no PokéAPI form (species artwork): ${unmatched.join(', ') || 'none'}`)
if (failed.length > 0) {
  console.log(`No artwork for PokéAPI ids: ${failed.join(', ')}`)
}
