import fs from 'node:fs'
import sharp from 'sharp'

// Personal fork: downloads official artwork for every species into frontend/public/images/sprites/<dexNr>.webp for the Pokédex,
// and the shiny artwork into sprites/shiny/<dexNr>.webp for the Shiny Pokédex.
// Source is the PokeAPI/sprites repo; resized to 256px WebP so all 1025 stay small. Existing files are skipped,
// so rerunning after a new generation only fetches the new ones: `tsx scripts/download-sprites.ts`.

const OUT_DIR = 'frontend/public/images/sprites'
const DEX_SIZE = 1025
const SIZE = 256
const CONCURRENCY = 16
const ARTWORK = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork'
const variants = [
  { dir: OUT_DIR, url: (dexNr: number) => `${ARTWORK}/${dexNr}.png` },
  { dir: `${OUT_DIR}/shiny`, url: (dexNr: number) => `${ARTWORK}/shiny/${dexNr}.png` },
]

for (const { dir, url } of variants) {
  fs.mkdirSync(dir, { recursive: true })
  const todo = Array.from({ length: DEX_SIZE }, (_, i) => i + 1).filter((nr) => !fs.existsSync(`${dir}/${nr}.webp`))
  const failed: number[] = []

  const download = async (dexNr: number) => {
    const response = await fetch(url(dexNr))
    if (!response.ok) {
      failed.push(dexNr)
      return
    }
    const png = Buffer.from(await response.arrayBuffer())
    await sharp(png).resize(SIZE, SIZE, { fit: 'inside' }).webp({ quality: 80 }).toFile(`${dir}/${dexNr}.webp`)
  }

  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    await Promise.all(todo.slice(i, i + CONCURRENCY).map(download))
  }
  console.log(`Downloaded ${todo.length - failed.length} sprites to ${dir}${failed.length > 0 ? `; failed: ${failed.join(', ')}` : ''}`)
}
