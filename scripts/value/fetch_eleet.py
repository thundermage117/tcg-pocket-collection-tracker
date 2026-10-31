"""Snapshot pokemon.eleet.dev's market data into data/eleet.json.

The site serves one JSON file with per-card wishlist and trade-list counts (it appears to
aggregate the PokeTrade app). We keep only the fields we use, keyed by our card_id.
"""
import json
import pathlib
import urllib.request

URL = 'https://pokemon.eleet.dev/api/data'
OUT = pathlib.Path(__file__).resolve().parent / 'data' / 'eleet.json'


def main():
    req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.load(r)
    cards = {
        c['id'].replace('_', '-'): {'wish': c['wish_count'], 'offers': c['trade_count']}
        for c in data['cards']
    }
    OUT.write_text(json.dumps(cards, ensure_ascii=False, sort_keys=True, indent=0))
    print(f'eleet: {len(cards)} cards')


if __name__ == '__main__':
    main()
