---
name: screenshot
description: Screenshot a page of the local frontend (desktop or phone width) to check UI changes visually, using the chrome-headless-shell already in the Playwright cache. Use when asked to screenshot, look at or visually check a page, or before and after a UI change.
argument-hint: <route> [phone|desktop]
allowed-tools: Bash, Read
---

# Screenshot the local app

```bash
.claude/skills/screenshot/shot.sh /pokedex "$SCRATCH/pokedex.png"            # desktop, 1280×1600
.claude/skills/screenshot/shot.sh /pokedex/6 "$SCRATCH/charizard.png" 390 2400  # phone width, tall
```

Then `Read` the PNG to look at it. Save screenshots in the session scratchpad, not the repo.

- **Never install a browser.** Don't run `playwright install` or `npx playwright screenshot` (it
  wants a matching Chromium build and starts downloading one). The script uses the newest
  `chrome-headless-shell` that is already in `~/Library/Caches/ms-playwright`.
- **The dev server is HTTPS** (vite-plugin-mkcert) on 5173 and is usually already running. A plain-HTTP
  `curl http://localhost:5173` returns an empty reply, which doesn't mean it's down. Only start one
  (`cd frontend && pnpm dev`) if the script says it isn't answering. Set `PORT=` for another port.
- **Run it with the sandbox disabled.** Inside the sandbox, the browser can't reach localhost.
- **There's no full-page mode.** A tall height (2400–4000) does the same job. Phone width is 390.
  This changes only the viewport: no touch events and no mobile user agent.
- **The browser is logged out**, with a fresh profile, so collection-dependent UI shows the empty
  state (every species uncaught, 0/N). Keep that in mind when judging owned/complete styling.
- `WAIT_MS=` sets how long the page gets to settle (default 10000). Raise it if images are blank.
- `shot.sh` can't click or scroll. To show a UI state, link to it by URL: Pokédex filters live in the
  query string (`'/pokedex?view=lines&gen=1'`).

## Scrolling, clicking, checking state: `drive.mjs`

For anything a static shot can't show (sticky bars, scroll restoration, what a click does), drive the
same shell over the DevTools protocol. It needs no npm packages (Node's built-in WebSocket), uses a
throwaway profile, and sets mobile emulation below 600px wide.

```bash
node .claude/skills/screenshot/drive.mjs /pokedex "$SCRATCH/dex" 390 844 -- \
  'js:scrollTo(0, 5000)' wait:600 shot \
  "js:document.querySelector('[data-gen-chip=\"5\"]').click()" wait:1500 shot 'js:scrollY'
```

Steps run in order. `js:<expr>` evaluates in the page and prints the value, `wait:<ms>` pauses, and
`shot` writes `<prefix>-<n>.png`. Asserting with `js:` (what's highlighted, `scrollY`, `location.hash`)
is often more reliable than reading a screenshot.
