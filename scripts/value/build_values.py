"""Join the newest ranking + eleet snapshot (data/snapshots/<date>/) onto frontend/assets/cards.json
and write frontend/assets/values.json, which the app bundles via lib/ValueDB.ts.

Per card (keyed by card_id, e.g. "A1-266"):
  demand, supply  trade-board want/offer counts (pokemontcglivetrade, all rarities)
  wish, offers    wishlist / trade-list counts (pokemon.eleet.dev, all rarities)
  same_as         reprint of that card (same internal_id), so wish/offers are its numbers too
  ☆☆ only:
  elo, rank       community vote Elo and rank among all ☆☆ (incl. deluxe)
  adj             vote-adjusted Elo, see SHRINK_K
  votes           vote count behind the Elo
  kind            full_art | trainer | rainbow
"""
import collections
import datetime
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import snapshots
from packs import LEVELS, PACKS, TWO_STAR_LEVEL

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
CARDS = ROOT / 'frontend' / 'assets' / 'cards.json'
OUT = ROOT / 'frontend' / 'assets' / 'values.json'

# Elo of low-vote cards hasn't spread out yet (a brand-new set has ~20 votes/card vs ~1300 for
# A-series), so shrink each card toward the global ☆☆ mean by reliability votes / (votes + K).
# Mature sets all get ~0.86, so their relative order is unchanged.
SHRINK_K = 200


def load_rankings(snapshot):
    levels = {}
    for level in LEVELS:
        levels[level] = json.loads((snapshot / 'rankings' / f'lv{level}.json').read_text())['items']
    unknown = collections.Counter(i['PackId'] for items in levels.values() for i in items if i['PackId'] not in PACKS)
    if unknown:
        sys.exit(f'Unknown PackIds (add them to scripts/value/packs.py): {dict(unknown)} '
                 f'(numbers are card counts across all rarities)')
    return levels


def classify_two_stars(cards_by_id, two_star_ids):
    """Every set prints ☆☆ as: full-art ex block -> trainer block -> rainbow ex block (reprints
    of the same ex). Verified on card images, e.g. A1 #255 vs #274 Moltres ex."""
    by_set = collections.defaultdict(list)
    for cid in two_star_ids:
        by_set[cards_by_id[cid]['expansion']].append(cards_by_id[cid])
    kinds = {}
    for cards in by_set.values():
        number = lambda c: int(c['card_id'].rsplit('-', 1)[1])
        last_trainer = max((number(c) for c in cards if c['card_type'] == 'trainer'), default=10**9)
        for c in cards:
            kinds[c['card_id']] = ('trainer' if c['card_type'] == 'trainer'
                                   else 'rainbow' if number(c) > last_trainer else 'full_art')
    return kinds


def pooled_reprints(cards):
    """A same-art reprint (e.g. A4b-1, the Deluxe Bulbasaur) shares its original's internal_id (A1-1): the game,
    the collection and eleet all treat them as one card. Map each reprint to the first card_id in cards.json order."""
    first = {}
    for c in cards:
        first.setdefault(c['internal_id'], c['card_id'])
    return {c['card_id']: first[c['internal_id']] for c in cards if first[c['internal_id']] != c['card_id']}


def main():
    cards = json.loads(CARDS.read_text())
    cards_by_id = {c['card_id']: c for c in cards}
    snapshot = snapshots.latest()
    print(f'snapshot: {snapshot.name}')
    levels = load_rankings(snapshot)
    eleet = json.loads((snapshot / 'eleet.json').read_text())

    values = collections.defaultdict(dict)
    mismatched = []
    for level, items in levels.items():
        for i in items:
            cid = f"{PACKS[i['PackId']]}-{i['CardNumber']}"
            card = cards_by_id.get(cid)
            if card is None:
                mismatched.append((cid, LEVELS[level], None))
                continue
            if card['rarity'] != LEVELS[level]:
                # Sources occasionally disagree on a brand-new set's rarities; the number still matches
                mismatched.append((cid, LEVELS[level], card['rarity']))
            values[cid].update(demand=i['DemandCount'], supply=i['SupplyCount'])

    two_star = levels[TWO_STAR_LEVEL]
    mu = sum(i['EloScore'] for i in two_star) / len(two_star)
    for i in two_star:
        cid = f"{PACKS[i['PackId']]}-{i['CardNumber']}"
        if cid in values:
            v = i['VoteCount']
            values[cid].update(elo=round(i['EloScore']), rank=i['Rank'], votes=v,
                               adj=round(mu + (i['EloScore'] - mu) * v / (v + SHRINK_K)))
    for cid, kind in classify_two_stars(cards_by_id, [c for c in values if 'elo' in values[c]]).items():
        values[cid]['kind'] = kind

    for cid, e in eleet.items():
        if cid in cards_by_id:
            values[cid].update(e)
    for cid, original in pooled_reprints(cards).items():
        values[cid]['same_as'] = original

    if mismatched:
        print(f'note: {len(mismatched)} ranking rows disagree with cards.json (card_id, ranking rarity, cards.json rarity): {mismatched[:5]}')

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        'generated_at': datetime.date.today().isoformat(),
        'two_star_count': len(two_star),
        'cards': dict(sorted(values.items())),
    }, ensure_ascii=False, separators=(',', ':')))
    n2 = sum('elo' in v for v in values.values())
    print(f'wrote {len(values)} cards ({n2} with ☆☆ Elo) to {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
