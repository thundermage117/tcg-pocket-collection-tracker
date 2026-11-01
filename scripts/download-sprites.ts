import fs from 'node:fs'
import sharp from 'sharp'

// Personal fork: downloads official artwork for every species into frontend/public/images/sprites/<dexNr>.webp for the Pokédex.
// Source is the PokeAPI/sprites repo; resized to 256px WebP so all 1025 stay small. Existing files are skipped,
// so rerunning after a new generation only fetches the new ones: `tsx scripts/download-sprites.ts`.

const OUT_DIR = 'frontend/public/images/sprites'
const DEX_SIZE = 1025
const SIZE = 256
const CONCURRENCY = 16
const url = (dexNr: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${dexNr}.png`

fs.mkdirSync(OUT_DIR, { recursive: true })
const todo = Array.from({ length: DEX_SIZE }, (_, i) => i + 1).filter((nr) => !fs.existsSync(`${OUT_DIR}/${nr}.webp`))
const failed: number[] = []

async function download(dexNr: number) {
  const response = await fetch(url(dexNr))
  if (!response.ok) {
    failed.push(dexNr)
    return
  }
  const png = Buffer.from(await response.arrayBuffer())
  await sharp(png).resize(SIZE, SIZE, { fit: 'inside' }).webp({ quality: 80 }).toFile(`${OUT_DIR}/${dexNr}.webp`)
}

for (let i = 0; i < todo.length; i += CONCURRENCY) {
  await Promise.all(todo.slice(i, i + CONCURRENCY).map(download))
}
console.log(`Downloaded ${todo.length - failed.length} sprites to ${OUT_DIR}${failed.length > 0 ? `; failed: ${failed.join(', ')}` : ''}`)
