"""pokemontcglivetrade.org PackId / CardLevel -> our expansion ids and rarity strings.

When a new set drops, its PackId shows up in the rankings and build_values.py stops with
the unknown id and its card counts. Add one line to PACKS (match the card count against
the new set's size in frontend/assets/cards.json).
"""

# PackId -> expansion id used in frontend/assets/cards.json
PACKS = {
    1: 'A1',    # Genetic Apex
    2: 'A1a',   # Mythical Island
    3: 'A2',    # Space-Time Smackdown
    4: 'A2a',   # Triumphant Light
    5: 'A2b',   # Shining Revelry
    6: 'A3',    # Celestial Guardians
    7: 'A3a',   # Extradimensional Crisis
    8: 'A3b',   # Eevee Grove
    9: 'A4',    # Wisdom of Sea and Sky
    10: 'A4a',  # Secluded Springs
    11: 'A4b',  # Deluxe Pack: ex
    12: 'B1',   # Mega Rising
    13: 'B1a',  # Crimson Blaze
    14: 'B2',   # Fantastical Parade
    15: 'B2a',  # Paldean Wonders
    16: 'B2b',  # Mega Shine
    17: 'B3',   # Pulsing Aura
    18: 'B3a',  # Paradox Drive
    19: 'B3b',  # Everyday Wonders
    20: 'B4',   # Ruler of the Skies
    21: 'B4a',  # Team Rocket's Ambition
    22: 'B4b',  # Deluxe Pack: Mega
    23: 'C1',   # Dual Fusion
}

# CardLevel used by the ranking API -> rarity string used in cards.json
LEVELS = {
    1: '◊', 2: '◊◊', 3: '◊◊◊', 4: '◊◊◊◊',
    5: '☆', 6: '☆☆', 7: '☆☆☆', 8: 'Crown Rare',
    9: '✵', 10: '✵✵',
}

TWO_STAR_LEVEL = 6
