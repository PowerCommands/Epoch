import assert from 'node:assert/strict';
import test from 'node:test';
import { Nation } from '../src/entities/Nation.ts';
import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import {
  LUCKY_LOSER_GOLD_REWARD,
  LUCKY_LOSER_RETRY_TURNS,
  LUCKY_LOSER_TRIGGER_YEAR,
  LuckyLoserTurningPointSystem,
  type LuckyLoserAwardEvent,
  type SavedLuckyLoserTurningPointState,
} from '../src/systems/diplomacy/LuckyLoserTurningPointSystem.ts';

const HOST = 'host';
const VASSALS = ['england', 'france', 'mongolia'] as const;

function makeHarness(options: {
  year?: number;
  turn?: number;
  seed?: string;
  humanIds?: readonly string[];
  triggerYear?: number | null;
} = {}) {
  const nationManager = new NationManager();
  for (const id of [HOST, ...VASSALS]) {
    nationManager.addNation(new Nation({
      id,
      name: id[0]!.toUpperCase() + id.slice(1),
      color: 0xffffff,
      isHuman: options.humanIds?.includes(id) ?? false,
    }));
  }
  const diplomacy = new DiplomacyManager();
  const logs: string[] = [];
  const history: LuckyLoserAwardEvent[] = [];
  const notifications: LuckyLoserAwardEvent[] = [];
  let year = options.year ?? LUCKY_LOSER_TRIGGER_YEAR;
  let turn = options.turn ?? 100;
  const system = new LuckyLoserTurningPointSystem({
    nationManager,
    diplomacyManager: diplomacy,
    getGlobalYear: () => year,
    triggerYear: options.triggerYear,
    getCurrentTurn: () => turn,
    randomSeed: options.seed ?? 'lucky-loser-test',
    getGold: (nationId) => nationManager.getResources(nationId).gold,
    addGold: (nationId, amount) => {
      const nation = nationManager.getNation(nationId);
      if (!nation) return null;
      const resources = nationManager.getResources(nationId);
      resources.gold += amount;
      return resources.gold;
    },
    getNationName: (nationId) => nationManager.getNation(nationId)?.name ?? nationId,
    log: (message) => logs.push(message),
    recordHistory: (event) => history.push(event),
    notifyHuman: (event) => notifications.push(event),
  });
  return {
    nationManager,
    diplomacy,
    system,
    logs,
    history,
    notifications,
    setYear: (value: number) => { year = value; },
    setTurn: (value: number) => { turn = value; },
    makeVassal: (id: string) => diplomacy.establishVassal(id, HOST),
  };
}

test('Lucky Loser cannot activate before calendar year 1500', () => {
  const h = makeHarness({ year: LUCKY_LOSER_TRIGGER_YEAR - 1 });
  h.makeVassal('england');
  h.system.handleTurnStart();
  assert.deepEqual(h.system.serialize(), {
    activationReached: false,
    occurred: false,
    nextRetryTurn: null,
  });
  assert.equal(h.nationManager.getResources('england').gold, 0);
  assert.deepEqual(h.logs, []);
});

test('scenario trigger year replaces the legacy gate and null disables Lucky Loser', () => {
  const configured = makeHarness({ year: 1999, triggerYear: 2000 });
  configured.makeVassal('england');
  configured.system.handleTurnStart();
  assert.equal(configured.system.serialize().occurred, false);
  configured.setYear(2000);
  configured.system.handleTurnStart();
  assert.equal(configured.system.serialize().occurred, true);

  const disabled = makeHarness({ year: 3000, triggerYear: null });
  disabled.makeVassal('england');
  disabled.system.handleTurnStart();
  assert.equal(disabled.system.serialize().occurred, false);
});

test('the only living vassal receives exactly +100,000 Gold and remains a vassal', () => {
  const h = makeHarness();
  h.makeVassal('england');
  h.nationManager.getResources('england').gold = 37_500;
  h.system.handleTurnStart();

  assert.equal(h.nationManager.getResources('england').gold, 137_500);
  assert.equal(h.diplomacy.getVassalHost('england'), HOST);
  assert.equal(h.history[0]?.goldAwarded, LUCKY_LOSER_GOLD_REWARD);
  assert.match(h.logs[0] ?? '', /England is the only eligible vassal state and receives 100,000 Gold/);
  assert.deepEqual(h.system.serialize(), {
    activationReached: true,
    occurred: true,
    nextRetryTurn: null,
    winnerNationId: 'england',
  });
});

test('human vassals are eligible on identical terms and receive a clear notification', () => {
  const h = makeHarness({ humanIds: ['france'] });
  h.makeVassal('france');
  h.system.handleTurnStart();
  assert.equal(h.notifications.length, 1);
  assert.equal(h.notifications[0]?.winnerNationId, 'france');
  assert.equal(h.notifications[0]?.goldAwarded, 100_000);
});

test('the windfall never auto-purchases independence even above the normal price', () => {
  const h = makeHarness();
  h.makeVassal('england');
  h.nationManager.getResources('england').gold = 150_000;
  h.system.handleTurnStart();
  assert.equal(h.nationManager.getResources('england').gold, 250_000);
  assert.equal(h.diplomacy.getVassalHost('england'), HOST);
});

