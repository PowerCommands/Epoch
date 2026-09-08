import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { ScenarioLoader } from '../src/systems/ScenarioLoader';
import { RIVER_DIRECTIONS, riverNeighbors } from '../src/systems/geography/Rivers';
import { getNaturalResourceById } from '../src/data/naturalResources';
import { getDefaultLeaderByNationId, getLeadersByNationId } from '../src/data/leaders';
import { getNationDefinitionById } from '../src/data/nations';
import type { ScenarioData } from '../src/types/scenario';
import type { TileType } from '../src/types/map';

const scenario: ScenarioData = JSON.parse(fs.readFileSync('public/assets/maps/america.json', 'utf8'));
const expected = [
  ['nation_canada', 'leader_justin_trudeau', 49, 34],
  ['nation_usa', 'leader_donald_j_trump', 46, 43],
  ['nation_mexico', 'leader_claudia_sheinbaum_pardo', 20, 61],
  ['nation_brazil', 'leader_jair_bolsonaro', 51, 104],
  ['nation_argentina', 'leader_javier_milei', 33, 124],
] as const;
const tile = (q: number, r: number) => scenario.map.tiles[r * 75 + q];
const inBounds = (q: number, r: number) => q >= 0 && q < 75 && r >= 0 && r < 150;
const walkable = (q: number, r: number) => inBounds(q, r) && !['ocean', 'coast', 'mountain', 'ice'].includes(tile(q, r).type);
function flood(q: number, r: number, allowed: (q: number, r: number) => boolean) {
  const seen = new Set<string>([`${q},${r}`]);
  const queue = [[q, r]];
  for (let i = 0; i < queue.length; i++) for (const [dq, dr] of RIVER_DIRECTIONS) {
    const x = queue[i][0] + dq, y = queue[i][1] + dr, key = `${x},${y}`;
    if (!seen.has(key) && allowed(x, y)) { seen.add(key); queue.push([x, y]); }
  }
  return seen;
}

test('America is registered with exactly five canonical nations, leaders and capital Settlers', () => {
  const manifest = JSON.parse(fs.readFileSync('public/assets/maps/manifest.json', 'utf8'));
  assert.equal(manifest.maps.filter((m: any) => m.key === 'map_america' && m.file === 'assets/maps/america.json').length, 1);
  assert.equal(scenario.meta.name, 'America');
  assert.deepEqual([scenario.map.width, scenario.map.height], [75, 150]);
  assert.equal(scenario.nations.length, 5);
  assert.equal(scenario.units.length, 5);
  assert.equal(scenario.cities.length, 0);
  for (const [id, leaderId, q, r] of expected) {
    const nation = scenario.nations.find(n => n.id === id)!;
    assert.ok(nation, id);
    assert.equal(nation.color, getNationDefinitionById(id)!.color);
    assert.equal(nation.leaderId ?? getDefaultLeaderByNationId(id)!.id, leaderId);
    assert.ok(getLeadersByNationId(id).some(l => l.id === leaderId));
    assert.deepEqual(nation.startTerritoryCenter, { q, r });
    assert.deepEqual(scenario.units.find(u => u.nationId === id), { nationId: id, unitTypeId: 'settler', q, r });
    assert.equal(tile(q, r).type, 'meadow');
    assert.ok(RIVER_DIRECTIONS.filter(([dq, dr]) => walkable(q + dq, r + dr)).length >= 4, `${id}: usable adjacent land`);
    const nearby = scenario.map.tiles.filter(t => Math.max(Math.abs(t.q-q), Math.abs(t.r-r), Math.abs(t.q+t.r-q-r)) <= 4);
    assert.ok(nearby.filter(t => t.resourceId).length >= 3, `${id}: early resources`);
  }
});

test('all authored tiles, terrain-compatible resources and reciprocal rivers survive the normal loader', () => {
  assert.equal(scenario.map.tiles.length, 11250);
  assert.equal(new Set(scenario.map.tiles.map(t => `${t.q},${t.r}`)).size, 11250);
  const parsed = ScenarioLoader.parse(scenario);
  let resources = 0, rivers = 0;
  for (const t of scenario.map.tiles) {
    assert.ok(inBounds(t.q, t.r));
    const loaded = parsed.mapData.tiles[t.r][t.q];
    assert.equal(loaded.type, t.type);
    assert.equal(loaded.resourceId, t.resourceId);
    assert.equal(loaded.riverConnections, t.riverConnections);
    if (t.resourceId) {
      resources++;
      assert.ok(getNaturalResourceById(t.resourceId)?.allowedTileTypes.includes(t.type as TileType), `${t.resourceId} at ${t.q},${t.r}`);
    }
    if (t.riverConnections) {
      rivers++;
      assert.ok(t.riverConnections > 0 && t.riverConnections <= 63);
      assert.notEqual(t.type, 'mountain');
      for (const n of riverNeighbors(t.q, t.r, t.riverConnections)) {
        assert.ok(inBounds(n.q, n.r));
        assert.ok(riverNeighbors(n.q, n.r, tile(n.q, n.r).riverConnections ?? 0).some(p => p.q === t.q && p.r === t.r));
      }
      if (['ocean', 'coast'].includes(t.type)) assert.ok(riverNeighbors(t.q, t.r, t.riverConnections).every(n => !['ocean','coast'].includes(tile(n.q,n.r).type)), 'water must be an outlet, not a broken offshore reach');
    }
  }
  assert.equal(resources, 190);
  assert.ok(rivers >= 190);
  for (const type of ['mountain', 'jungle', 'desert', 'forest', 'plains', 'meadow', 'beach', 'ice']) assert.ok(scenario.map.tiles.some(t => t.type === type));
});

test('capital sites share a traversable mainland and both oceans connect around the southern tip', () => {
  const mainland = flood(49, 34, walkable);
  for (const [id, , q, r] of expected) assert.ok(mainland.has(`${q},${r}`), `${id}: mainland access`);
  assert.ok(mainland.size > 2000);
  const water = flood(5, 40, (q, r) => inBounds(q,r) && ['ocean','coast'].includes(tile(q,r).type));
  for (const [q,r] of [[60,40],[10,100],[70,100],[10,148],[65,148]]) assert.ok(water.has(`${q},${r}`), `ocean passage ${q},${r}`);
});
