import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import cityNames from '../src/data/cityNames.json';
import { resolveLeaderEraStrategy } from '../src/data/aiLeaderEraStrategies';
import { getAINationalAgendaById } from '../src/data/aiNationalAgendas';
import {
  ADOLF_HITLER,
  BENITO_MUSSOLINI,
  getDefaultLeaderByNationId,
  getLeaderByNationId,
  getLeaderCovertPersonalityId,
  getLeaderMilitaryDoctrineById,
  getLeadersByNationId,
} from '../src/data/leaders';
import { getLeaderWarDeclarationPhrases } from '../src/data/leaderWarDeclarations';
import { getNationDefinitionById } from '../src/data/nations';
import { SaveLoadService } from '../src/systems/SaveLoadService';
import { ScenarioLoader } from '../src/systems/ScenarioLoader';
import { createAIWarDeclarationDialogueRequest } from '../src/systems/ai/AIWarDeclarationDialogue';
import { AIStrategySelector } from '../src/systems/ai/AIStrategySelector';
import type { AIDiplomacyDecisionReason } from '../src/types/aiDiplomacy';
import { SAVED_GAME_VERSION } from '../src/types/saveGame';
import type { ScenarioData } from '../src/types/scenario';
import type { WarDeclarationReason } from '../src/types/warDeclaration';
import { getLeaderRoomImagePath } from '../src/utils/assetPaths';

const ITALY_ID = 'nation_italy';
const MUSSOLINI_ID = 'leader_benito_mussolini';
const HUMAN_ID = 'nation_sweden';
const REASONS = ['conquest', 'hostility', 'threat', 'ideological', 'ambition'] as const;

test('Italy is a canonical playable nation with its Lira and tricolour presentation palette', () => {
  assert.deepEqual(getNationDefinitionById(ITALY_ID), {
    id: ITALY_ID,
    name: 'Italy',
    color: '#0b6b3a',
    secondaryColor: '#ce2b37',
    currencyName: 'Lira',
    currencySymbol: '₤',
  });
  assert.equal(getNationDefinitionById('nation_germany')?.name, 'Germany');
  assert.equal(getNationDefinitionById('nation_france')?.name, 'France');
});

test('Benito Mussolini is Italy’s default leader and uses conventional media paths', () => {
  assert.equal(BENITO_MUSSOLINI.id, MUSSOLINI_ID);
  assert.equal(BENITO_MUSSOLINI.nationId, ITALY_ID);
  assert.equal(BENITO_MUSSOLINI.title, 'Il Duce');
  assert.equal(BENITO_MUSSOLINI.isDefault, true);
  assert.deepEqual(getLeadersByNationId(ITALY_ID).map((leader) => leader.id), [MUSSOLINI_ID]);
  assert.equal(getDefaultLeaderByNationId(ITALY_ID)?.id, MUSSOLINI_ID);
  assert.equal(getLeaderByNationId(ITALY_ID)?.id, MUSSOLINI_ID);
  assert.equal(BENITO_MUSSOLINI.image, '/assets/sprites/leaders/benito-mussolini.png');
  assert.equal(getLeaderRoomImagePath(BENITO_MUSSOLINI.image), '/assets/sprites/leaders/benito-mussolini-room.webp');
  assert.equal(fs.existsSync('public/assets/sprites/leaders/benito-mussolini.png'), true);
  assert.equal(fs.existsSync('public/assets/sprites/leaders/benito-mussolini-room.webp'), true);
});

test('Mussolini is a military opportunist with more restraint than Hitler', () => {
  const mussolini = BENITO_MUSSOLINI.aiPersonality!;
  const hitler = ADOLF_HITLER.aiPersonality!;
  assert.ok(mussolini.aggressionBias < hitler.aggressionBias);
  assert.ok(mussolini.expansionBias < hitler.expansionBias);
  assert.ok(mussolini.warTolerance < hitler.warTolerance);
  assert.ok(mussolini.peacePreference > hitler.peacePreference);
  assert.ok(mussolini.diplomacyBias > hitler.diplomacyBias);
  assert.equal(getLeaderCovertPersonalityId(MUSSOLINI_ID), 'opportunist');

  const doctrine = getLeaderMilitaryDoctrineById(MUSSOLINI_ID);
  assert.equal(doctrine.id, 'prestigeProjection');
  assert.ok(doctrine.militaryBudget.strengthMultiplier > 1);
  assert.ok(doctrine.militaryBudget.maxUnitsMultiplier > 1);
  assert.ok(doctrine.preferredRoles.navalMelee > 1);
  assert.ok(doctrine.preferredRoles.navalRanged > 1);

  const eraStrategy = resolveLeaderEraStrategy(MUSSOLINI_ID, 'modern');
  assert.equal(eraStrategy.id, 'militaryPreparation');
  assert.equal(eraStrategy.militaryBehavior.prepareForWar, true);
  assert.equal(eraStrategy.militaryBehavior.targetWeakNeighbor, true);
});

test('New Roman Empire favors prestige expansion but normal strategy safety still handles war and threats', () => {
  const agenda = getAINationalAgendaById('new_roman_empire');
  assert.equal(agenda.name, 'New Roman Empire');
  assert.match(agenda.description, /prestige/i);

  const selector = new AIStrategySelector();
  const context = {
    nationId: ITALY_ID,
    currentTurn: 20,
    currentStrategyId: 'balanced',
    strategyStartedTurn: 0,
    nationalAgendaId: BENITO_MUSSOLINI.aiNationalAgendaId!,
    leaderPersonality: BENITO_MUSSOLINI.aiPersonality!,
    cityCount: 4,
    unitCount: 4,
    gold: 200,
    goldPerTurn: 5,
    netHappiness: 5,
    atWar: false,
    enemyMilitaryNearby: false,
    highestThreatLevel: 'low' as const,
  };
  assert.equal(selector.selectStrategy(context), 'expansionist');
  assert.equal(selector.selectStrategy({ ...context, atWar: true }), 'aggressive');
  assert.equal(selector.selectStrategy({ ...context, highestThreatLevel: 'high' }), 'defensive');
});

