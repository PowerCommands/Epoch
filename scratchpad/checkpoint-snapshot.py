#!/usr/bin/env python3
"""Per-checkpoint world-state snapshot for the all-victories general analysis.
Read-only. Usage: checkpoint-snapshot.py <checkpoint.json>"""
import json, sys
from collections import Counter, defaultdict

s = json.load(open(sys.argv[1]))
turn = (s.get('turn') or {}).get('currentRound', '?') if isinstance(s.get('turn'), dict) else s.get('turn')
print(f"===== CHECKPOINT turn {turn} =====")

nations = {n['id']: n for n in s.get('nations', [])}
cities = s.get('cities', [])
owner_cities = Counter(c.get('ownerId') for c in cities)
fac = Counter(); pop_by = Counter(); wonders_by = Counter()
for c in cities:
    pop_by[c.get('ownerId')] += c.get('population', 0) or 0
    for b in (c.get('buildings') or []):
        bid = b.get('buildingTypeId') if isinstance(b, dict) else b
        if bid == 'factory': fac[c.get('ownerId')] += 1
for w in (s.get('wonders') or []):
    if isinstance(w, dict):
        wonders_by[w.get('ownerNationId') or w.get('ownerId') or w.get('nationId')] += 1

print("\n-- NATIONS (strategy / agenda / personality drive identity) --")
for nid, n in nations.items():
    short = nid.replace('nation_', '')
    techs = len(n.get('researchedTechIds') or [])
    print(f"  {short:9s} techs={techs:2d} gold={round(n.get('gold',0)):6d} cul={round(n.get('culture',0)):5d} "
          f"inf={round(n.get('influence',0)):4d} cities={owner_cities.get(nid,0):2d} pop={pop_by.get(nid,0):4d} "
          f"fac={fac.get(nid,0)} won={wonders_by.get(nid,0)} | {n.get('aiStrategyId','?')}/{n.get('aiNationalAgendaId','?')}/{n.get('covertPersonalityId','?')}")

print("\n-- DIPLOMACY (war / notable hostility) --")
any_d = False
for r in s.get('diplomacy', []):
    a = r['nationA'].replace('nation_',''); b = r['nationB'].replace('nation_','')
    if r.get('state') == 'WAR' or r.get('hostility',0) >= 50 or r.get('trust',100) <= 20:
        any_d = True
        print(f"  {a:9s}<->{b:9s} {r.get('state'):5s} trust={round(r.get('trust',0)):3d} fear={round(r.get('fear',0)):3d} host={round(r.get('hostility',0)):3d}")
if not any_d: print("  (all peace, no notable hostility)")

wc = s.get('worldCouncil') or {}
er = wc.get('enactedResolutions') or []
if er:
    print(f"\n-- WORLD COUNCIL: {len(er)} enacted --")
    for r in er[-6:]:
        print(f"  t{r.get('turn')}: {r.get('resolutionId')} target={r.get('targetNationId')}")

ap = s.get('aerospaceParts') or []
if ap:
    print("\n-- AEROSPACE PARTS --")
    for e in ap: print(f"  {e.get('nationId','').replace('nation_',''):9s} {e.get('quantity')}/10")

corps = s.get('corporations') or []
if corps:
    print(f"\n-- CORPORATIONS: {len(corps)} --")
    for c in sorted(corps, key=lambda x: x.get('foundedTurn',0)):
        print(f"  t{c.get('foundedTurn'):4d} {c.get('corporationId'):30s} {c.get('founderNationId','').replace('nation_','')}")

res_owner = defaultdict(Counter)
for t in s.get('tiles', []):
    rid = t.get('resourceId')
    if rid in ('aluminum','oil','uranium'):
        res_owner[rid][(t.get('ownerId') or 'UNOWNED').replace('nation_','')] += 1
if res_owner:
    print("\n-- STRATEGIC RESOURCES --")
    for rid, c in res_owner.items(): print(f"  {rid}: {dict(c)}")
