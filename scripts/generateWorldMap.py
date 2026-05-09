#!/usr/bin/env python3
"""Generate worldScenario.json — a compressed Civilization-style world map (200x120)."""

import json
import os
from collections import Counter

WIDTH = 200
HEIGHT = 120

grid = [['ocean'] * WIDTH for _ in range(HEIGHT)]

def in_bounds(q, r):
    return 0 <= q < WIDTH and 0 <= r < HEIGHT

def fill_ellipse(qc, rc, qr, rr, tile):
    for r in range(max(0, rc - rr - 1), min(HEIGHT, rc + rr + 2)):
        for q in range(max(0, qc - qr - 1), min(WIDTH, qc + qr + 2)):
            if ((q - qc) / max(qr, 0.5)) ** 2 + ((r - rc) / max(rr, 0.5)) ** 2 <= 1.0:
                grid[r][q] = tile

def fill_rect(q1, r1, q2, r2, tile):
    for r in range(max(0, r1), min(HEIGHT, r2 + 1)):
        for q in range(max(0, q1), min(WIDTH, q2 + 1)):
            grid[r][q] = tile

def overlay_ellipse(qc, rc, qr, rr, tile):
    """Paint tile only on existing land (non-ocean)."""
    for r in range(max(0, rc - rr - 1), min(HEIGHT, rc + rr + 2)):
        for q in range(max(0, qc - qr - 1), min(WIDTH, qc + qr + 2)):
            if ((q - qc) / max(qr, 0.5)) ** 2 + ((r - rc) / max(rr, 0.5)) ** 2 <= 1.0:
                if grid[r][q] != 'ocean':
                    grid[r][q] = tile

def force_ocean(q1, r1, q2, r2):
    fill_rect(q1, r1, q2, r2, 'ocean')


# ═══════════════════════════════════════════
#  NORTH AMERICA
# ═══════════════════════════════════════════
fill_ellipse(32, 38, 26, 32, 'plains')       # main landmass
fill_ellipse(13, 40, 5, 22, 'mountain')       # Rockies
fill_ellipse(25, 11, 18, 8, 'forest')         # Canadian boreal
overlay_ellipse(46, 28, 10, 12, 'forest')     # NE forests
overlay_ellipse(46, 52, 9, 10, 'forest')      # SE forests
overlay_ellipse(27, 40, 10, 15, 'plains')     # Great Plains emphasis
fill_ellipse(44, 65, 4, 5, 'plains')          # Florida
fill_rect(28, 65, 38, 74, 'plains')           # Central America isthmus

# ═══════════════════════════════════════════
#  SOUTH AMERICA
# ═══════════════════════════════════════════
fill_ellipse(38, 95, 15, 22, 'plains')        # main landmass
fill_ellipse(28, 94, 4, 20, 'mountain')       # Andes
overlay_ellipse(40, 88, 10, 12, 'jungle')     # Amazon basin
fill_ellipse(50, 91, 5, 15, 'plains')         # Brazil east coast plains
fill_ellipse(35, 114, 8, 5, 'plains')         # Patagonia

# ═══════════════════════════════════════════
#  FORCE ATLANTIC OCEAN
# ═══════════════════════════════════════════
force_ocean(62, 5, 80, 115)

# ═══════════════════════════════════════════
#  EUROPE
# ═══════════════════════════════════════════
fill_ellipse(86, 18, 4, 7, 'forest')          # England (island)
fill_ellipse(104, 13, 7, 13, 'forest')        # Scandinavia
overlay_ellipse(101, 14, 3, 10, 'mountain')   # Norwegian mountains
fill_rect(99, 22, 107, 28, 'plains')          # Denmark / N. Germany land bridge
fill_ellipse(91, 39, 8, 9, 'plains')          # Iberian Peninsula
overlay_ellipse(91, 42, 5, 5, 'desert')       # Meseta plateau
fill_ellipse(99, 29, 8, 8, 'forest')          # France
overlay_ellipse(99, 28, 5, 5, 'plains')       # French plains (inner)
fill_ellipse(110, 30, 8, 10, 'forest')        # Central Europe
overlay_ellipse(110, 30, 5, 6, 'plains')      # Central Europe plains
fill_ellipse(107, 43, 3, 7, 'plains')         # Italy
fill_ellipse(116, 38, 6, 7, 'plains')         # Balkans
fill_ellipse(122, 43, 8, 6, 'plains')         # Turkey / Anatolia

