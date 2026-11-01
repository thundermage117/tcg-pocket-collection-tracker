import fs from 'node:fs'

// Personal fork: writes frontend/assets/evolutions.json for the Pokédex's evolution lines.
// Shape: { [dexNr]: dexNr it evolves from }, species level (Galarian Linoone → Obstagoon is just Linoone → Obstagoon).
// Evolutions only change when a new generation adds them, so rerun by hand: `tsx scripts/generate-evolutions.ts`.

const OUT_PATH = 'frontend/assets/evolutions.json'
const QUERY = '{ pokemon_v2_pokemonspecies(where: {evolves_from_species_id: {_is_null: false}}, order_by: {id: asc}) { id evolves_from_species_id } }'

const response = await fetch('https://beta.pokeapi.co/graphql/v1beta', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: QUERY }),
})
if (!response.ok) {
  throw new Error(`PokéAPI responded ${response.status}`)
}
const { data } = (await response.json()) as { data: { pokemon_v2_pokemonspecies: { id: number; evolves_from_species_id: number }[] } }

const evolvesFrom = Object.fromEntries(data.pokemon_v2_pokemonspecies.map((s) => [s.id, s.evolves_from_species_id]))
fs.writeFileSync(OUT_PATH, `${JSON.stringify(evolvesFrom)}\n`)
console.log(`Wrote ${Object.keys(evolvesFrom).length} evolutions to ${OUT_PATH}`)