test('multiple vassals use stable seeded random selection from the complete candidate set', () => {
  const first = makeHarness({ seed: 'stable-seed', humanIds: ['france'] });
  const second = makeHarness({ seed: 'stable-seed', humanIds: ['france'] });
  for (const id of VASSALS) {
    first.makeVassal(id);
    second.makeVassal(id);
  }
  first.system.handleTurnStart();
  second.system.handleTurnStart();
  assert.equal(first.history[0]?.winnerNationId, second.history[0]?.winnerNationId);
  assert.equal(first.history[0]?.eligibleVassalCount, 3);
  assert.ok(VASSALS.includes(first.history[0]!.winnerNationId as typeof VASSALS[number]));
  assert.match(first.logs[0] ?? '', /selected from 3 eligible vassal states/);

  // Across deterministic seeds every candidate, including the Human, is
  // selectable; no human/AI or progress-based filter exists.
  const selected = new Set<string>();
  for (let index = 0; index < 100; index += 1) {
    const h = makeHarness({ seed: `candidate-seed-${index}`, humanIds: ['france'] });
    for (const id of VASSALS) h.makeVassal(id);
    h.system.handleTurnStart();
    selected.add(h.history[0]!.winnerNationId);
  }
  assert.deepEqual([...selected].sort(), [...VASSALS].sort());
});

test('no vassal schedules an exact 100-turn retry and does not inspect candidates early', () => {
  const h = makeHarness({ turn: 250 });
  h.system.handleTurnStart();
  assert.deepEqual(h.system.serialize(), {
    activationReached: true,
    occurred: false,
    nextRetryTurn: 250 + LUCKY_LOSER_RETRY_TURNS,
  });
  assert.match(h.logs[0] ?? '', /No eligible vassal state found\. Retrying in 100 turns/);

  h.makeVassal('england');
  h.setTurn(349);
  h.system.handleTurnStart();
  assert.equal(h.history.length, 0);
  assert.equal(h.logs.length, 1, 'there is no per-turn retry logging');
  h.setTurn(350);
  h.system.handleTurnStart();
  assert.equal(h.history[0]?.winnerNationId, 'england');
});

test('eligibility is recomputed at each retry and failed checks continue every 100 turns', () => {
  const h = makeHarness({ turn: 300 });
  h.system.handleTurnStart();
  h.makeVassal('england');
  h.diplomacy.terminateVassalage(HOST, 'england');
  h.setTurn(400);
  h.system.handleTurnStart();
  assert.equal(h.history.length, 0);
  assert.equal(h.system.serialize().nextRetryTurn, 500);

  h.makeVassal('france');
  h.setTurn(499);
  h.system.handleTurnStart();
  assert.equal(h.history.length, 0);
  h.setTurn(500);
  h.system.handleTurnStart();
  assert.equal(h.history[0]?.winnerNationId, 'france');
});

test('an eliminated former vassal is absent from the living candidate pool', () => {
  const h = makeHarness();
  h.makeVassal('england');
  h.nationManager.removeNation('england');
  h.system.handleTurnStart();
  assert.equal(h.history.length, 0);
  assert.equal(h.system.serialize().nextRetryTurn, 200);
});

test('the event fires only once and never awards or notifies a second nation', () => {
  const h = makeHarness({ humanIds: ['england', 'france'] });
  h.makeVassal('england');
  h.system.handleTurnStart();
  h.makeVassal('france');
  h.setTurn(1000);
  h.system.handleTurnStart();
  assert.equal(h.history.length, 1);
  assert.equal(h.logs.length, 1);
  assert.equal(h.nationManager.getResources('france').gold, 0);
});

test('save/load before activation preserves the year gate', () => {
  const original = makeHarness({ year: 1499 });
  original.makeVassal('england');
  original.system.handleTurnStart();
  const saved = JSON.parse(JSON.stringify(original.system.serialize())) as SavedLuckyLoserTurningPointState;

  const restored = makeHarness({ year: 1499 });
  restored.makeVassal('england');
  restored.system.restore(saved);
  restored.system.handleTurnStart();
  assert.equal(restored.history.length, 0);
  restored.setYear(1500);
  restored.setTurn(101);
  restored.system.handleTurnStart();
  assert.equal(restored.history.length, 1);
});

test('save/load preserves the absolute retry turn without resetting the interval', () => {
  const original = makeHarness({ turn: 300 });
  original.system.handleTurnStart();
  const saved = JSON.parse(JSON.stringify(original.system.serialize())) as SavedLuckyLoserTurningPointState;

  const restored = makeHarness({ turn: 350 });
  restored.makeVassal('england');
  restored.system.restore(saved);
  restored.system.handleTurnStart();
  assert.equal(restored.history.length, 0);
  restored.setTurn(399);
  restored.system.handleTurnStart();
  assert.equal(restored.history.length, 0);
  restored.setTurn(400);
  restored.system.handleTurnStart();
  assert.equal(restored.history[0]?.winnerNationId, 'england');
});

test('save/load after completion cannot duplicate the reward', () => {
  const original = makeHarness();
  original.makeVassal('england');
  original.system.handleTurnStart();
  const saved = JSON.parse(JSON.stringify(original.system.serialize())) as SavedLuckyLoserTurningPointState;

  const restored = makeHarness({ turn: 500 });
  restored.makeVassal('england');
  restored.nationManager.getResources('england').gold = 100_000;
  restored.system.restore(saved);
  restored.system.handleTurnStart();
  assert.equal(restored.nationManager.getResources('england').gold, 100_000);
  assert.equal(restored.history.length, 0);
  assert.equal(restored.system.serialize().winnerNationId, 'england');
});