# English Channel and North Sea
force_ocean(83, 25, 98, 30)

# Mediterranean (q83-112 only so Turkey survives)
force_ocean(83, 49, 112, 55)

# ═══════════════════════════════════════════
#  AFRICA
# ═══════════════════════════════════════════
fill_ellipse(93, 58, 9, 8, 'desert')          # Morocco / NW Africa
fill_ellipse(113, 65, 20, 12, 'desert')       # Sahara
fill_ellipse(100, 80, 12, 10, 'plains')       # West Africa
overlay_ellipse(100, 76, 8, 6, 'desert')      # Sahel belt
fill_ellipse(120, 84, 10, 14, 'plains')       # East Africa
fill_ellipse(113, 106, 11, 13, 'plains')      # Southern Africa
# Sinai land bridge (Africa ↔ Middle East)
fill_rect(128, 63, 133, 70, 'desert')

# ═══════════════════════════════════════════
#  MIDDLE EAST & PERSIA
# ═══════════════════════════════════════════
fill_ellipse(132, 57, 9, 12, 'desert')        # Arabia
fill_rect(120, 48, 152, 68, 'desert')         # Persia / Afghanistan corridor

# ═══════════════════════════════════════════
#  INDIA
# ═══════════════════════════════════════════
fill_ellipse(150, 70, 10, 16, 'plains')       # Indian subcontinent
overlay_ellipse(150, 55, 12, 4, 'mountain')   # Himalayas
overlay_ellipse(160, 53, 10, 4, 'mountain')   # Himalayas east

# ═══════════════════════════════════════════
#  CHINA & EAST ASIA
# ═══════════════════════════════════════════
fill_ellipse(168, 38, 18, 23, 'plains')       # China heartland
fill_ellipse(158, 18, 15, 10, 'plains')       # Mongolia steppe
overlay_ellipse(158, 18, 10, 7, 'desert')     # Gobi Desert
overlay_ellipse(153, 42, 8, 8, 'mountain')    # Tibet
overlay_ellipse(168, 35, 8, 10, 'forest')     # Central China forests
fill_rect(155, 26, 172, 33, 'plains')         # Mongolia-China land bridge
fill_ellipse(171, 75, 8, 8, 'jungle')         # SE Asia
fill_rect(163, 62, 175, 68, 'jungle')         # SE Asia ↔ China bridge
fill_rect(158, 68, 168, 78, 'jungle')         # SE Asia ↔ India bridge

# ═══════════════════════════════════════════
#  JAPAN (island chain)
# ═══════════════════════════════════════════
fill_ellipse(188, 22, 3, 5, 'forest')         # Hokkaido
fill_ellipse(188, 31, 3, 9, 'forest')         # Honshu
fill_ellipse(187, 41, 3, 4, 'plains')         # Kyushu

# ═══════════════════════════════════════════
#  SEA OF JAPAN / KOREA STRAIT
# ═══════════════════════════════════════════
# China's ellipse extends to q≈186; Japan starts at q≈185.
# Force a clear sea channel so Japan is a proper island chain.
force_ocean(181, 16, 185, 50)

# ═══════════════════════════════════════════
#  CLEAN UP EDGES
# ═══════════════════════════════════════════
force_ocean(0, 0, 4, 119)                     # far west Pacific
force_ocean(195, 0, 199, 119)                 # far east Pacific edge

