import fs from 'node:fs'

// Personal fork: writes frontend/assets/species-groups.json, the dex numbers in each Pokédex group filter.
// Shape: { legendary: number[], mythical: number[] }, from PokéAPI's species flags (a species is never both).
// Groups only change with a new generation, so rerun by hand: `tsx scripts/generate-species-groups.ts`.

const OUT_PATH = 'frontend/assets/species-groups.json'
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

const groups = { legendary: data.legendary.map((s) => s.id), mythical: data.mythical.map((s) => s.id) }
fs.writeFileSync(OUT_PATH, `${JSON.stringify(groups)}\n`)
console.log(`Wrote ${groups.legendary.length} legendary and ${groups.mythical.length} mythical species to ${OUT_PATH}`)
