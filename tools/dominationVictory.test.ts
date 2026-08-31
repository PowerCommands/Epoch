import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import { getDominationProgress } from '../src/systems/DominationRanking.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import { VictorySystem } from '../src/systems/VictorySystem.ts';
import {
  MilitaryVassalizationSystem,
  type InheritedVassalDecisionRequest,
} from '../src/systems/diplomacy/MilitaryVassalizationSystem.ts';

const FRANCE = 'france';
const MONGOLIA = 'mongolia';
const ENGLAND = 'england';
const CHINA = 'china';

function addNation(manager: NationManager, id: string, human = false): void {
  manager.addNation(new Nation({ id, name: id[0]!.toUpperCase() + id.slice(1), color: 0x888888, isHuman: human }));
}

function harness(ids = [FRANCE, MONGOLIA, ENGLAND]) {
  const nationManager = new NationManager();
  for (const id of ids) addNation(nationManager, id, id === ENGLAND);
  const cityManager = new CityManager();
  ids.forEach((id, index) => cityManager.addCity(new City({
    id: `${id}-capital`,
    name: `${id} capital`,
    ownerId: id,
    originNationId: id,
    tileX: index,
    tileY: 0,
    isCapital: true,
    isOriginalCapital: true,
    isResidenceCapital: true,
  })));
  const diplomacy = new DiplomacyManager();
  const turnManager = new TurnManager(nationManager);
  const logs: string[] = [];
  const victory = new VictorySystem(
    cityManager,
    nationManager,
    turnManager,
    undefined,
    {
      domination: { enabled: true },
      science: { enabled: false },
      cultural: { enabled: false },
      diplomatic: { enabled: false },
    },
    (_nationId, message) => logs.push(message),
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    diplomacy,
  );
  return { nationManager, cityManager, diplomacy, turnManager, logs, victory };
}

test('Domination derives from current direct vassals, not ownership of original capitals', () => {
  const h = harness();
  for (const city of h.cityManager.getAllCities()) city.ownerId = FRANCE;
  assert.equal(h.victory.checkVictory(), null, 'owning every original capital no longer wins');

  h.diplomacy.establishVassal(MONGOLIA, FRANCE);
  h.diplomacy.establishVassal(ENGLAND, FRANCE);
  for (const city of h.cityManager.getAllCities()) city.ownerId = city.originNationId;
  assert.equal(h.victory.checkVictory(), FRANCE, 'returned capitals do not block victory');
  assert.deepEqual(h.victory.getDominationVictoryProgress(FRANCE), {
    nationId: FRANCE,
    directVassalCount: 2,
    otherLivingNationCount: 2,
    fulfilled: true,
  });
});

test('an independent living nation or a vassal belonging to a rival host prevents victory', () => {
  const h = harness([FRANCE, MONGOLIA, ENGLAND, CHINA]);
  h.diplomacy.establishVassal(MONGOLIA, FRANCE);
  h.diplomacy.establishVassal(ENGLAND, FRANCE);
  assert.equal(h.victory.checkVictory(), null);
  assert.equal(h.victory.getDominationVictoryProgress(FRANCE).directVassalCount, 2);

  h.diplomacy.terminateVassalage(FRANCE, ENGLAND);
  h.diplomacy.establishVassal(ENGLAND, CHINA);
  assert.equal(h.victory.checkVictory(), null);
  assert.equal(h.victory.getDominationVictoryProgress(CHINA).directVassalCount, 1);
});

test('release and independence immediately reduce progress without stale conquest state', () => {
  const h = harness();
  h.diplomacy.establishVassal(MONGOLIA, FRANCE);
  h.diplomacy.establishVassal(ENGLAND, FRANCE);
  assert.equal(h.victory.getDominationVictoryProgress(FRANCE).fulfilled, true);
  h.diplomacy.terminateVassalage(FRANCE, ENGLAND);
  assert.deepEqual(h.victory.getDominationVictoryProgress(FRANCE), {
    nationId: FRANCE,
    directVassalCount: 1,
    otherLivingNationCount: 2,
    fulfilled: false,
  });
});

test('eliminated nations leave the authoritative living-nation denominator', () => {
  const h = harness();
  h.diplomacy.establishVassal(MONGOLIA, FRANCE);
  assert.equal(h.victory.getDominationVictoryProgress(FRANCE).fulfilled, false);
  h.nationManager.removeNation(ENGLAND);
  assert.deepEqual(h.victory.getDominationVictoryProgress(FRANCE), {
    nationId: FRANCE,
    directVassalCount: 1,
    otherLivingNationCount: 1,
    fulfilled: true,
  });
});