# ═══════════════════════════════════════════
#  APPLY COASTLINES
# ═══════════════════════════════════════════
DIRS = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, -1), (-1, 1)]
coast = [row[:] for row in grid]
for r in range(HEIGHT):
    for q in range(WIDTH):
        if grid[r][q] == 'ocean':
            for dq, dr in DIRS:
                nq, nr = q + dq, r + dr
                if in_bounds(nq, nr) and grid[nr][nq] not in ('ocean', 'coast'):
                    coast[r][q] = 'coast'
                    break
grid = coast

# ═══════════════════════════════════════════
#  NATION START POSITIONS
# ═══════════════════════════════════════════
# (id, name, color, secondary, isHuman, q, r)
nations_raw = [
    ('nation_usa',           'United States', '#2f80ed', '#dfeaf8', True,  40, 42),
    ('nation_brazil',        'Brazil',        '#009739', '#ffdf00', False, 50, 88),
    ('nation_england',       'England',       '#4a90d9', '#f2d479', False, 86, 18),
    ('nation_france',        'France',        '#7bc67e', '#f4efe2', False, 99, 30),
    ('nation_sweden',        'Sweden',        '#e87c4a', '#f3e3c4', False,104, 12),
    ('nation_spain',         'Spain',         '#e84a4a', '#f2d15c', False, 91, 36),
    ('nation_morocco_empire','Morocco',       '#9b5f4b', '#d9c39a', False, 93, 59),
    ('nation_mali_empire',   'Mali Empire',   '#b7950b', '#5b4b2a', False,102, 84),
    ('nation_india',         'India',         '#27ae60', '#f3d27a', False,150, 70),
    ('nation_china',         'China',         '#d64541', '#f0c46b', False,168, 38),
    ('nation_japan',         'Japan',         '#ffffff', '#bc002d', False,188, 31),
]

# Verify all start positions land on non-water tiles
print("=== Start position check ===")
problems = []
for n_id, name, _, _, _, q, r in nations_raw:
    tile = grid[r][q]
    status = '✓' if tile not in ('ocean', 'coast') else '✗ PROBLEM'
    print(f"  {name:20s} ({q:3d},{r:3d}) = {tile:8s} {status}")
    if tile in ('ocean', 'coast'):
        problems.append((name, q, r, tile))

if problems:
    print(f"\n⚠  {len(problems)} start position(s) on water — fix before using.")
else:
    print("\nAll start positions on land ✓")

# ═══════════════════════════════════════════
#  BUILD JSON
# ═══════════════════════════════════════════
nations = []
units = []
for n_id, name, color, sec, is_human, sq, sr in nations_raw:
    nations.append({
        'id': n_id,
        'name': name,
        'color': color,
        'secondaryColor': sec,
        'isHuman': is_human,
        'startTerritoryCenter': {'q': sq, 'r': sr},
    })
    units.append({'nationId': n_id, 'unitTypeId': 'settler', 'q': sq,     'r': sr})
    units.append({'nationId': n_id, 'unitTypeId': 'warrior', 'q': sq + 1, 'r': sr})

tiles = [
    {'q': q, 'r': r, 'type': grid[r][q]}
    for r in range(HEIGHT)
    for q in range(WIDTH)
]

scenario = {
    'meta': {'name': 'World 1400', 'version': 2},
    'map': {'width': WIDTH, 'height': HEIGHT, 'tileSize': 48, 'tiles': tiles},
    'nations': nations,
    'cities': [],
    'units': units,
}

out = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'maps', 'worldScenario.json')
out = os.path.normpath(out)
with open(out, 'w') as f:
    json.dump(scenario, f, separators=(',', ':'))

print(f"\nWritten: {out}")
print(f"Tiles: {len(tiles)}")

counts = Counter(grid[r][q] for r in range(HEIGHT) for q in range(WIDTH))
total = WIDTH * HEIGHT
for k in ('ocean', 'coast', 'plains', 'forest', 'mountain', 'jungle', 'desert'):
    v = counts.get(k, 0)
    print(f"  {k:10s} {v:5d} ({100*v/total:.1f}%)")
