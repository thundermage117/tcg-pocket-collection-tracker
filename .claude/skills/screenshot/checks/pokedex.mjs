// Browser checks for the Pokédex flows: sticky bar, generation jump, phone breakdown, filters, the species page's
// filtered ←/→ and back link (scroll restore, no extra history), form sections, the phone lines view staying on screen and
// the tile-to-hero view transition and back. Logged out, against the dev server.
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
  // with a view transition the URL changes a frame before the new page renders, so wait on the page, not the URL
  await page.waitFor(`location.hash !== '${href}' && __t.position() !== '${n}/${total}'`)
  const position = await page.evaluate('__t.position()')
  assert(position === `${n + 1}/${total}`, `after → the position is ${position}, expected ${n + 1}/${total}`)

  const historyLength = await page.evaluate('history.length')
  const back = await page.evaluate(`__t.backLink()?.getAttribute('href')`)
  assert(back === '#/pokedex?type=fire', `back link points to ${back}`)
  // a real pointer would reach it: nothing (the hero's glow, say) lies on top of it, once the → transition's overlay is gone
  await wait(500)
  const covered = await page.evaluate(
    `(() => { const a = __t.backLink(), r = a.getBoundingClientRect(), el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return a.contains(el) ? '' : el.outerHTML.slice(0, 80) })()`,
  )
  assert(!covered, `the back link is covered by ${covered}`)
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

check('phone: the lines view stays within the screen, wide lines scroll in their card', async () => {
  const page = await open('/pokedex?view=lines', { width: 390, height: 844 })
  await page.waitFor('__t.tiles().length > 10')
  const overflow = await page.evaluate('document.documentElement.scrollWidth - innerWidth')
  assert(overflow <= 0, `the page is ${overflow}px wider than the screen`)
})

check('species page: a line tile morphs into the hero, with no transition name twice', async () => {
  const page = await open('/pokedex/4', { width: 1280, height: 900 })
  await page.waitFor(`__t.tiles().some((a) => a.getAttribute('href') === '#/pokedex/6')`)
  // records the named artwork on both sides of the transition, and how it ended (a duplicate name aborts it)
  await page.evaluate(`{
    const start = document.startViewTransition.bind(document)
    const names = () => [...document.querySelectorAll('img')].map((i) => i.style.viewTransitionName).filter(Boolean)
    document.startViewTransition = (update) => {
      const run = (window.__vt = {})
      const t = start(async () => {
        await (typeof update === 'function' ? update() : update.update())
        run.after = names()
      })
      run.before = names()
      t.finished.then(() => (run.done = true), (e) => (run.error = String(e)))
      return t
    }
  }`)
  await page.evaluate(`__t.tiles().find((a) => a.getAttribute('href') === '#/pokedex/6').click()`)
  const run = JSON.parse(await page.waitFor(`(window.__vt?.done || window.__vt?.error) && JSON.stringify(window.__vt)`))
  assert(!run.error, `the transition failed: ${run.error}`)
  for (const side of ['before', 'after']) {
    assert(new Set(run[side]).size === run[side].length, `a transition name is used twice ${side}: ${run[side]}`)
    assert(run[side].includes('dex-art-6'), `Charizard's artwork isn't named ${side} the transition: ${run[side]}`)
  }
})

check('going back, the hero morphs back into its tile (link and browser back, the page left at its top)', async () => {
  const page = await open('/pokedex', { width: 1280, height: 900 })
  await page.waitFor(`document.querySelector('main a[href="#/pokedex/58"]')`)
  // records each transition: the scroll and named artwork as it starts (the old snapshot) and once the new page is in
  await page.evaluate(`{
    const start = document.startViewTransition.bind(document)
    const names = () => [...document.querySelectorAll('img')].map((i) => i.style.viewTransitionName).filter(Boolean)
    window.__vts = []
    document.startViewTransition = (update) => {
      const run = { y: scrollY, before: names() }
      window.__vts.push(run)
      const t = start(async () => {
        await (typeof update === 'function' ? update() : update.update())
        run.after = names()
        run.afterY = scrollY
      })
      t.finished.then(() => (run.done = true), (e) => (run.error = String(e)))
      return t
    }
  }`)
  const listY = 2500
  // the species page's back link, not the app nav's Pokédex link
  const species = `[...document.querySelectorAll('main a:not([data-radix-collection-item])')].find((a) => a.textContent.trim() === 'Pokédex')`
  for (const back of [`${species}.click()`, 'history.back()']) {
    await page.evaluate(`scrollTo(0, ${listY})`)
    await wait(300)
    await page.evaluate(`document.querySelector('main a[href="#/pokedex/58"]').click()`)
    await page.waitFor(`window.__vts.at(-1)?.done && ${species}`)
    await wait(300)
    const count = await page.evaluate('__vts.length')
    await page.evaluate(back)
    const run = JSON.parse(await page.waitFor(`__vts.length > ${count} && __vts.at(-1).done && JSON.stringify(__vts.at(-1))`))
    assert(!run.error, `${back}: the transition failed: ${run.error}`)
    // the browser's own scroll restore would scroll the species page down to the list's position first, its hero out of view
    assert(run.y === 0, `${back}: the species page was at scrollY ${run.y} as the transition started`)
    assert(run.before.includes('dex-art-58') && run.after.includes('dex-art-58'), `${back}: artwork named ${run.before} → ${run.after}`)
    assert(Math.abs(run.afterY - listY) <= 5, `${back}: the list came back at scrollY ${run.afterY}, left at ${listY}`)
  }
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
  await browser.close()
}
console.log(failed ? `${failed} of ${checks.length} checks failed` : `all ${checks.length} checks passed`)
process.exit(failed ? 1 : 0)