test('save-restored current relationships reproduce identical Domination progress', () => {
  const h = harness();
  h.diplomacy.establishVassal(MONGOLIA, FRANCE);
  const before = h.victory.getDominationVictoryProgress(FRANCE);
  const saved = JSON.parse(JSON.stringify(h.diplomacy.getAllVassalRelationships()));
  const restored = new DiplomacyManager();
  restored.restoreVassalRelationships(saved);
  assert.deepEqual(
    getDominationProgress(h.nationManager.getAllNations(), FRANCE, (id) => restored.getVassalHost(id)),
    before,
  );
});

test('periodic canonical diagnostics rank every candidate by current vassal progress', () => {
  const h = harness();
  h.diplomacy.establishVassal(MONGOLIA, FRANCE);
  h.turnManager.endCurrentTurn();
  h.turnManager.endCurrentTurn();
  h.turnManager.endCurrentTurn();
  const diagnostic = h.logs.find((line) => line.includes('Domination Victory Ranking')) ?? '';
  assert.match(diagnostic, /France: vassals=1\/2 fulfilled=false/);
  assert.match(diagnostic, /Mongolia: vassals=0\/2 fulfilled=false/);
  assert.match(diagnostic, /England: vassals=0\/2 fulfilled=false/);
});

test('immediate victory waits until a human inherited-vassal decision is resolved', () => {
  const h = harness();
  h.diplomacy.establishVassal(ENGLAND, MONGOLIA);
  const decisions: Array<{
    request: InheritedVassalDecisionRequest;
    resolve: (decision: 'keep' | 'liberate') => void;
  }> = [];
  const militaryDefeat = new MilitaryVassalizationSystem(h.diplomacy, {
    isHumanNation: (id) => id === FRANCE,
    endWar: () => {},
    requestHumanDecision: (request, resolve) => decisions.push({ request, resolve }),
  });
  militaryDefeat.onCompleted(() => h.victory.resolveDominationVictoryNow());

  militaryDefeat.vassalize({ victorNationId: FRANCE, defeatedNationId: MONGOLIA, reason: 'capitulation' });
  assert.equal(h.diplomacy.getVassalHost(MONGOLIA), FRANCE);
  assert.equal(h.victory.getVictoryState(), null, 'the incomplete succession must not trigger victory');
  assert.equal(decisions.length, 1);

  decisions[0]!.resolve('keep');
  assert.deepEqual(h.victory.getVictoryState(), { nationId: FRANCE, type: 'domination', round: 1 });
  assert.match(h.logs.join('\n'), /Domination Victory through vassal control/);
  assert.match(h.logs.join('\n'), /All other living nations are France's vassal states/);
});

test('an AI wins when capital capture makes the human the final vassal, while the human nation remains alive', () => {
  const h = harness([MONGOLIA, ENGLAND]);
  const militaryDefeat = new MilitaryVassalizationSystem(h.diplomacy, {
    isHumanNation: (id) => id === ENGLAND,
    endWar: () => {},
  });
  militaryDefeat.onCompleted(() => h.victory.resolveDominationVictoryNow());

  militaryDefeat.vassalize({
    victorNationId: MONGOLIA,
    defeatedNationId: ENGLAND,
    reason: 'capitalCapture',
  });

  assert.equal(h.nationManager.getNation(ENGLAND)?.isHuman, true);
  assert.equal(h.diplomacy.getVassalHost(ENGLAND), MONGOLIA);
  assert.deepEqual(h.victory.getVictoryState(), { nationId: MONGOLIA, type: 'domination', round: 1 });
});

test('liberating an inherited vassal completes succession without granting Domination Victory', () => {
  const h = harness();
  h.diplomacy.establishVassal(ENGLAND, MONGOLIA);
  let resolveDecision: ((decision: 'keep' | 'liberate') => void) | undefined;
  const militaryDefeat = new MilitaryVassalizationSystem(h.diplomacy, {
    isHumanNation: (id) => id === FRANCE,
    endWar: () => {},
    requestHumanDecision: (_request, resolve) => { resolveDecision = resolve; },
  });
  militaryDefeat.onCompleted(() => h.victory.resolveDominationVictoryNow());
  militaryDefeat.vassalize({ victorNationId: FRANCE, defeatedNationId: MONGOLIA, reason: 'capitalCapture' });
  resolveDecision?.('liberate');
  assert.equal(h.victory.getVictoryState(), null);
  assert.equal(h.victory.getDominationVictoryProgress(FRANCE).directVassalCount, 1);
});

test('Victory UI and help text describe the vassal-based requirement', () => {
  const sidebar = readFileSync('src/ui/phaser/RightSidebarPanelDataProvider.ts', 'utf8');
  const tutorial = readFileSync('src/data/tutorialContent.ts', 'utf8');
  const menu = readFileSync('src/scenes/MainMenuScene.ts', 'utf8');
  assert.match(sidebar, /every other surviving nation your direct vassal state/);
  assert.match(sidebar, /Vassal States:/);
  assert.match(tutorial, /every other surviving nation your direct vassal state/);
  assert.match(menu, /Make every surviving rival your vassal/);
});
