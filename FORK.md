# Personal fork

A single-user fork of [marcelpanse/tcg-pocket-collection-tracker](https://github.com/marcelpanse/tcg-pocket-collection-tracker) (GPL-3.0). It keeps collection tracking and adds:

- **Card value**: ☆☆ community vote Elo, trade-board demand/supply, and wishlist/offer counts on the card detail page, plus "Sort by value" on the collection.
- **Completion heatmap** on the overview: completion % for every set × rarity, with per-set and per-rarity totals. It follows the page's copies / deckbuilding / rarity filters; clicking a cell opens the collection filtered to those missing cards.
- **Packs page** (`/packs`): pick a goal (cards you're missing, top-50 cards, best average card, trainers / rainbows) and boosters are ranked by it. Each pack card shows its top ☆☆, one headline stat for the goal (e.g. "1 in 140 packs gives a ☆☆ you're missing"), and pool counts; expanding it shows the other goals' stats and the full ☆☆ pool. A "best pick" banner gives the answer for the current goal.
- **Rankings page** (`/rankings`): S–D tier lists from the same value data. "☆☆ Elo" ranks every ☆☆ by vote-adjusted community Elo. "Most wanted" ranks every rarity by trade demand (only ☆☆ has real Elo votes). Filters live in the URL, e.g. `/#/rankings?set=B1`.
- **Trade page** (`/trade`): "Looking for" and "For trade" card grids built from your keep/collect settings, filtered by rarity, set, pack and name and sorted by card number or value. A flame marks the top quarter by demand (FT: easy to trade away, LF: scarce). "Copy for Discord" turns the filtered lists into LF / FT messages grouped by expansion, split under Discord's 2,000-character limit.

Removed from navigation (files left in place so upstream merges stay clean): friends, chat, trade offers/matching, community/blog links, analytics, donation widget.

Work happens on the `personal` branch. `main` mirrors upstream.

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
7. **Value refresh**: `.github/workflows/value-refresh.yml` runs `pnpm value:refresh` on the 1st and 15th of each month and commits `values.json` to `personal`, which Vercel deploys. No secrets needed. Run it by hand with `gh workflow run value-refresh.yml`.
   - A failed run usually means a new set's PackId is missing from `scripts/value/packs.py` (see below).
   - The packs, rankings and trade pages show the data's age and turn amber after 21 days, which means the refresh has stopped.

## When a new set drops

```sh
git fetch upstream && git switch main && git merge --ff-only upstream/main
git switch personal && git merge main      # new cards, images, scan hashes, model
# run any new scripts/sql/migrations/*.sql in our Supabase SQL editor
pnpm value:refresh                          # stops and names the new PackId if packs.py needs a line
git commit -am "Refresh value data for <set>" && git push
```

Refreshing by hand gets the new set's values in straight away. Without it, the next scheduled run stops on the unknown PackId until `packs.py` has the line.

The newest set's ☆☆ values are marked *provisional* until its cards have ~200 votes. The twice-monthly refresh settles them.

## Value data

`scripts/value/` (standard-library Python): see the module docstrings.

| Source | What | Endpoint |
|---|---|---|
| pokemontcglivetrade.org | ☆☆ vote Elo; trade-board want/offer counts for all rarities | `pokemonvmdns.eastasia.cloudapp.azure.com/api/card-value/rankings?cardLevel=1..10` |
| pokemon.eleet.dev | Wishlist / trade-list counts | `pokemon.eleet.dev/api/data` |

- Raw snapshots are committed in `scripts/value/data/`. The app bundles `frontend/assets/values.json`, so there are no live calls.
- Adjusted Elo shrinks low-vote cards toward the ☆☆ mean by `votes / (votes + 200)`.
- ☆☆ kind is full art → trainer → rainbow by print order, verified on card images.
- Check the Discord formatter: `pnpm tsx scripts/value/check-discord.ts`.
