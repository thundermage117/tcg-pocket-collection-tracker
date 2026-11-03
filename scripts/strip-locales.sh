#!/usr/bin/env bash
# Personal fork: the app is English only (see .claude/CLAUDE.md). Removes the non-English files upstream keeps adding
# and trims the name-translation JSONs to en-US. Idempotent; stages its changes. Run from the repo root.
set -euo pipefail

LOCALES=(de-DE es-ES fr-FR it-IT pt-BR)

paths=(frontend/assets/image-locales.json scripts/generate-image-locales.ts scripts/sync-locales.js)
for l in "${LOCALES[@]}"; do
  paths+=("frontend/public/locales/$l" "frontend/public/images/$l" "frontend/public/images/sets/$l" "frontend/public/hashes/$l" "frontend/public/pokedex/$l.json")
done
git rm -rqf --ignore-unmatch -- "${paths[@]}"
rm -rf -- "${paths[@]}"

python3 -I - <<'EOF'
import json
for name in ('pokemon', 'trainers', 'tools'):
    path = f'frontend/assets/{name}_translations.json'
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    trimmed = {k: {'en-US': v.get('en-US')} for k, v in data.items()}
    if trimmed != data:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(trimmed, f, ensure_ascii=False, indent=2)
EOF
git add frontend/assets/pokemon_translations.json frontend/assets/trainers_translations.json frontend/assets/tools_translations.json
