"""Snapshot pokemon.eleet.dev's market data into data/snapshots/<date>/eleet.json.

The site serves one JSON file with per-card wishlist and trade-list counts (it appears to
aggregate the PokeTrade app). We keep only the fields we use, keyed by our card_id.
"""
import json
import pathlib
import sys
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import snapshots

URL = 'https://pokemon.eleet.dev/api/data'


def main(out_dir=None):
    out_dir = out_dir or snapshots.today()
    out_dir.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.load(r)
    cards = {
        c['id'].replace('_', '-'): {'wish': c['wish_count'], 'offers': c['trade_count']}
        for c in data['cards']
    }
    (out_dir / 'eleet.json').write_text(json.dumps(cards, ensure_ascii=False, sort_keys=True, indent=0))
    print(f'eleet: {len(cards)} cards')


if __name__ == '__main__':
    main()
