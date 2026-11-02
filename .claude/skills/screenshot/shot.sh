#!/usr/bin/env bash
# Screenshot a page of the local dev server with a chrome-headless-shell already in the Playwright cache.
# Usage: shot.sh <route> <out.png> [width] [height]
#   route  hash route, e.g. /pokedex or '/pokedex?view=lines' (or a full URL)
#   width  default 1280; use 390 for a phone
#   height default 1600; a tall height stands in for a full-page shot
set -euo pipefail

route=${1:?route, e.g. /pokedex}
out=${2:?output .png path}
width=${3:-1280}
height=${4:-1600}
port=${PORT:-5173}

# newest installed shell; never download one
bin=$(ls -d "$HOME"/Library/Caches/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell 2>/dev/null | sort -V | tail -1 || true)
if [[ -z $bin ]]; then
  echo "No chrome-headless-shell in ~/Library/Caches/ms-playwright" >&2
  exit 1
fi

# the dev server is HTTPS (vite-plugin-mkcert)
if [[ $route == http* ]]; then url=$route; else url="https://localhost:$port/#$route"; fi
if ! curl -sk -o /dev/null --max-time 5 "https://localhost:$port/"; then
  echo "Dev server not answering on https://localhost:$port (start it with: cd frontend && pnpm dev)" >&2
  exit 1
fi

# virtual time lets lazy chunks, cards.json and images settle before the capture
"$bin" --hide-scrollbars --ignore-certificate-errors --window-size="$width,$height" \
  --virtual-time-budget="${WAIT_MS:-10000}" --screenshot="$out" "$url" 2>&1 |
  grep -E 'bytes written|Page load failed' || true
[[ -s $out ]]
