"""Dated snapshot folders: data/snapshots/YYYY-MM-DD/ holds eleet.json and rankings/lv{N}.json from one fetch."""
import datetime
import pathlib

DIR = pathlib.Path(__file__).resolve().parent / 'data' / 'snapshots'


def today():
    return DIR / datetime.date.today().isoformat()


def latest():
    """ISO dates sort as strings, so the last folder is the newest."""
    dirs = sorted(d for d in DIR.iterdir() if d.is_dir())
    if not dirs:
        raise SystemExit(f'No snapshots in {DIR}; run without --offline')
    return dirs[-1]
