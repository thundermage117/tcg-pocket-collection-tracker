# Personal fork

A single-user fork of [marcelpanse/tcg-pocket-collection-tracker](https://github.com/marcelpanse/tcg-pocket-collection-tracker) (GPL-3.0). It keeps collection tracking and adds the pages below.

Work happens on the `personal` branch, which Vercel deploys. `main` mirrors upstream.

## What's added

- **Card value** on the card detail page: ☆☆ community vote Elo, trade-board demand/supply and wishlist/offer counts, plus its Rankings tier with a link to it, and "Check a trade". The collection gets "Sort by value".
- **Completion heatmap** on the overview, replacing upstream's expansion table: completion % for every set × rarity with per-set and per-rarity totals, and each pack's chance of a new card. It follows the page's copies / deckbuilding / rarity filters; a cell opens the collection filtered to those missing cards. On phones each row shows the set logo.
- **Packs** (`/packs`): pick a goal (cards you're missing, top-50 cards, best average card, trainers / rainbows) and boosters are ranked by it. Each pack shows its top ☆☆, one headline stat (e.g. "1 in 140 packs gives a ☆☆ you're missing") and pool counts; expanding it shows the other goals and the full ☆☆ pool. A "best pick" banner answers the current goal.
- **Rankings** (`/rankings`): SSS–E tier lists. "☆☆ Elo" ranks every ☆☆ by community vote; "Most wanted" ranks every rarity by trade demand, with a "Deluxe foils" switch (off by default). See [Rankings](#rankings).
- **Trade** (`/trade`): "Looking for" and "For trade" grids from your keep/collect settings, filtered by rarity, set, pack and name, sorted by number or value. A flame marks the top quarter by demand. "Copy for Discord" turns them into LF / FT messages grouped by expansion, split under Discord's 2,000-character limit.
- **Trade check** (`/trade/check`): pick the card you give and the card you get for a fair / steal / overpay verdict with reasons, ownership, Shinedust and pack-point costs. See [Trade check](#trade-check).
- **Navigation**: below `lg` a bottom tab bar (Overview, Collection, Packs, Trade, More) replaces the hamburger; More holds the other pages and account actions. On desktop, Decks and Missions sit behind "More". Pages are listed once in `frontend/src/components/navItems.ts`.
- **Filters in the URL** on the overview, packs, rankings, trade and trade check pages, so refresh, back and links keep the view (e.g. `/#/rankings?tab=wanted&set=B1`). `useUrlFilters` also remembers a few choices (overview filters, pack goal, trade rarity and sort) for when the URL leaves them out.

Removed from navigation, with the files left in place so upstream merges stay clean: friends, chat, trade offers/matching, community/blog links, analytics, donation widget.

**English only.** Unlike the removals above, the other five languages' files are deleted: UI locales, card images, set logos, scan hashes and Pokédex entries, about 755 MB. The name-translation JSONs keep only `en-US`, and the language picker is gone. Upstream keeps adding and editing those paths with new sets. `scripts/merge-upstream.sh`, which the sync uses, resolves those conflicts by deleting the files again (`scripts/strip-locales.sh`) and takes upstream's new names into the trimmed JSONs. Any other conflict still stops the sync.

## Setup (once)

1. **Supabase**: create a free project, then run `scripts/sql/personal-schema.sql` in its SQL editor.
   - Auth → Providers: keep Email enabled, and set **Email OTP Length to 6**. New projects default to 8, but the login box has 6 slots.
   - Auth → Emails → SMTP: templates can only be edited with custom SMTP. Gmail with an app password works (`smtp.gmail.com:587`); ignore the "personal email provider" warning.
   - Auth → Emails → Templates: replace the body of both **Confirm signup** and **Magic Link** with `{{ .Token }}` and leave out the link. Tapping the link uses up the code.
   - After your first login, turn off new sign-ups (Auth → Sign In / Providers → "Allow new users to sign up") so it stays single-user.
2. **Local dev**: `cp frontend/.env.example frontend/.env.local`, fill in URL and anon key (Project Settings → API), then `pnpm install && pnpm dev`.
   - No global pnpm? Use `npx pnpm@12.4.1 <cmd>`.
   - The dev server is HTTPS via `vite-plugin-mkcert`. The first time, run `~/.vite-plugin-mkcert/mkcert -install` once (needs sudo), and start `dev` from a real terminal.
3. **Import your collection**: on tcgpocketcollectiontracker.com use Import/Export → export, then import that file on our Import page. Recheck any rarities that were stale.
4. **Hosting**: Vercel (Hobby, personal use) importing this repo, production branch `personal`.
   - Root directory `frontend`. Framework preset: Vite.
   - Install command `npx pnpm@12.4.1 install --frozen-lockfile`, build command `npx pnpm@12.4.1 build`, output `dist` (relative to the root directory).
   - `frontend/.gitignore` ignores `.vercel`; without it the build's Biome check fails on Vercel's generated `package-manifest.json`.
   - Env vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
   - It serves from `/`, so upstream's absolute asset paths work. Not GitHub Pages: a `/repo/` subpath breaks them.
   - No SPA rewrites needed (hash router).
   - Set the Vercel URL as Site URL in Supabase Auth → URL Configuration.
5. **Keepalive**: add repo secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY`. `.github/workflows/supabase-keepalive.yml` pings weekly so the free project doesn't pause.
   - Scheduled workflows only run from the default branch, so the fork's default branch is `personal`.
   - Forks start with Actions off: enable them once in the Actions tab, then test with `gh workflow run supabase-keepalive.yml`.
6. **Upstream workflows**: disable `deploy.yml`, `build.yml`, `verify-*.yml` in the fork's Actions tab. They target upstream's domain and secrets.
   - The fork's own `.github/workflows/ci.yml` lints and builds every push and PR to `personal` instead. It's a separate file so upstream's edits to `build.yml` never conflict.
   - Dependabot is off (`open-pull-requests-limit: 0` in `.github/dependabot.yml`): upstream's Dependabot bumps arrive through the sync, and ours would conflict with them in `pnpm-lock.yaml`.
7. **Value refresh**: `.github/workflows/value-refresh.yml` runs `pnpm value:refresh` on the 1st and 15th and commits `values.json` to `personal`. No secrets needed. Run it by hand with `gh workflow run value-refresh.yml`.
   - A failed run usually means a new set's PackId is missing from `scripts/value/packs.py`.
   - The packs, rankings and trade pages show the data's age and turn amber after 21 days, which means the refresh has stopped.
8. **Upstream sync**: `.github/workflows/upstream-sync.yml` (see [Staying up to date](#staying-up-to-date)) needs a repo secret `SYNC_TOKEN`: a fine-grained personal access token for this repo with **Contents** and **Workflows** read/write. Without it, the sync still works until upstream changes a file in `.github/workflows`, which the default token isn't allowed to push.

## Staying up to date

`upstream-sync.yml` checks upstream daily and merges it into `personal` every Monday, or as soon as upstream is 10+ commits ahead. It lints and builds the merge, refreshes value data if upstream added cards, then pushes `personal` and mirrors `main`. Run it now with `gh workflow run upstream-sync.yml`.

It fails without pushing anything, and GitHub emails you, when:

- **The merge conflicts** anywhere except the non-English files, which `scripts/merge-upstream.sh` deletes again. Merge by hand (below).
- **Upstream changes the database** (`scripts/sql/schema.sql` or a new `scripts/sql/migrations/*.sql`). Run whatever our tables need in our Supabase SQL editor (`personal-schema.sql` lists what we have), then `gh workflow run upstream-sync.yml -f force=true`.
- **Lint or build fails** on the merged code.

A failed value refresh (usually a new PackId) doesn't stop the merge: it shows as a warning, and the next `value-refresh.yml` run fails until `scripts/value/packs.py` has the line.

By hand:

```sh
git fetch upstream && git switch main && git merge --ff-only upstream/main
git switch personal && bash scripts/merge-upstream.sh main   # new cards, images, scan hashes, model; drops non-English files
# run any new scripts/sql/migrations/*.sql in our Supabase SQL editor
pnpm value:refresh                          # stops and names the new PackId if packs.py needs a line
git commit -am "Refresh value data for <set>" && git push && git push origin main
```

The newest set's ☆☆ values are marked *provisional* until its cards have ~200 votes. The twice-monthly refresh settles them.

The repo's front page is `.github/README.md`, which GitHub shows instead of upstream's `README.md`. Leave the root `README.md` as upstream's so merges never conflict on it.

## Value data

`scripts/value/` (standard-library Python): see the module docstrings.

| Source | What | Endpoint |
|---|---|---|
| pokemontcglivetrade.org | ☆☆ vote Elo; trade-board want/offer counts for all rarities | `pokemonvmdns.eastasia.cloudapp.azure.com/api/card-value/rankings?cardLevel=1..10` |
| pokemon.eleet.dev | Wishlist / trade-list counts | `pokemon.eleet.dev/api/data` |

- Raw snapshots are committed in `scripts/value/data/`. The app bundles `frontend/assets/values.json`, so there are no live calls.
- Adjusted Elo shrinks low-vote cards toward the ☆☆ mean by `votes / (votes + 200)`.
- Demand is eleet wishlists per offer. Every page that ranks or compares it (Rankings, Trade flames and sort, trade check, "Sort by value") uses `demandScore`, which adds 200 phantom offers at the average ratio (`DEMAND_K`), so a new set's card with ~80 spares listed can't outrank thousands of trades on a lucky ratio. Card detail shows both the raw and the adjusted figure.
- A same-art reprint (e.g. Deluxe A4b-1 Bulbasaur) shares its original's `internal_id` (A1-1), and eleet pools their numbers. `build_values.py` marks it `same_as: "A1-1"`; Most wanted ranks only the original.
- ☆☆ kind is full art → trainer → rainbow by print order, verified on card images.
- Check the Discord formatter: `pnpm tsx scripts/value/check-discord.ts`.

## Rankings

`frontend/src/lib/rankings.ts`. Tiers are taken over the whole ranking, so a card keeps its tier when the list is filtered. A sticky row of tier chips (with how many of each you own) jumps to a tier, and each tier header has an ownership bar in its color. The page doesn't wait for the collection; owned marks fill in when it loads.

- **☆☆ Elo**: by adjusted Elo. Tiers are Jenks natural breaks (least within-tier variance), so they end where the Elo jumps and read as Elo ranges.
- **Most wanted**: by `demandScore`, in fixed shares: top 1 / 3 / 8 / 20 / 45 / 70 / 90 / 100%.
- **Deluxe foils** (◊–◊◊◊ holo versions from the deluxe packs) are scarce enough to fill the top tiers on their own, so the switch swaps in a separate ranking that includes them rather than filtering one.

## Trade check

Scoring is pure in `frontend/src/lib/tradeFairness.ts`, with the Shinedust and pack-point tables.

- Score = percentile among all tradable cards of that rarity. ☆☆: 70% vote Elo + 30% demand (Elo weight scales down below 200 votes); other rarities: demand.
- Gap within 15 points is fair, over 35 is "big". Under 300 wishlists + offers or a provisional Elo makes it a lean ("Leaning steal") with a 25-point band.
- Checked Oct 2026: trade tokens were replaced by Shinedust in July 2025, both sides pay, ☆☆☆ / Crown / promos aren't tradable. Recheck the tables if the game changes trading.
