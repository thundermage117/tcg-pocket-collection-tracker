// Shared DevTools-protocol plumbing for drive.mjs and checks/: launches the cached chrome-headless-shell (never downloads one)
// with a throwaway profile, and opens pages on the local dev server.
//   const browser = await launch()
//   const page = await browser.newPage('/pokedex', { width: 390, height: 844 })
//   await page.evaluate('scrollY'); await page.waitFor('document.querySelector("[data-gen]")'); await page.screenshot(out)
//   await browser.close()
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const port = process.env.PORT ?? '5173'
export const routeUrl = (route) => (route.startsWith('http') ? route : `https://localhost:${port}/#${route}`)
export const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function findShell() {
  const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright')
  const shell = fs
    .readdirSync(cache)
    .filter((d) => d.startsWith('chromium_headless_shell-'))
    .sort((a, b) => Number(a.split('-')[1]) - Number(b.split('-')[1]))
    .flatMap((d) => fs.readdirSync(path.join(cache, d)).map((sub) => path.join(cache, d, sub, 'chrome-headless-shell')))
    .filter((p) => fs.existsSync(p))
    .at(-1)
  if (!shell) {
    throw new Error(`No chrome-headless-shell in ${cache}`)
  }
  return shell
}

export async function launch() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'drive-'))
  const chrome = spawn(findShell(), [
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--ignore-certificate-errors',
    '--hide-scrollbars',
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

  const socket = new WebSocket(wsUrl)
  await new Promise((r) => socket.addEventListener('open', r))
  let id = 0
  const pending = new Map()
  const listeners = []
  socket.addEventListener('message', (e) => {
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
      socket.send(JSON.stringify({ id, method, params, sessionId }))
    })

  /** A new tab (its own sessionStorage and history) loaded at `route`, given `settle` ms (WAIT_MS, default 4000) to render. */
  async function newPage(route, { width = 1280, height = 1600, settle = Number(process.env.WAIT_MS ?? 4000) } = {}) {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
    const cdp = (method, params) => send(method, params, sessionId)
    await cdp('Page.enable')
    await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 })
    const loaded = new Promise((r) => listeners.push((m) => m.method === 'Page.loadEventFired' && m.sessionId === sessionId && r()))
    await cdp('Page.navigate', { url: routeUrl(route) })
    await loaded
    await wait(settle)

    /** Evaluates an expression in the page (promises awaited) and returns its value; page exceptions throw. */
    const evaluate = async (expression) => {
      const { result, exceptionDetails } = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (exceptionDetails) {
        throw new Error(`${expression}: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`)
      }
      return result.value
    }
    return {
      evaluate,
      /** A raw DevTools call in this page's session (Input.dispatchMouseEvent for a real hover, say). */
      cdp,
      /** Polls until the expression is truthy and returns its value (true for a DOM node, which can't be returned); throws after `timeout` ms. */
      async waitFor(expression, timeout = 5000) {
        const end = Date.now() + timeout
        for (;;) {
          const value = await evaluate(`(() => { const v = (${expression}); return v instanceof Node ? true : v })()`)
          if (value) {
            return value
          }
          if (Date.now() > end) {
            throw new Error(`timed out waiting for ${expression}`)
          }
          await wait(100)
        }
      },
      async screenshot(out) {
        const { data } = await cdp('Page.captureScreenshot', { format: 'png' })
        fs.writeFileSync(out, Buffer.from(data, 'base64'))
        return out
      },
      close: () => send('Target.closeTarget', { targetId }),
    }
  }

  return {
    newPage,
    // waits for chrome to exit: it still writes to the profile while shutting down
    async close() {
      socket.close()
      const exited = chrome.exitCode === null ? new Promise((r) => chrome.once('exit', r)) : Promise.resolve()
      chrome.kill()
      await exited
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    },
  }
}
