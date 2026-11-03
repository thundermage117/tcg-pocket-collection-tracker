"""Refresh value data: fetch fresh snapshots, then rebuild frontend/assets/values.json.

Each fetch is kept in data/snapshots/<date>/ (a re-run the same day replaces that day's);
the build always reads the newest one.

Run after merging a new set from upstream:  pnpm value:refresh
Rebuild from the newest committed snapshot without fetching:  pnpm value:refresh --offline
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import build_values
import fetch_eleet
import fetch_rankings
import snapshots

if __name__ == '__main__':
    if '--offline' not in sys.argv:
        out_dir = snapshots.today()
        fetch_rankings.main(out_dir)
        fetch_eleet.main(out_dir)
    build_values.main()
