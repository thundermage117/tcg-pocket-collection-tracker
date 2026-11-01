import fs from 'node:fs'

// Personal fork: writes frontend/assets/species-groups.json, the dex numbers in each Pokédex group filter.
// Shape: { legendary: number[], mythical: number[], starter: number[] }. Legendary / mythical are PokéAPI's species flags;
// starters are the three starter lines of each generation, which PokéAPI doesn't flag. A species is in at most one group.
// Groups only change with a new generation, so rerun by hand: `tsx scripts/generate-species-groups.ts`.

const OUT_PATH = 'frontend/assets/species-groups.json'
// each generation's starters and their evolutions are nine dex numbers in a row, starting at these
const STARTER_LINES_FROM = [1, 152, 252, 387, 495, 650, 722, 810, 906]
const QUERY = `{
  legendary: pokemon_v2_pokemonspecies(where: {is_legendary: {_eq: true}}, order_by: {id: asc}) { id }
  mythical: pokemon_v2_pokemonspecies(where: {is_mythical: {_eq: true}}, order_by: {id: asc}) { id }
}`

const response = await fetch('https://beta.pokeapi.co/graphql/v1beta', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: QUERY }),
})
if (!response.ok) {
  throw new Error(`PokéAPI responded ${response.status}`)
}
const { data } = (await response.json()) as { data: Record<'legendary' | 'mythical', { id: number }[]> }

const groups = {
  legendary: data.legendary.map((s) => s.id),
  mythical: data.mythical.map((s) => s.id),
  starter: STARTER_LINES_FROM.flatMap((first) => Array.from({ length: 9 }, (_, i) => first + i)),
}
fs.writeFileSync(OUT_PATH, `${JSON.stringify(groups)}\n`)
console.log(`Wrote ${groups.legendary.length} legendary, ${groups.mythical.length} mythical and ${groups.starter.length} starter species to ${OUT_PATH}`)
