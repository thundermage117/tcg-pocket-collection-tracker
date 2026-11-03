#!/usr/bin/env bash
# Personal fork: merges upstream into the current branch (usage: scripts/merge-upstream.sh [ref], default upstream/main).
# Conflicts on the non-English files we delete are resolved by deleting them again (scripts/strip-locales.sh); any
# other conflict aborts the merge and exits 1. Commits the result. Used by upstream-sync.yml and by hand (FORK.md).
set -euo pipefail

ref=${1:-upstream/main}
# Paths strip-locales.sh owns: deleted files upstream changed, and the translation JSONs we trim
strippable='^frontend/(public/(locales|images|images/sets|hashes)/(de-DE|es-ES|fr-FR|it-IT|pt-BR)/|public/pokedex/(de-DE|es-ES|fr-FR|it-IT|pt-BR)\.json$|assets/(image-locales|pokemon_translations|trainers_translations|tools_translations)\.json$)|^scripts/(generate-image-locales\.ts|sync-locales\.js)$'

if git merge --no-edit "$ref"; then
  bash scripts/strip-locales.sh
  git diff --cached --quiet || git commit -q -m "chore: strip non-English files from upstream merge"
  exit 0
fi

conflicts=$(git diff --name-only --diff-filter=U)
others=$(grep -vE "$strippable" <<<"$conflicts" || true)
if [ -n "$others" ]; then
  echo "Merge conflicts outside the English-only paths: $(tr '\n' ' ' <<<"$others")" >&2
  git merge --abort
  exit 1
fi

# Take upstream's side of the translation JSONs so new names come in, then trim them; deleted paths get removed again
while read -r f; do
  if [[ $f == *_translations.json ]]; then
    git checkout --theirs -- "$f"
    git add -- "$f"
  fi
done <<<"$conflicts"
bash scripts/strip-locales.sh
git commit -q --no-edit
echo "Resolved English-only conflicts in: $(tr '\n' ' ' <<<"$conflicts")"
