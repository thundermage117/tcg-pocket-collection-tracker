// Browser checks for the Pokédex flows: sticky bar, generation jump, phone breakdown, filters, the species page's
// filtered ←/→ and back link (scroll restore, no extra history), and form sections. Logged out, against the dev server.
// Run after Pokédex changes (sandbox disabled, dev server on PORT or 5173): node .claude/skills/screenshot/checks/pokedex.mjs
// Prints ✓/✗ per check and exits 1 if any failed.
import { launch, wait } from '../browser.mjs'

// in-page helpers, found by behaviour and text rather than class chains
const helpers = `
  window.__t = {
    tiles: () => [...document.querySelectorAll('main a[href^="#/pokedex/"]')],
    bar: () => {
      let el = document.querySelector('main input')
      while (el && getComputedStyle(el).position !== 'sticky') el = el.parentElement
      return el
    },
    currentChip: () => document.querySelector('[data-gen-chip].border-blue-300')?.dataset.genChip,
    byText: (selector, text) => [...document.querySelectorAll(selector)].find((el) => el.textContent.trim() === text),
    position: () => [...document.querySelectorAll('main nav span[title]')].map((s) => s.textContent.trim()).find((t) => /^\\d+\\/\\d+$/.test(t)),
    backLink: () => [...document.querySelectorAll('main a')].find((a) => a.textContent.trim() === 'Pokédex' && a.getAttribute('href').startsWith('#/pokedex?')),
  }
  true`

const checks = []
const check = (name, run) => checks.push({ name, run })
const assert = (ok, message) => {
  if (!ok) {
    throw new Error(message)
  }
}

let browser
const open = async (route, size) => {
  const page = await browser.newPage(route, size)
  await page.evaluate(helpers)
  return page
}

check('Pokédex loads and the sticky bar stays at the top', async () => {
  const page = await open('/pokedex', { width: 1280, height: 900 })
  const tiles = await page.waitFor('__t.tiles().length')
  assert(tiles > 100, `only ${tiles} tiles`)
  await page.evaluate('scrollTo(0, 5000)')
  await wait(400)
  const top = await page.evaluate('__t.bar().getBoundingClientRect().top')
  assert(Math.abs(top) <= 1, `sticky bar top is ${top}px after scrolling`)
})

check('generation chips jump below the bar and follow the scroll', async () => {
  const page = await open('/pokedex', { width: 1280, height: 900 })
  await page.waitFor('document.querySelector("[data-gen-chip]")')
  for (const gen of [5, 8, 2]) {
    await page.evaluate(`document.querySelector('[data-gen-chip="${gen}"]').click()`)
    await wait(1500)
    const gap = await page.evaluate(`document.querySelector('[data-gen="${gen}"]').getBoundingClientRect().top - __t.bar().getBoundingClientRect().bottom`)
    assert(gap >= 0 && gap <= 24, `Gen ${gen} header lands ${gap}px below the bar`)
    const current = await page.evaluate('__t.currentChip()')
    assert(current === String(gen), `after jumping to Gen ${gen}, chip ${current} is highlighted`)
  }
  await page.evaluate('scrollTo(0, 0)')
  await wait(400)
  const current = await page.evaluate('__t.currentChip()')
  assert(current === '1', `at the top, chip ${current} is highlighted`)
})

check('phone: the breakdown is folded and its toggle opens it', async () => {
  const page = await open('/pokedex', { width: 390, height: 844 })
  const toggle = `__t.byText('main button', 'By generation and type')`
  await page.waitFor(toggle)
  const folded = await page.evaluate(`${toggle}.getAttribute('aria-expanded') === 'false' && ${toggle}.nextElementSibling.offsetParent === null`)
  assert(folded, 'breakdown is not folded at phone width')
  await page.evaluate(`${toggle}.click()`)
  await wait(200)
  const open_ = await page.evaluate(`${toggle}.getAttribute('aria-expanded') === 'true' && ${toggle}.nextElementSibling.offsetParent !== null`)
  assert(open_, 'toggle did not open the breakdown')
})

