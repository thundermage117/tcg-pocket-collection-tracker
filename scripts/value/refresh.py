"""Refresh value data: fetch fresh snapshots, then rebuild frontend/assets/values.json.

Run after merging a new set from upstream:  pnpm value:refresh
Rebuild from the committed snapshots without fetching:  pnpm value:refresh --offline
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import build_values
import fetch_eleet
import fetch_rankings

if __name__ == '__main__':
    if '--offline' not in sys.argv:
        fetch_rankings.main()
        fetch_eleet.main()
    build_values.main()
