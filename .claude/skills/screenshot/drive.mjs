// Drive the cached chrome-headless-shell over the DevTools protocol: load a route, run steps, screenshot.
// Usage: node drive.mjs <route> <out-prefix> [width] [height] -- <step> ...
//   steps run in order: `js:<expression>` evaluates in the page (awaited), `wait:<ms>` pauses,
//   `shot` saves <out-prefix>-<n>.png. A final screenshot is taken if no step asked for one.
//   e.g. node drive.mjs /pokedex /tmp/dex 390 900 -- 'js:scrollTo(0, 3000)' wait:500 shot
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const sep = process.argv.indexOf('--')
const [route, prefix, width = '1280', height = '1600'] = process.argv.slice(2, sep === -1 ? undefined : sep)
const steps = sep === -1 ? [] : process.argv.slice(sep + 1)
if (!route || !prefix) {
  console.error('Usage: node drive.mjs <route> <out-prefix> [width] [height] -- <step> ...')
  process.exit(1)
}
const port = process.env.PORT ?? '5173'
const url = route.startsWith('http') ? route : `https://localhost:${port}/#${route}`

// newest installed shell; never download one
const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright')
const shell = fs
  .readdirSync(cache)
  .filter((d) => d.startsWith('chromium_headless_shell-'))
  .sort((a, b) => Number(a.split('-')[1]) - Number(b.split('-')[1]))
  .flatMap((d) => fs.readdirSync(path.join(cache, d)).map((sub) => path.join(cache, d, sub, 'chrome-headless-shell')))
  .filter((p) => fs.existsSync(p))
  .at(-1)
if (!shell) {
  console.error(`No chrome-headless-shell in ${cache}`)
  process.exit(1)
}

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'drive-'))
const chrome = spawn(shell, [
  '--remote-debugging-port=0',
  `--user-data-dir=${profile}`,
  '--ignore-certificate-errors',
  '--hide-scrollbars',
  `--window-size=${width},${height}`,
  'about:blank',
])
const wsUrl = await new Promise((resolve, reject) => {
  chrome.stderr.on('data', (d) => {
    const m = /DevTools listening on (ws:\S+)/.exec(String(d))
    if (m) {
      resolve(m[1])
    }
  })
  chrome.on('exit', () => reject(new Error('chrome exited before DevTools came up')))
})

const browser = new WebSocket(wsUrl)
await new Promise((r) => browser.addEventListener('open', r))
let id = 0
const pending = new Map()
const listeners = []
browser.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data)
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)
  } else if (msg.method) {
    for (const l of listeners) {
      l(msg)
    }
  }
})
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject })
    browser.send(JSON.stringify({ id, method, params, sessionId }))
  })

const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
const page = (method, params) => send(method, params, sessionId)
await page('Page.enable')
await page('Emulation.setDeviceMetricsOverride', { width: Number(width), height: Number(height), deviceScaleFactor: 1, mobile: Number(width) < 600 })
const loaded = new Promise((r) => listeners.push((m) => m.method === 'Page.loadEventFired' && m.sessionId === sessionId && r()))
await page('Page.navigate', { url })
await loaded
await new Promise((r) => setTimeout(r, Number(process.env.WAIT_MS ?? 4000)))

let shots = 0
const shot = async () => {
  const { data } = await page('Page.captureScreenshot', { format: 'png' })
  const out = `${prefix}-${++shots}.png`
  fs.writeFileSync(out, Buffer.from(data, 'base64'))
  console.log(`wrote ${out}`)
}
try {
  for (const step of steps) {
    if (step === 'shot') {
      await shot()
    } else if (step.startsWith('wait:')) {
      await new Promise((r) => setTimeout(r, Number(step.slice(5))))
    } else if (step.startsWith('js:')) {
      const { result, exceptionDetails } = await page('Runtime.evaluate', { expression: step.slice(3), awaitPromise: true, returnByValue: true })
      if (exceptionDetails) {
        throw new Error(`${step}: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`)
      }
      if (result.value !== undefined) {
        console.log(`${step.slice(3)} → ${JSON.stringify(result.value)}`)
      }
    } else {
      throw new Error(`unknown step ${step}`)
    }
  }
  if (shots === 0) {
    await shot()
  }
} finally {
  browser.close()
  chrome.kill()
  fs.rmSync(profile, { recursive: true, force: true })
}
