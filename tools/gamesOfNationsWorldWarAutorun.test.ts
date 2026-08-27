import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Nation } from '../src/entities/Nation.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import { AllianceManager } from '../src/systems/diplomacy/AllianceManager.ts';
import { ScenarioHistoricalEventSystem } from '../src/systems/ScenarioHistoricalEventSystem.ts';
import {
  GAMES_AND_RECREATION_CULTURE_ID,
  GamesOfNationsSystem,
  type GamesOfNationsDependencies,
} from '../src/systems/GamesOfNationsSystem.ts';
import type { ScenarioHistoricalEvent, ScenarioMeta } from '../src/types/scenario.ts';

const SCENARIO = JSON.parse(
  readFileSync(new URL('../public/assets/maps/world-war-ii-europe.json', import.meta.url), 'utf8'),
) as { meta: ScenarioMeta & { startYear: number }; historicalEvents: ScenarioHistoricalEvent[] };

const NATIONS = ['nation_germany', 'nation_poland', 'nation_england', 'nation_france', 'nation_sweden', 'nation_italy'];

/**
 * End-to-end wiring that mirrors GameScene: the Historical Event system evaluates
 * completion at roundEnd and activation at beforeRoundStart, while Games of Nations
 * advances at roundStart. This exercises the real round-boundary ordering and the
 * real hasActiveWorldWar()/isActiveWarAggressor() queries rather than mocks.
 */
function scenario() {
  const nationManager = new NationManager();
  for (const [index, id] of NATIONS.entries()) {
    nationManager.addNation(new Nation({ id, name: id, color: 0x2244ff + index }));
  }
  const turnManager = new TurnManager(nationManager, undefined, SCENARIO.meta);
  const diplomacy = new DiplomacyManager(turnManager);
  const alliances = new AllianceManager();
  const historical = new ScenarioHistoricalEventSystem(
    SCENARIO.historicalEvents,
    turnManager,
    diplomacy,
    alliances,
    { getNationName: (id) => id },
  );
  const deps: GamesOfNationsDependencies = {
    getCurrentTurn: () => turnManager.getCurrentRound(),
    getLivingNationIds: () => NATIONS,
    getNationName: (id) => id,
    getCapitalCity: (id) => ({ id: `${id}-city`, name: id }),
    hasActiveWorldWar: () => historical.hasActiveWorldWar(),
    isActiveWarAggressor: (id) => diplomacy.isActiveWarAggressor(id),
  };
  const games = GamesOfNationsSystem.forNewGame(deps);
  turnManager.on('roundStart', (event) => games.handleRoundStart(event.round));
  turnManager.start();

  const advanceRounds = (rounds: number) => {
    const target = turnManager.getCurrentRound() + rounds;
    while (turnManager.getCurrentRound() < target) turnManager.endCurrentTurn();
  };
  return { turnManager, diplomacy, historical, games, advanceRounds };
}

test('WWII scenario: Games of Nations freezes while the World War is active and resumes after', () => {
  const s = scenario();

  // Found the institution well before September 1939 so a real schedule exists to freeze.
  s.games.handleCultureCompleted('nation_sweden', GAMES_AND_RECREATION_CULTURE_ID, s.turnManager.getCurrentRound());
  assert.equal(s.games.getSummary().founded, true);

  // Advance until the authored World War II event activates.
  let guard = 0;
  while (!s.historical.hasActiveWorldWar() && guard < 40) {
    s.advanceRounds(1);
    guard += 1;
  }
  assert.equal(s.historical.hasActiveWorldWar(), true, 'World War II should activate from the scenario date');

  const atWarStart = s.games.getSummary();
  assert.equal(atWarStart.suspendedForWorldWar, true);
  const frozenPhase = atWarStart.phase;
  const frozenCountdown = atWarStart.turnsUntilNextPhase;

  // Germany is the recorded aggressor of every conflict the event declared.
  assert.equal(s.diplomacy.isActiveWarAggressor('nation_germany'), true);
  assert.equal(s.diplomacy.isActiveWarAggressor('nation_poland'), false);

  // Many wartime rounds pass; the Games schedule must not advance at all.
  s.advanceRounds(20);
  const midWar = s.games.getSummary();
  assert.equal(midWar.suspendedForWorldWar, true);
  assert.equal(midWar.phase, frozenPhase, 'phase must not change during the World War');
  assert.equal(midWar.turnsUntilNextPhase, frozenCountdown, 'countdown must not advance during the World War');

  // Force peace on all of Germany's wars so the event completes at roundEnd.
  const turn = s.turnManager.getCurrentRound();
  for (const defender of ['nation_poland', 'nation_england', 'nation_france']) {
    s.diplomacy.enforceCeasefire('nation_germany', defender, 20, turn);
  }
  assert.equal(s.diplomacy.isAtWarWithAnyNation('nation_germany'), false);

  // The next round boundary evaluates completion (roundEnd) before Games advances (roundStart).
  s.advanceRounds(2);
  const resumed = s.games.getSummary();
  assert.equal(s.historical.hasActiveWorldWar(), false, 'World War II should have completed after peace');
  assert.equal(resumed.suspendedForWorldWar, false, 'Games resume once no World War remains active');
  // Germany, no longer an active-war aggressor, is eligible again.
  assert.equal(s.diplomacy.isActiveWarAggressor('nation_germany'), false);
});
