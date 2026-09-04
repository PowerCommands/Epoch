import assert from 'node:assert/strict';
import test from 'node:test';
import { AGENT, PARTISANS, REBELS, SPY, WARRIOR } from '../src/data/units';
import { Unit } from '../src/entities/Unit';
import type { UnitType } from '../src/entities/UnitType';
import { CheatSystem, type GameContext } from '../src/systems/CheatSystem';
import { canRenderUnitToHuman, passesHumanCovertDetection } from '../src/systems/HumanUnitVisibility';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem';

const HUMAN = 'human';
const AI = 'ai';
const grid = new HexGridSystem();

function unit(id: string, ownerId: string, unitType: UnitType, x: number, y: number): Unit {
  return new Unit({ id, name: unitType.name, ownerId, unitType, tileX: x, tileY: y });
}

test('covert visibility data uses the existing four-unit 3/5/7/9 progression', () => {
  assert.deepEqual(
    [SPY, AGENT, REBELS, PARTISANS].map((type) => [type.covertDetectable, type.covertDetectionRange]),
    [[true, 3], [true, 5], [true, 7], [true, 9]],
  );
  assert.equal(WARRIOR.covertDetectable, undefined);
  assert.equal(WARRIOR.covertDetectionRange, undefined);
});

test('an AI covert unit is hidden without a human detector and visible at each detector range', () => {
  const target = unit('target', AI, SPY, 0, 0);
  assert.equal(passesHumanCovertDetection(target, HUMAN, [], grid), false);

  for (const detectorType of [SPY, AGENT, REBELS, PARTISANS]) {
    const range = detectorType.covertDetectionRange!;
    const detector = unit(`detector-${detectorType.id}`, HUMAN, detectorType, range, 0);
    assert.equal(passesHumanCovertDetection(target, HUMAN, [detector], grid), true, detectorType.name);
    detector.tileX += 1;
    assert.equal(passesHumanCovertDetection(target, HUMAN, [detector], grid), false, detectorType.name);
  }
});

test('every configured detector detects every configured hidden unit', () => {
  const hiddenTypes = [SPY, AGENT, REBELS, PARTISANS];
  for (const detectorType of hiddenTypes) {
    const detector = unit(`human-${detectorType.id}`, HUMAN, detectorType, 0, 0);
    for (const hiddenType of hiddenTypes) {
      const target = unit(`ai-${hiddenType.id}`, AI, hiddenType, detectorType.covertDetectionRange!, 0);
      assert.equal(
        passesHumanCovertDetection(target, HUMAN, [detector], grid),
        true,
        `${detectorType.name} should detect ${hiddenType.name}`,
      );
    }
  }
});

test('ordinary enemies and all human-owned units bypass only the covert filter', () => {
  assert.equal(passesHumanCovertDetection(unit('enemy', AI, WARRIOR, 20, 20), HUMAN, [], grid), true);
  assert.equal(passesHumanCovertDetection(unit('own-spy', HUMAN, SPY, 20, 20), HUMAN, [], grid), true);
});

test('detection is property-driven for future unit types', () => {
  const detectableType: UnitType = { ...WARRIOR, id: 'future-hidden', covertDetectable: true };
  const detectorType: UnitType = { ...WARRIOR, id: 'future-detector', covertDetectionRange: 2 };
  const hidden = unit('future-hidden', AI, detectableType, 0, 0);
  const detector = unit('future-detector', HUMAN, detectorType, 1, 1);

  assert.equal(passesHumanCovertDetection(hidden, HUMAN, [detector], grid), true);
});

test('map visibility remains a separate mandatory filter, including full-map reveal', () => {
  const hidden = unit('hidden', AI, SPY, 0, 0);
  const detector = unit('detector', HUMAN, SPY, 3, 0);
  const render = (mapVisible: boolean, humanUnits: readonly Unit[]) =>
    mapVisible && passesHumanCovertDetection(hidden, HUMAN, humanUnits, grid);

  assert.equal(render(false, [detector]), false, 'detection must not reveal a fogged tile');
  assert.equal(render(true, []), false, 'full-map visibility must not bypass covert detection');
  assert.equal(render(true, [detector]), true, 'both filters together reveal the unit');
});

test('map reveal explicitly shows covert units through fog without revealing ordinary units', () => {
  const hidden = unit('hidden', AI, SPY, 20, 20);
  const ordinary = unit('ordinary', AI, WARRIOR, 20, 20);

  assert.equal(canRenderUnitToHuman(hidden, false, HUMAN, [], grid, true), true);
  assert.equal(canRenderUnitToHuman(ordinary, false, HUMAN, [], grid, true), false);
  assert.equal(canRenderUnitToHuman(hidden, false, HUMAN, [], grid, false), false);
});

test('map reveal activates the combined temporary map override', () => {
  let reveals = 0;
  const cheats = new CheatSystem({
    revealMapTemporarily: () => { reveals += 1; },
  } as unknown as GameContext);

  assert.equal(
    cheats.execute('map reveal'),
    'Map resources and covert units revealed until the next turn transition.',
  );
  assert.equal(reveals, 1);
});
