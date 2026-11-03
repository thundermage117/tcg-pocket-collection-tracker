// Drive the cached chrome-headless-shell over the DevTools protocol: load a route, run steps, screenshot.
// Usage: node drive.mjs <route> <out-prefix> [width] [height] -- <step> ...
//   steps run in order: `js:<expression>` evaluates in the page (awaited), `wait:<ms>` pauses, `hover:<css selector>` moves
//   the mouse onto that element,
//   `shot` saves <out-prefix>-<n>.png. A final screenshot is taken if no step asked for one.
//   e.g. node drive.mjs /pokedex /tmp/dex 390 900 -- 'js:scrollTo(0, 3000)' wait:500 shot
import { launch, wait } from './browser.mjs'

const sep = process.argv.indexOf('--')
const [route, prefix, width = '1280', height = '1600'] = process.argv.slice(2, sep === -1 ? undefined : sep)
const steps = sep === -1 ? [] : process.argv.slice(sep + 1)
if (!route || !prefix) {
  console.error('Usage: node drive.mjs <route> <out-prefix> [width] [height] -- <step> ...')
  process.exit(1)
}

const browser = await launch()
try {
  const page = await browser.newPage(route, { width: Number(width), height: Number(height) })
  let shots = 0
  const shot = async () => console.log(`wrote ${await page.screenshot(`${prefix}-${++shots}.png`)}`)
  for (const step of steps) {
    if (step === 'shot') {
      await shot()
    } else if (step.startsWith('wait:')) {
      await wait(Number(step.slice(5)))
    } else if (step.startsWith('hover:')) {
      // a real mouse move to the element's centre, so CSS :hover applies (a JS event wouldn't)
      const box = await page.evaluate(
        `(() => { const r = document.querySelector(${JSON.stringify(step.slice(6))}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })()`,
      )
      await page.cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', ...box })
    } else if (step.startsWith('js:')) {
      const value = await page.evaluate(step.slice(3))
      if (value !== undefined) {
        console.log(`${step.slice(3)} → ${JSON.stringify(value)}`)
      }
    } else {
      throw new Error(`unknown step ${step}`)
    }
  }
  if (shots === 0) {
    await shot()
  }
} finally {
  await browser.close()
}
