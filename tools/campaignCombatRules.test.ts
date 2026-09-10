import assert from 'node:assert/strict';
import test from 'node:test';
import { ARCHER, CATAPULT, FRIGATE, WARRIOR, BOMBER, GUIDED_MISSILE } from '../src/data/units';
import { Unit } from '../src/entities/Unit';
import { Nation } from '../src/entities/Nation';
import { City } from '../src/entities/City';
import { TileType, type MapData } from '../src/types/map';
import { UnitManager } from '../src/systems/UnitManager';
import { CityManager } from '../src/systems/CityManager';
import { NationManager } from '../src/systems/NationManager';
import { TurnManager } from '../src/systems/TurnManager';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem';
import { CombatSystem, type CombatEvent } from '../src/systems/CombatSystem';
import type { ProductionSystem } from '../src/systems/ProductionSystem';
import { DiplomacyManager } from '../src/systems/DiplomacyManager';
import { UnitUpgradeSystem } from '../src/systems/UnitUpgradeSystem';
import { PolicySystem } from '../src/systems/PolicySystem';

function harness(naval = false) {
  const map: MapData = { width: 8, height: 8, tileSize: 1, tiles: Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => ({ x, y, type: naval ? TileType.Ocean : TileType.Plains }))) };
  const grid = new HexGridSystem();
  const units = new UnitManager(8, 8);
  const cities = new CityManager();
  const nations = new NationManager();
  for (const id of ['a', 'b', 'c']) nations.addNation(new Nation({ id, name: id, color: 1, unlockedCultureNodeIds: ['craftsmanship'] }));
  const turns = new TurnManager(nations);
  const diplomacy = new DiplomacyManager();
  diplomacy.declareWar('a', 'b');
  const combat = new CombatSystem(units, turns, cities, {} as ProductionSystem, map, diplomacy, grid);
  const policies = new PolicySystem(nations);
  const upgrades = new UnitUpgradeSystem(nations, units, map, undefined, {}, undefined, policies);
  nations.getResources('a').gold = 10000;
  const unit = (type = WARRIOR, ownerId = 'a', x = 3, y = 3) => {
    const u = new Unit({ id: `u${units.getAllUnits().length}`, name: type.name, ownerId, tileX: x, tileY: y, unitType: type });
    units.addUnit(u); return u;
  };
  return { map, units, cities, nations, combat, policies, upgrades, unit, grid };
}

for (const type of [ARCHER, CATAPULT, FRIGATE]) {
  test(`${type.name}: adjacent enemy blocks all bombardment, adjacent combat uses melee and retaliation`, () => {
    const h = harness(!!type.isNaval);
    const attacker = h.unit(type);
    const defender = h.unit(type.isNaval ? FRIGATE : WARRIOR, 'b', 4, 3);
    const distant = h.unit(type.isNaval ? FRIGATE : WARRIOR, 'b', 3, 5);
    const hp = distant.health;
    const movement = attacker.movementPoints;
    assert.equal(h.combat.tryAttack(attacker, 3, 5), false);
    assert.equal(distant.health, hp);
    assert.equal(attacker.movementPoints, movement);
    let event: CombatEvent | undefined;
    h.combat.on(e => { event = e; });
    assert.equal(h.combat.tryAttack(attacker, defender.tileX, defender.tileY), true);
    assert.equal(event?.isRanged, false);
    assert.ok(event!.result.attackerDamageTaken > 0);
  });

  test(`${type.name}: ranged attacks work again after the adjacent enemy leaves`, () => {
    const h = harness(!!type.isNaval);
    const attacker = h.unit(type);
    const adjacent = h.unit(type.isNaval ? FRIGATE : WARRIOR, 'b', 4, 3);
    h.unit(type.isNaval ? FRIGATE : WARRIOR, 'b', 3, 5);
    h.units.removeUnit(adjacent.id);
    let event: CombatEvent | undefined;
    h.combat.on(e => { event = e; });
    assert.equal(h.combat.tryAttack(attacker, 3, 5), true);
    assert.equal(event?.isRanged, true);
    assert.equal(event?.result.attackerDamageTaken, 0);
  });
}

