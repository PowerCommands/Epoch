import assert from 'node:assert/strict';
import test from 'node:test';

import type { City } from '../src/entities/City.ts';
import type { Unit } from '../src/entities/Unit.ts';
import { CheatSystem, type GameContext } from '../src/systems/CheatSystem.ts';

interface FakeNation {
  id: string;
  name: string;
}

function makeCheats(
  selection: unknown,
  options: {
    humanNationId?: string;
    nations?: FakeNation[];
    unitsByOwner?: Record<string, Unit[]>;
  } = {},
) {
  const changedUnits: Unit[] = [];
  const changedCities: City[] = [];
  const nations = options.nations ?? [];
  const unitsByOwner = options.unitsByOwner ?? {};
  const context = {
    humanNationId: options.humanNationId,
    selectionManager: { getSelected: () => selection },
    nationManager: {
      getAllNations: () => nations,
      getNation: (id: string) => nations.find((nation) => nation.id === id),
    },
    unitManager: {
      notifyDamaged: (unit: Unit) => { changedUnits.push(unit); },
      getUnitsByOwner: (ownerId: string) => unitsByOwner[ownerId] ?? [],
    },
    cityManager: { notifyHealthChanged: (city: City) => { changedCities.push(city); } },
  } as unknown as GameContext;

  return { cheats: new CheatSystem(context), changedUnits, changedCities };
}

function makeUnit(name: string, health: number, baseHealth = 100): Unit {
  return { name, health, unitType: { baseHealth } } as Unit;
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

test('heal rejects unknown arguments and is listed in help and command completion', () => {
  const { cheats } = makeCheats(null);

  assert.equal(cheats.execute('heal now'), 'Usage: heal [all [nation]]');
  assert.match(cheats.execute('help'), /^heal - Restore the selected unit or city to full health, or every unit of a nation/m);
  assert.ok(cheats.getCompletions('hea').some((suggestion) => suggestion.value === 'heal'));
});

test('heal all heals every damaged unit of the named nation', () => {
  const china = makeUnit('Chinese Warrior', 20);
  const chinaFull = makeUnit('Chinese Scout', 100);
  const player = makeUnit('Player Warrior', 30);
  const { cheats, changedUnits } = makeCheats(null, {
    humanNationId: 'england',
    nations: [
      { id: 'england', name: 'England' },
      { id: 'china', name: 'China' },
    ],
    unitsByOwner: { china: [china, chinaFull], england: [player] },
  });

  assert.equal(cheats.execute('heal all China'), 'Healed 1 China unit(s) to full health');
  assert.equal(china.health, 100);
  assert.equal(chinaFull.health, 100);
  assert.equal(player.health, 30);
  assert.deepEqual(changedUnits, [china]);
});

test('heal all with no nation defaults to the human player', () => {
  const player = makeUnit('Player Warrior', 40);
  const { cheats, changedUnits } = makeCheats(null, {
    humanNationId: 'england',
    nations: [{ id: 'england', name: 'England' }],
    unitsByOwner: { england: [player] },
  });

  assert.equal(cheats.execute('heal all'), 'Healed 1 England unit(s) to full health');
  assert.equal(player.health, 100);
  assert.deepEqual(changedUnits, [player]);
});

test('heal all reports when every unit is already at full health', () => {
  const player = makeUnit('Player Warrior', 100);
  const { cheats, changedUnits } = makeCheats(null, {
    humanNationId: 'england',
    nations: [{ id: 'england', name: 'England' }],
    unitsByOwner: { england: [player] },
  });

  assert.equal(cheats.execute('heal all'), 'All England units are already at full health');
  assert.deepEqual(changedUnits, []);
});

test('heal all reports when the nation has no units', () => {
  const { cheats } = makeCheats(null, {
    humanNationId: 'england',
    nations: [
      { id: 'england', name: 'England' },
      { id: 'china', name: 'China' },
    ],
    unitsByOwner: {},
  });

  assert.equal(cheats.execute('heal all China'), 'China has no units');
});

test('heal all rejects unknown nations and too many arguments', () => {
  const { cheats } = makeCheats(null, {
    humanNationId: 'england',
    nations: [{ id: 'england', name: 'England' }],
  });

  assert.equal(cheats.execute('heal all Atlantis'), 'Unknown nation: atlantis');
  assert.equal(cheats.execute('heal all China now'), 'Usage: heal all [nation]');
});

test('heal completes the all keyword and then nation names', () => {
  const { cheats } = makeCheats(null, {
    humanNationId: 'england',
    nations: [
      { id: 'england', name: 'England' },
      { id: 'china', name: 'China' },
    ],
  });

  assert.ok(cheats.getCompletions('heal ').some((suggestion) => suggestion.value === 'all'));
  assert.ok(cheats.getCompletions('heal all ').some((suggestion) => suggestion.value === 'china'));
});
