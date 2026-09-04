import assert from 'node:assert/strict';
import test from 'node:test';

import type { City } from '../src/entities/City.ts';
import type { Unit } from '../src/entities/Unit.ts';
import { CheatSystem, type GameContext } from '../src/systems/CheatSystem.ts';

function makeCheats(selection: unknown) {
  const changedUnits: Unit[] = [];
  const changedCities: City[] = [];
  const context = {
    selectionManager: { getSelected: () => selection },
    unitManager: { notifyDamaged: (unit: Unit) => { changedUnits.push(unit); } },
    cityManager: { notifyHealthChanged: (city: City) => { changedCities.push(city); } },
  } as unknown as GameContext;

  return { cheats: new CheatSystem(context), changedUnits, changedCities };
}

test('heal restores the selected unit to its full base health and announces the change', () => {
  const unit = {
    name: 'Warrior',
    health: 37,
    unitType: { baseHealth: 100 },
  } as Unit;
  const { cheats, changedUnits } = makeCheats({ kind: 'unit', unit });

  assert.equal(cheats.execute('heal'), 'Healed Warrior to full health');
  assert.equal(unit.health, 100);
  assert.deepEqual(changedUnits, [unit]);
});

test('heal reports no selected unit or city and changes nothing when selection is empty or a tile', () => {
  for (const selection of [null, { kind: 'tile', tile: { x: 2, y: 3 } }]) {
    const { cheats, changedUnits, changedCities } = makeCheats(selection);
    assert.equal(cheats.execute('heal'), 'No unit or city selected');
    assert.deepEqual(changedUnits, []);
    assert.deepEqual(changedCities, []);
  }
});

test('heal is a no-op when the selected unit already has full health', () => {
  const unit = {
    name: 'Scout',
    health: 100,
    unitType: { baseHealth: 100 },
  } as Unit;
  const { cheats, changedUnits } = makeCheats({ kind: 'unit', unit });

  assert.equal(cheats.execute('heal'), 'Scout is already at full health');
  assert.equal(unit.health, 100);
  assert.deepEqual(changedUnits, []);
});

test('heal repairs the selected city to full health and announces the change', () => {
  const city = { id: 'london', name: 'London', health: 81 } as City;
  const { cheats, changedCities } = makeCheats({ kind: 'city', city });

  assert.equal(cheats.execute('heal'), 'Repaired London to full health');
  assert.equal(city.health, 200);
  assert.deepEqual(changedCities, [city]);
});

test('heal is a no-op when the selected city already has full health', () => {
  const city = { id: 'paris', name: 'Paris', health: 200 } as City;
  const { cheats, changedCities } = makeCheats({ kind: 'city', city });

  assert.equal(cheats.execute('heal'), 'Paris is already at full health');
  assert.equal(city.health, 200);
  assert.deepEqual(changedCities, []);
});

test('heal accepts no arguments and is listed in help and command completion', () => {
  const { cheats } = makeCheats(null);

  assert.equal(cheats.execute('heal now'), 'Usage: heal');
  assert.match(cheats.execute('help'), /^heal - Restore the currently selected unit or city to full health\.$/m);
  assert.ok(cheats.getCompletions('hea').some((suggestion) => suggestion.value === 'heal'));
});