check('filters: badge and chip, empty state clears', async () => {
  let page = await open('/pokedex?type=fire', { width: 1280, height: 900 })
  await page.waitFor('__t.tiles().length')
  const badge = await page.evaluate(
    `[...document.querySelectorAll('main button')].find((b) => b.textContent.includes('Filters'))?.textContent.replace('Filters', '').trim()`,
  )
  assert(badge === '1', `Filters badge shows "${badge}"`)
  assert(await page.evaluate(`!!__t.byText('main button', 'Fire')`), 'no Fire chip')
  await page.close()

  page = await open('/pokedex?q=zzzz&type=fire', { width: 1280, height: 900 })
  await page.waitFor(`document.querySelector('main').textContent.includes('No species match')`)
  assert(await page.evaluate('__t.tiles().length === 0'), 'tiles shown for an impossible query')
  // the empty state's own link, not the results-header one (there are no results)
  await page.evaluate(`__t.byText('main a', 'Clear filters').click()`)
  const tiles = await page.waitFor('__t.tiles().length > 100 && __t.tiles().length')
  const hash = await page.evaluate('location.hash')
  assert(hash === '#/pokedex?' || hash === '#/pokedex', `Clear filters went to ${hash}`)
  assert(tiles > 100, `${tiles} tiles after clearing`)
})

check('species page: filtered ←/→ and a back link that restores the scroll', async () => {
  const page = await open('/pokedex?type=fire', { width: 1280, height: 900 })
  await page.waitFor('__t.tiles().length')
  await page.evaluate('scrollTo(0, 3000)')
  await wait(500)
  const listY = await page.evaluate('scrollY')
  const href = await page.evaluate(
    `(() => { const a = __t.tiles().find((a) => a.getBoundingClientRect().top > 200); a.click(); return a.getAttribute('href') })()`,
  )
  await page.waitFor(`location.hash === '${href}' && __t.position()`)
  assert((await page.evaluate('scrollY')) === 0, 'species page did not open at the top')
  const [n, total] = (await page.evaluate('__t.position()')).split('/').map(Number)

  await page.evaluate(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))`)
  await page.waitFor(`location.hash !== '${href}'`)
  const position = await page.evaluate('__t.position()')
  assert(position === `${n + 1}/${total}`, `after → the position is ${position}, expected ${n + 1}/${total}`)

  const historyLength = await page.evaluate('history.length')
  const back = await page.evaluate(`__t.backLink()?.getAttribute('href')`)
  assert(back === '#/pokedex?type=fire', `back link points to ${back}`)
  await page.evaluate('__t.backLink().click()')
  await page.waitFor(`location.hash === '#/pokedex?type=fire' && __t.tiles().length`)
  await wait(500)
  const y = await page.evaluate('scrollY')
  assert(Math.abs(y - listY) <= 5, `back at scrollY ${y}, left at ${listY}`)
  const after = await page.evaluate('history.length')
  assert(after === historyLength, `history grew from ${historyLength} to ${after}`)
})

check('species page: form sections fold and show form sizes', async () => {
  const page = await open('/pokedex/6', { width: 1280, height: 900 })
  await page.waitFor(`document.querySelectorAll('main details > summary').length >= 3`)
  const summaries = await page.evaluate(`[...document.querySelectorAll('main details > summary')].map((s) => s.textContent)`)
  const mega = summaries.find((s) => s.includes('Mega Charizard X'))
  assert(mega, `no Mega Charizard X section in ${JSON.stringify(summaries)}`)
  assert(mega.includes('110.5 kg'), `Mega Charizard X section reads "${mega}"`)
  await page.evaluate(`document.querySelector('main details > summary').click()`)
  assert((await page.evaluate(`document.querySelector('main details').open`)) === false, 'clicking a summary did not fold its section')
})

browser = await launch()
let failed = 0
try {
  for (const { name, run } of checks) {
    try {
      await run()
      console.log(`✓ ${name}`)
    } catch (e) {
      failed++
      console.log(`✗ ${name}\n    ${e.message}`)
    }
  }
} finally {
  browser.close()
}
console.log(failed ? `${failed} of ${checks.length} checks failed` : `all ${checks.length} checks passed`)
process.exit(failed ? 1 : 0)
