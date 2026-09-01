/**
 * Regression coverage for the vassal/domination safeguards that keep complete
 * military elimination from routinely bypassing the vassal system.
 *
 * Two guarantees are locked in here:
 *  1. NationCollapseSystem must clear ONLY the collapsing nation's residence
 *     capital. A previous version also matched `|| city.isResidenceCapital`, which
 *     wiped every surviving nation's residence-capital flag on any collapse —
 *     silently disabling the capital-capture vassalization safeguard worldwide.
 *  2. PoliticalCapitalSystem.ensureResidenceCapitals must guarantee each surviving
 *     nation that owns a city has exactly one residence capital, so a nation that
 *     lost the flag through some lifecycle edge can still be vassalized on conquest
 *     instead of being eliminated outright.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import { HappinessSystem } from '../src/systems/HappinessSystem.ts';
import { NationCollapseSystem } from '../src/systems/NationCollapseSystem.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { PoliticalCapitalSystem } from '../src/systems/PoliticalCapitalSystem.ts';
import { ProductionSystem } from '../src/systems/ProductionSystem.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import { UnitManager } from '../src/systems/UnitManager.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import { TileType, type MapData } from '../src/types/map.ts';

const COLLAPSING_ID = 'nation_mongolia';
const BYSTANDER_ID = 'nation_france';
const CONQUEROR_ID = 'nation_china';

function makeMap(): MapData {
  return {
    width: 4,
    height: 1,
    tileSize: 32,
    tiles: [[0, 1, 2, 3].map((x) => ({ x, y: 0, type: TileType.Plains, ownerId: undefined }))],
  };
}

function collapseHarness() {
  const nationManager = new NationManager();
  nationManager.addNation(new Nation({ id: COLLAPSING_ID, name: 'Mongolia', color: 0x1e90ff }));
  nationManager.addNation(new Nation({ id: BYSTANDER_ID, name: 'France', color: 0x002395 }));
  nationManager.addNation(new Nation({ id: CONQUEROR_ID, name: 'China', color: 0xde2910 }));

  const mapData = makeMap();
  const gridSystem = new HexGridSystem();
  const cityManager = new CityManager();
  const turnManager = new TurnManager(nationManager);
  const happinessSystem = new HappinessSystem(nationManager, cityManager);
  const productionSystem = new ProductionSystem(cityManager, turnManager, happinessSystem);
  const unitManager = new UnitManager(mapData.width, mapData.height);
  const diplomacyManager = new DiplomacyManager(turnManager);

  const collapseSystem = new NationCollapseSystem(
    cityManager,
    unitManager,
    nationManager,
    turnManager,
    mapData,
    productionSystem,
    diplomacyManager,
    gridSystem,
  );

  return { nationManager, cityManager, collapseSystem };
}

test('collapse clears the collapsing nation\'s residence capital but never a bystander\'s', () => {
  const h = collapseHarness();

  // The collapsing nation's capital (already transferred to the conqueror by the
  // capturing combat) is passed as the trigger city.
  const mongolCapital = new City({
    id: 'city_ulaanbaatar', name: 'Ulaanbaatar', ownerId: CONQUEROR_ID,
    originNationId: COLLAPSING_ID, tileX: 0, tileY: 0, isCapital: true,
  });
  const bystanderCapital = new City({
    id: 'city_paris', name: 'Paris', ownerId: BYSTANDER_ID,
    originNationId: BYSTANDER_ID, tileX: 2, tileY: 0, isCapital: true,
  });
  h.cityManager.addCity(mongolCapital);
  h.cityManager.addCity(bystanderCapital);

  const event = h.collapseSystem.collapse({
    nationId: COLLAPSING_ID,
    conquerorNationId: CONQUEROR_ID,
    reason: 'no_valid_survival_state',
    triggerCity: mongolCapital,
  });

  assert.notEqual(event, null);
  // The bystander keeps its residence capital — the whole point of the fix.
  assert.equal(bystanderCapital.isResidenceCapital, true);
  // The collapsed nation's former capital is no longer a residence capital.
  assert.equal(mongolCapital.isResidenceCapital, false);
});

function capitalHarness() {
  const nationManager = new NationManager();
  nationManager.addNation(new Nation({ id: BYSTANDER_ID, name: 'France', color: 0x002395 }));
  const cityManager = new CityManager();
  const turnManager = new TurnManager(nationManager);
  const system = new PoliticalCapitalSystem(cityManager, nationManager, turnManager);
  return { cityManager, system };
}

test('ensureResidenceCapitals promotes the original capital when a nation has none', () => {
  const h = capitalHarness();
  const capital = new City({
    id: 'city_paris', name: 'Paris', ownerId: BYSTANDER_ID, originNationId: BYSTANDER_ID,
    tileX: 0, tileY: 0, isOriginalCapital: true, isResidenceCapital: false,
  });
  const other = new City({
    id: 'city_lyon', name: 'Lyon', ownerId: BYSTANDER_ID, originNationId: BYSTANDER_ID,
    tileX: 1, tileY: 0, isResidenceCapital: false,
  });
  h.cityManager.addCity(capital);
  h.cityManager.addCity(other);

  h.system.ensureResidenceCapitals([BYSTANDER_ID]);

  const flagged = h.cityManager.getCitiesByOwner(BYSTANDER_ID).filter((c) => c.isResidenceCapital);
  assert.equal(flagged.length, 1);
  assert.equal(flagged[0].id, 'city_paris');
});

test('ensureResidenceCapitals collapses multiple residence capitals to exactly one', () => {
  const h = capitalHarness();
  const a = new City({
    id: 'city_a', name: 'A', ownerId: BYSTANDER_ID, originNationId: BYSTANDER_ID,
    tileX: 0, tileY: 0, isOriginalCapital: true, isResidenceCapital: true,
  });
  const b = new City({
    id: 'city_b', name: 'B', ownerId: BYSTANDER_ID, originNationId: BYSTANDER_ID,
    tileX: 1, tileY: 0, isResidenceCapital: true,
  });
  h.cityManager.addCity(a);
  h.cityManager.addCity(b);

  h.system.ensureResidenceCapitals([BYSTANDER_ID]);

  const flagged = h.cityManager.getCitiesByOwner(BYSTANDER_ID).filter((c) => c.isResidenceCapital);
  assert.equal(flagged.length, 1);
  // Prefers the original-capital city when resolving the ambiguity.
  assert.equal(flagged[0].id, 'city_a');
});

test('ensureResidenceCapitals is a no-op for a nation that already has exactly one', () => {
  const h = capitalHarness();
  const capital = new City({
    id: 'city_paris', name: 'Paris', ownerId: BYSTANDER_ID, originNationId: BYSTANDER_ID,
    tileX: 0, tileY: 0, isOriginalCapital: true, isResidenceCapital: true,
  });
  const other = new City({
    id: 'city_lyon', name: 'Lyon', ownerId: BYSTANDER_ID, originNationId: BYSTANDER_ID,
    tileX: 1, tileY: 0, isResidenceCapital: false,
  });
  h.cityManager.addCity(capital);
  h.cityManager.addCity(other);

  h.system.ensureResidenceCapitals([BYSTANDER_ID]);

  assert.equal(capital.isResidenceCapital, true);
  assert.equal(other.isResidenceCapital, false);
});