test('Italy is exported to the editor manifests with its leader, city pool, and two-track music playlist', () => {
  const nationManifest = JSON.parse(fs.readFileSync('public/assets/data/nations-manifest.json', 'utf8')) as {
    nations: Array<Record<string, unknown> & { nationId: string; leaders: Array<Record<string, unknown>> }>;
  };
  const italy = nationManifest.nations.find((nation) => nation.nationId === ITALY_ID)!;
  assert.equal(italy.nationName, 'Italy');
  assert.equal(italy.color, '#0b6b3a');
  assert.equal(italy.secondaryColor, '#ce2b37');
  assert.equal(italy.leaderId, MUSSOLINI_ID);
  assert.deepEqual(italy.leaders, [{
    leaderId: MUSSOLINI_ID,
    leaderName: 'Benito Mussolini',
    leaderTitle: 'Il Duce',
    leaderImage: '/assets/sprites/leaders/benito-mussolini.png',
    isDefault: true,
  }]);

  const names = cityNames[ITALY_ID as keyof typeof cityNames];
  assert.equal(names[0], 'Rome');
  assert.ok(names.includes('Milan'));
  assert.ok(names.includes('Naples'));

  const cityManifest = JSON.parse(fs.readFileSync('public/assets/data/city-names-manifest.json', 'utf8')) as {
    cityNames: Record<string, string[]>;
  };
  assert.deepEqual(cityManifest.cityNames[ITALY_ID], names);
  assert.match(fs.readFileSync('public/editor.html', 'utf8'), /nations-manifest\.json/);

  const sounds = JSON.parse(fs.readFileSync('public/assets/sounds/manifest.json', 'utf8')) as {
    playlists: Record<string, string[]>;
  };
  assert.deepEqual(sounds.playlists[ITALY_ID], [
    '/assets/sounds/nation_italy/nation_italy-theme-01.mp3',
    '/assets/sounds/nation_italy/nation_italy-theme-02.mp3',
  ]);
});

test('Italy and Mussolini survive normal scenario and save serialization paths', () => {
  const scenario: ScenarioData = {
    meta: { name: 'Italy roundtrip', version: 1 },
    map: { width: 1, height: 1, tileSize: 64, tiles: [{ q: 0, r: 0, type: 'plains' }] },
    nations: [{
      id: ITALY_ID,
      name: 'Italy',
      color: '#0b6b3a',
      secondaryColor: '#ce2b37',
      isHuman: true,
      startTerritoryCenter: { q: 0, r: 0 },
      leaderId: MUSSOLINI_ID,
    }],
    cities: [{ id: 'city_rome', name: 'Rome', nationId: ITALY_ID, q: 0, r: 0, isCapital: true }],
    units: [],
  };
  const parsed = ScenarioLoader.parse(JSON.parse(JSON.stringify(scenario)) as ScenarioData);
  assert.equal(parsed.nations[0].id, ITALY_ID);
  assert.equal(parsed.nations[0].leaderId, MUSSOLINI_ID);
  assert.equal(parsed.cities[0].nationId, ITALY_ID);

  const validated = SaveLoadService.validate({
    version: SAVED_GAME_VERSION,
    savedAt: new Date(0).toISOString(),
    mapKey: 'test',
    humanNationId: ITALY_ID,
    activeNationIds: [ITALY_ID],
    leaderSelections: { [ITALY_ID]: MUSSOLINI_ID },
    turn: { currentRound: 1, currentTurnIndex: 0 },
    tiles: [], nations: [], cities: [], units: [], diplomacy: [], discovery: [], wonders: [],
  });
  assert.equal(validated.ok, true);
  if (validated.ok) assert.equal(validated.state.leaderSelections?.[ITALY_ID], MUSSOLINI_ID);
});

function declarationDecision(reason: WarDeclarationReason): AIDiplomacyDecisionReason {
  return {
    action: 'declareWar',
    actorNationId: ITALY_ID,
    targetNationId: HUMAN_ID,
    attitude: 'hostile',
    militaryComparison: 'stronger',
    threatLevel: 'low',
    relationState: 'PEACE',
    trust: 10,
    fear: 20,
    hostility: 80,
    affinity: -10,
    suspicion: 30,
    warDeclarationReason: reason,
    reasonText: 'test',
  };
}

test('every declaration reason has two Mussolini-specific variants and enters the audience request unchanged', () => {
  const phrases = getLeaderWarDeclarationPhrases(MUSSOLINI_ID);
  const forbiddenHistory = /Axis|Germany|Britain|France|Ethiopia|Mediterranean|WWII/i;
  for (const reason of REASONS) {
    assert.equal(phrases[reason].length, 2, reason);
    assert.equal(new Set(phrases[reason]).size, 2, reason);
    assert.ok(phrases[reason].every((phrase) => phrase.length > 40), reason);
    assert.ok(phrases[reason].every((phrase) => !forbiddenHistory.test(phrase)), reason);

    const request = createAIWarDeclarationDialogueRequest(declarationDecision(reason), HUMAN_ID, 17);
    assert.equal(request?.leaderId, MUSSOLINI_ID);
    assert.equal(request?.actorNationId, ITALY_ID);
    assert.equal(request?.targetNationId, HUMAN_ID);
    assert.equal(request?.reason, reason);
    assert.ok(phrases[reason].includes(request!.phrase));
  }
});
