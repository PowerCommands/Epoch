import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import cityNames from '../src/data/cityNames.json';
import { resolveLeaderEraStrategy } from '../src/data/aiLeaderEraStrategies';
import { getAINationalAgendaById } from '../src/data/aiNationalAgendas';
import {
  ADOLF_HITLER,
  BENITO_MUSSOLINI,
  WLADYSLAW_SIKORSKI,
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
import { describeGossipAgenda } from '../src/systems/gossip/GossipInformationResolver';
import type { AIDiplomacyDecisionReason } from '../src/types/aiDiplomacy';
import { SAVED_GAME_VERSION } from '../src/types/saveGame';
import type { ScenarioData } from '../src/types/scenario';
import type { WarDeclarationReason } from '../src/types/warDeclaration';
import { getLeaderRoomImagePath } from '../src/utils/assetPaths';

const POLAND_ID = 'nation_poland';
const SIKORSKI_ID = 'leader_wladyslaw_sikorski';
const HUMAN_ID = 'nation_sweden';
const REASONS = ['conquest', 'hostility', 'threat', 'ideological', 'ambition'] as const;

test('Poland is a canonical playable nation with Polish currency and white-red presentation', () => {
  assert.deepEqual(getNationDefinitionById(POLAND_ID), {
    id: POLAND_ID,
    name: 'Poland',
    color: '#d4213d',
    secondaryColor: '#f5f5f5',
    currencyName: 'Polish Złoty',
    currencySymbol: 'zł',
  });
});

test('Władysław Sikorski is Poland’s default leader with conventional media paths', () => {
  assert.equal(WLADYSLAW_SIKORSKI.id, SIKORSKI_ID);
  assert.equal(WLADYSLAW_SIKORSKI.name, 'Władysław Sikorski');
  assert.equal(WLADYSLAW_SIKORSKI.nationId, POLAND_ID);
  assert.equal(WLADYSLAW_SIKORSKI.title, 'General');
  assert.equal(WLADYSLAW_SIKORSKI.isDefault, true);
  assert.deepEqual(getLeadersByNationId(POLAND_ID).map((leader) => leader.id), [SIKORSKI_ID]);
  assert.equal(getDefaultLeaderByNationId(POLAND_ID)?.id, SIKORSKI_ID);
  assert.equal(getLeaderByNationId(POLAND_ID)?.id, SIKORSKI_ID);
  assert.equal(WLADYSLAW_SIKORSKI.image, '/assets/sprites/leaders/wladyslaw-sikorski.png');
  assert.equal(getLeaderRoomImagePath(WLADYSLAW_SIKORSKI.image), '/assets/sprites/leaders/wladyslaw-sikorski-room.webp');
  assert.equal(fs.existsSync('public/assets/sprites/leaders/wladyslaw-sikorski.png'), true);
  assert.equal(fs.existsSync('public/assets/sprites/leaders/wladyslaw-sikorski-room.webp'), true);
});

test('Sikorski favors preparedness, cooperation, and defense rather than conquest', () => {
  const sikorski = WLADYSLAW_SIKORSKI.aiPersonality!;
  assert.ok(sikorski.aggressionBias < BENITO_MUSSOLINI.aiPersonality!.aggressionBias);
  assert.ok(sikorski.aggressionBias < ADOLF_HITLER.aiPersonality!.aggressionBias);
  assert.ok(sikorski.expansionBias < 0);
  assert.ok(sikorski.diplomacyBias > BENITO_MUSSOLINI.aiPersonality!.diplomacyBias);
  assert.ok(sikorski.diplomacyBias > ADOLF_HITLER.aiPersonality!.diplomacyBias);
  assert.ok(sikorski.warTolerance >= 60);
  assert.equal(getLeaderCovertPersonalityId(SIKORSKI_ID), 'honorable');

  const agenda = getAINationalAgendaById('poland_shall_endure');
  assert.equal(agenda.name, 'Poland Shall Endure');
  assert.match(agenda.description, /sovereignty/i);
  assert.match(agenda.description, /dependable alliances/i);
  assert.match(describeGossipAgenda(undefined, agenda.id), /defend our sovereignty/i);

  const doctrine = getLeaderMilitaryDoctrineById(SIKORSKI_ID);
  assert.equal(doctrine.id, 'disciplinedInfantry');
  assert.equal(doctrine.militaryBudget.allowOverbuildingWhenThreatened, true);
  assert.ok(doctrine.militaryBudget.strengthMultiplier > 1);
  assert.equal(resolveLeaderEraStrategy(SIKORSKI_ID, 'modern').id, 'defensiveBuilder');
});

test('Poland is exported to editor manifests with city names and its two-track playlist', () => {
  const manifest = JSON.parse(fs.readFileSync('public/assets/data/nations-manifest.json', 'utf8')) as {
    nations: Array<Record<string, unknown> & { nationId: string; leaders: Array<Record<string, unknown>> }>;
  };
  const poland = manifest.nations.find((nation) => nation.nationId === POLAND_ID)!;
  assert.equal(poland.nationName, 'Poland');
  assert.equal(poland.color, '#d4213d');
  assert.equal(poland.secondaryColor, '#f5f5f5');
  assert.equal(poland.currencyName, 'Polish Złoty');
  assert.equal(poland.currencySymbol, 'zł');
  assert.equal(poland.leaderId, SIKORSKI_ID);
  assert.deepEqual(poland.leaders, [{
    leaderId: SIKORSKI_ID,
    leaderName: 'Władysław Sikorski',
    leaderTitle: 'General',
    leaderImage: '/assets/sprites/leaders/wladyslaw-sikorski.png',
    isDefault: true,
  }]);

  const names = cityNames[POLAND_ID as keyof typeof cityNames];
  assert.equal(names[0], 'Warsaw');
  assert.ok(names.includes('Kraków'));
  assert.ok(names.includes('Gdańsk'));
  const cityManifest = JSON.parse(fs.readFileSync('public/assets/data/city-names-manifest.json', 'utf8')) as {
    cityNames: Record<string, string[]>;
  };
  assert.deepEqual(cityManifest.cityNames[POLAND_ID], names);
  assert.match(fs.readFileSync('public/editor.html', 'utf8'), /nations-manifest\.json/);

  const sounds = JSON.parse(fs.readFileSync('public/assets/sounds/manifest.json', 'utf8')) as {
    playlists: Record<string, string[]>;
  };
  assert.deepEqual(sounds.playlists[POLAND_ID], [
    '/assets/sounds/nation_poland/nation_poland-theme-01.mp3',
    '/assets/sounds/nation_poland/nation_poland-theme-02.mp3',
  ]);
});

test('Poland and Sikorski survive normal scenario and save roundtrips', () => {
  const scenario: ScenarioData = {
    meta: { name: 'Poland roundtrip', version: 1 },
    map: { width: 1, height: 1, tileSize: 64, tiles: [{ q: 0, r: 0, type: 'plains' }] },
    nations: [{
      id: POLAND_ID,
      name: 'Poland',
      color: '#d4213d',
      secondaryColor: '#f5f5f5',
      isHuman: true,
      startTerritoryCenter: { q: 0, r: 0 },
      leaderId: SIKORSKI_ID,
    }],
    cities: [{ id: 'city_warsaw', name: 'Warsaw', nationId: POLAND_ID, q: 0, r: 0, isCapital: true }],
    units: [{ nationId: POLAND_ID, unitTypeId: 'warrior', q: 0, r: 0 }],
  };
  const parsed = ScenarioLoader.parse(JSON.parse(JSON.stringify(scenario)) as ScenarioData);
  assert.equal(parsed.nations[0].id, POLAND_ID);
  assert.equal(parsed.nations[0].leaderId, SIKORSKI_ID);
  assert.equal(parsed.cities[0].nationId, POLAND_ID);
  assert.equal(parsed.units[0].nationId, POLAND_ID);

  const validated = SaveLoadService.validate({
    version: SAVED_GAME_VERSION,
    savedAt: new Date(0).toISOString(),
    mapKey: 'test',
    humanNationId: POLAND_ID,
    activeNationIds: [POLAND_ID],
    leaderSelections: { [POLAND_ID]: SIKORSKI_ID },
    turn: { currentRound: 1, currentTurnIndex: 0 },
    tiles: [], nations: [], cities: [], units: [], diplomacy: [], discovery: [], wonders: [],
  });
  assert.equal(validated.ok, true);
  if (validated.ok) assert.equal(validated.state.leaderSelections?.[POLAND_ID], SIKORSKI_ID);
});

function declarationDecision(reason: WarDeclarationReason): AIDiplomacyDecisionReason {
  return {
    action: 'declareWar',
    actorNationId: POLAND_ID,
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

test('every war reason has Sikorski-specific variants and reaches the normal Audience request', () => {
  const phrases = getLeaderWarDeclarationPhrases(SIKORSKI_ID);
  const forbiddenHistory = /Germany|Hitler|Soviet Union|Stalin|Britain|France|partition|World War|WWII/i;
  for (const reason of REASONS) {
    assert.equal(phrases[reason].length, 2, reason);
    assert.equal(new Set(phrases[reason]).size, 2, reason);
    assert.ok(phrases[reason].every((phrase) => phrase.length > 40), reason);
    assert.ok(phrases[reason].every((phrase) => !forbiddenHistory.test(phrase)), reason);

    const request = createAIWarDeclarationDialogueRequest(declarationDecision(reason), HUMAN_ID, 17);
    assert.equal(request?.leaderId, SIKORSKI_ID);
    assert.equal(request?.actorNationId, POLAND_ID);
    assert.equal(request?.targetNationId, HUMAN_ID);
    assert.equal(request?.reason, reason);
    assert.ok(phrases[reason].includes(request!.phrase));
  }
});

test('Sikorski has complete diplomacy, culture, and Games of Nations content', () => {
  assert.deepEqual(Object.keys(WLADYSLAW_SIKORSKI.diplomacyFlavor!).sort(), [
    'defeat', 'friendly', 'greeting', 'hostile', 'neutral', 'victory', 'warDeclaration',
  ]);
  assert.ok(WLADYSLAW_SIKORSKI.culturePriorities!.includes('defensive_tactics'));
  assert.ok(WLADYSLAW_SIKORSKI.culturePriorities!.includes('diplomatic_service'));
  assert.deepEqual(WLADYSLAW_SIKORSKI.gamesOfNationsPreferences, {
    traditionalFavourite: 'javelin',
    additionalFavourite: 'fencing',
  });
});
