"""Snapshot pokemontcglivetrade.org's card ranking for every CardLevel into data/rankings/lv{N}.json.

The site (https://pokemontcglivetrade.org/en/card-ranking) is client-rendered; its data
comes from the public API below, found in the site's JS bundle. Only CardLevel 6 (☆☆)
has community Elo votes; every level has trade-board demand/supply counts.
"""
import json
import pathlib
import urllib.request

API = 'https://pokemonvmdns.eastasia.cloudapp.azure.com/api/card-value/rankings'
OUT = pathlib.Path(__file__).resolve().parent / 'data' / 'rankings'


def fetch(level):
    req = urllib.request.Request(f'{API}?cardLevel={level}&pageIndex=0&pageSize=5000', headers={
        'User-Agent': 'Mozilla/5.0',
        'Origin': 'https://pokemontcglivetrade.org',
    })
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for level in range(1, 11):
        data = fetch(level)
        (OUT / f'lv{level}.json').write_text(json.dumps(data, ensure_ascii=False))
        print(f"rankings level {level}: {len(data['items'])} cards, {data['totalVoteCount']} votes")


if __name__ == '__main__':
    main()
