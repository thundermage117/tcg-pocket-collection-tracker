import fs from 'node:fs'
import sharp from 'sharp'

// Personal fork: downloads official artwork for every species into frontend/public/images/sprites/<dexNr>.webp for the Pokédex,
// and the shiny artwork into sprites/shiny/<dexNr>.webp for the Shiny Pokédex.
// Source is the PokeAPI/sprites repo; resized to 256px WebP so all 1025 stay small. Existing files are skipped,
// so rerunning after a new generation only fetches the new ones: `tsx scripts/download-sprites.ts`.
// The species page's hero is up to 320px wide (640 device px on a 2× screen), where 256px reads blurry, so each artwork is
// also kept at the source's native 475px in sprites/large/ (and large/shiny/), loaded by the hero only.

const OUT_DIR = 'frontend/public/images/sprites'
const DEX_SIZE = 1025
const CONCURRENCY = 16
const ARTWORK = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork'
const SIZES = [
  { size: 256, dir: OUT_DIR },
  { size: 475, dir: `${OUT_DIR}/large` },
]
const variants = [
  { sub: '', url: (dexNr: number) => `${ARTWORK}/${dexNr}.png` },
  { sub: '/shiny', url: (dexNr: number) => `${ARTWORK}/shiny/${dexNr}.png` },
]

for (const { sub, url } of variants) {
  const outputs = SIZES.map(({ size, dir }) => ({ size, dir: `${dir}${sub}` }))
  for (const { dir } of outputs) {
    fs.mkdirSync(dir, { recursive: true })
  }
  const missing = (dexNr: number) => outputs.filter(({ dir }) => !fs.existsSync(`${dir}/${dexNr}.webp`))
  const todo = Array.from({ length: DEX_SIZE }, (_, i) => i + 1).filter((nr) => missing(nr).length > 0)
  const failed: number[] = []

  const download = async (dexNr: number) => {
    const response = await fetch(url(dexNr))
    if (!response.ok) {
      failed.push(dexNr)
      return
    }
    const png = Buffer.from(await response.arrayBuffer())
    for (const { size, dir } of missing(dexNr)) {
      // withoutEnlargement: the source is 475px; never upscale
      await sharp(png).resize(size, size, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toFile(`${dir}/${dexNr}.webp`)
    }
  }

  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    await Promise.all(todo.slice(i, i + CONCURRENCY).map(download))
  }
  console.log(
    `Downloaded ${todo.length - failed.length} sprites to ${outputs.map(({ dir }) => dir).join(' + ')}${failed.length > 0 ? `; failed: ${failed.join(', ')}` : ''}`,
  )
}
