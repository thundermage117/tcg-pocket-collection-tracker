# Personal fork: read before changing anything

This repo is a personal fork of marcelpanse/tcg-pocket-collection-tracker. `upstream-sync.yml` merges upstream into
`personal` automatically, and `main` mirrors `upstream/main` exactly. [FORK.md](../FORK.md) is the human-facing doc:
setup, hosting, sync, value data. Read it before advising on structure, deploys or git.

The root `CLAUDE.md` is **upstream's file**. Don't edit it; an edit there conflicts on the next sync. Fork-specific
guidance goes here or in FORK.md. Where the two disagree, this file wins.

## Checklist before any non-trivial change or recommendation

1. **Does upstream own the path?** Run `git log --oneline upstream/main -- <path>`.
   - Upstream edits a file we deleted → modify/delete conflict. Upstream edits a file we changed → content conflict.
     Either one fails the sync.
   - Upstream adds new files under a folder we deleted → no conflict, but the files quietly come back.
   - Prefer adding new files, wrapping or hiding upstream code (e.g. dropping it from `navItems.ts`) and leaving
     upstream's files in place. If an upstream path must change, say so up front and make `upstream-sync.yml`
     handle it.
2. **Where does it deploy?** Vercel, with production branch `personal` and root `frontend`. The root CLAUDE.md's
   "GitHub Pages" deployment section is upstream's and doesn't apply. Check FORK.md before quoting hosting limits.
3. **Does it touch git history?** Never rewrite commits shared with upstream (`filter-repo`, rebasing merged commits,
   force-pushing `personal`/`main`). New SHAs lose the merge base with `upstream/main`, which breaks every later sync.
   Merging upstream back in brings all the old blobs with it, so a rewrite can't shrink the repo either. To shrink a
   local clone, use a partial clone (`--filter=blob:none`) instead.
4. **Does it change the database?** Our Supabase schema is `scripts/sql/personal-schema.sql`, not upstream's
   `schema.sql`. Upstream migrations are run by hand (FORK.md, "Staying up to date").
5. **What else pushes to `personal`?** `value-refresh.yml` and `upstream-sync.yml` share the `push-personal`
   concurrency group. Pull before pushing.
6. **Measure, don't guess.** Check sizes with `du`/`git count-objects -vH`, check upstream churn with `git log`,
   check deploy output in `frontend/dist`. Give numbers.

## Verifying

- Check `pnpm build`'s exit status before committing, e.g. `pnpm build && git commit ...`. Never pipe the build
  through `grep` in a chain that then commits: the pipe hides the failure.
- Assets imported with `?url` that are on the preload list in `frontend/vite.config.ts` must stay emitted files.
  Below Vite's 4 KB inline limit they turn into data URLs and the preload check fails. Use `?url&no-inline`.

## Current fork state worth knowing

- **English only (2026-11-03).** The non-English UI locales, card images, set logos, scan hashes and Pokédex
  entries are deleted, and the name-translation JSONs keep only `en-US`. `i18n.ts` pins `lng: 'en-US'`, and
  `getLocalizedImagePath` always returns `/images/en-US/...`.
  **Known gap:** upstream still adds and edits those paths with most new sets, so the sync will conflict on them
  until `upstream-sync.yml` learns to re-delete them after merging.
- **Stale upstream docs/scripts:** `pnpm sync-locales` no longer exists. `pnpm scraper` calls `scripts/scraper.js`,
  but the file is `scripts/scraper.ts`.
- **Tooling:** pnpm isn't global on the dev machine (`npx pnpm@12.4.1`). The lefthook git hooks need a `pnpm` shim
  on PATH.
