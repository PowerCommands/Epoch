import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { ScenarioLoader } from '../src/systems/ScenarioLoader';
import { riverNeighbors } from '../src/systems/geography/Rivers';
import { resolveScenarioMeta } from '../src/data/scenarioMeta';
import type { ScenarioData } from '../src/types/scenario';

const scenario: ScenarioData = JSON.parse(readFileSync('public/assets/maps/astra-europa.json', 'utf8'));
const map = ScenarioLoader.parse(scenario).mapData;
const registry = JSON.parse(readFileSync('public/assets/data/nations-manifest.json', 'utf8'));
const expectedStarts = {
  nation_sweden: { q: 78, r: 26 }, nation_england: { q: 47, r: 36 },
  nation_germany: { q: 68, r: 37 }, nation_france: { q: 48, r: 43 }, nation_hre: { q: 69, r: 44 },
};

test('Astra-Europa is a complete 150 × 75 map with five default nations and exactly five correctly positioned Settlers', () => {
  assert.equal(scenario.meta.name, 'Astra-Europa');
  assert.equal(map.width, 150);
  assert.equal(map.height, 75);
  assert.equal(scenario.map.tiles.length, 150 * 75);
  assert.equal(new Set(scenario.map.tiles.map(tile => `${tile.q},${tile.r}`)).size, 150 * 75);
  assert.deepEqual(scenario.nations.map(nation => nation.id).sort(), Object.keys(expectedStarts).sort());
  assert.equal(scenario.cities.length, 0);
  assert.equal(scenario.units.length, 5);
  for (const nation of scenario.nations) {
    const expected = expectedStarts[nation.id as keyof typeof expectedStarts];
    assert.deepEqual(nation.startTerritoryCenter, expected);
    assert.equal(nation.leaderId, undefined, 'omitted override selects the existing default leader');
    assert.equal(nation.leaderName, undefined);
    assert.equal(nation.leaderDescription, undefined);
    assert.equal(nation.gold, undefined);
    const registered = registry.nations.find((entry: { nationId: string }) => entry.nationId === nation.id);
    assert.ok(registered.leaders.some((leader: { isDefault: boolean }) => leader.isDefault));
    assert.equal(nation.color.toLowerCase(), registered.color.toLowerCase());
    assert.equal(nation.secondaryColor?.toLowerCase(), registered.secondaryColor.toLowerCase());
    assert.deepEqual(scenario.units.filter(unit => unit.nationId === nation.id), [{ nationId: nation.id, unitTypeId: 'settler', ...expected }]);
    assert.ok(['plains', 'meadow', 'forest'].includes(map.tiles[expected.r][expected.q].type));
  }
  assert.deepEqual(scenario.nationDetails, {});
  assert.deepEqual(scenario.initialDiplomacy, []);
  assert.deepEqual(scenario.historicalEvents, []);
  assert.deepEqual(resolveScenarioMeta(scenario.meta), { ...resolveScenarioMeta(undefined), name: 'Astra-Europa' });
});

test('every authored river link survives parsing, is reciprocal, and reaches a sea outlet', () => {
  const authored = scenario.map.tiles.filter(tile => tile.riverConnections);
  assert.ok(authored.length >= 140);
  for (const tile of authored) assert.equal(map.tiles[tile.r][tile.q].riverConnections, tile.riverConnections);
  const remaining = new Set(authored.map(tile => `${tile.q},${tile.r}`));
  const components: string[][] = [];
  while (remaining.size) {
    const start = remaining.values().next().value!;
    const queue = [start], component: string[] = [];
    remaining.delete(start);
    while (queue.length) {
      const key = queue.pop()!;
      component.push(key);
      const [q, r] = key.split(',').map(Number);
      for (const neighbor of riverNeighbors(q, r, map.tiles[r][q].riverConnections!)) {
        const reverse = riverNeighbors(neighbor.q, neighbor.r, map.tiles[neighbor.r][neighbor.q].riverConnections!);
        assert.ok(reverse.some(point => point.q === q && point.r === r));
        const next = `${neighbor.q},${neighbor.r}`;
        if (remaining.delete(next)) queue.push(next);
      }
    }
    components.push(component);
  }
  assert.equal(components.length, 9, 'nine river systems; the Inn joins the Danube, while Rhine and Danube remain separate');
  for (const component of components) {
    assert.ok(component.some(key => {
      const [q, r] = key.split(',').map(Number);
      return ['ocean', 'coast'].includes(map.tiles[r][q].type);
    }), `river at ${component[0]} needs an outlet`);
  }
  const danube = components.find(component => component.includes('60,44'))!;
  assert.ok(danube.length >= 35);
  assert.ok(danube.includes('66,43'), 'Inn confluence');
  assert.ok(!danube.includes('58,46'), 'Rhine headwaters belong to another watershed');
});