test('all six hex neighbors suppress range; nonadjacent diagonal, own and peaceful units do not', () => {
  for (const coord of new HexGridSystem().getAdjacentCoords({ x: 3, y: 3 })) {
    const h = harness(); const attacker = h.unit(ARCHER); h.unit(WARRIOR, 'b', coord.x, coord.y);
    assert.equal(h.combat.isRangedAttackBlocked(attacker), true);
  }
  for (const [owner, x, y] of [['a', 4, 3], ['c', 4, 3], ['b', 4, 4]] as const) {
    const h = harness(); const attacker = h.unit(ARCHER); h.unit(WARRIOR, owner, x, y);
    assert.equal(h.combat.isRangedAttackBlocked(attacker), false);
  }
});

test('enemy adjacency blocks city bombardment too', () => {
  const h = harness(); const attacker = h.unit(ARCHER); h.unit(WARRIOR, 'b', 4, 3);
  const city = new City({ id: 'city', name: 'City', ownerId: 'b', tileX: 3, tileY: 5 }); h.cities.addCity(city);
  const hp = city.health;
  assert.equal(h.combat.tryAttack(attacker, 3, 5), false);
  assert.equal(city.health, hp);
});

test('aircraft and missiles retain range with an adjacent enemy', () => {
  for (const type of [BOMBER, GUIDED_MISSILE]) {
    const h = harness(); const attacker = h.unit(type); h.unit(WARRIOR, 'b', 4, 3);
    assert.equal(h.combat.isRangedAttackBlocked(attacker), false);
    assert.equal(h.combat.getEffectiveAttackRange(attacker), type.range);
    let dispatched = false;
    if (type === BOMBER) h.combat.airOperations.mission = () => { dispatched = true; return true; };
    else h.combat.strategicWeapons.launch = () => { dispatched = true; return true; };
    assert.equal(h.combat.tryAttack(attacker, 3, 5), true);
    assert.equal(dispatched, true);
  }
});

test('upgrades require own territory; Mercenaries alone is insufficient; active policy allows every territory', () => {
  for (const ownerId of [undefined, 'a', 'b', 'c']) {
    const h = harness(); const unit = h.unit(ARCHER);
    h.map.tiles[3][3].ownerId = ownerId;
    assert.equal(h.policies.canActivatePolicy('a', 'campaign_logistics'), false);
    h.nations.getNation('a')!.unlockedCultureNodeIds.push('mercenaries');
    assert.equal(h.upgrades.canUpgradeUnit(unit, 'a'), ownerId === 'a');
    if (ownerId !== 'a') {
      const gold = h.nations.getResources('a').gold;
      assert.equal(h.upgrades.upgradeUnit(unit, 'a'), false);
      assert.equal(h.nations.getResources('a').gold, gold);
      assert.equal(unit.unitType.id, ARCHER.id);
    }
    assert.equal(h.policies.activatePolicy('a', 'campaign_logistics', 'military'), true);
    assert.equal(h.upgrades.canUpgradeUnit(unit, 'a'), true);
    h.policies.deactivatePolicy('a', 'campaign_logistics');
    assert.equal(h.upgrades.canUpgradeUnit(unit, 'a'), ownerId === 'a');
    h.policies.activatePolicy('a', 'campaign_logistics', 'military');
    h.nations.getResources('a').gold = 0;
    assert.equal(h.upgrades.canUpgradeUnit(unit, 'a'), false);
    h.nations.getResources('a').gold = 10000;
    assert.equal(h.upgrades.upgradeUnit(unit, 'a'), true);
    assert.equal(unit.unitType.id, ARCHER.upgradeToUnitId);
  }
});
