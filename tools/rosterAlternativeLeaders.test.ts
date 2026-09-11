import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { loadImage } from 'canvas';
import audit from '../docs/content/alternative-leader-roster-audit.json';
import { ROSTER_ALTERNATIVE_LEADERS } from '../src/data/rosterAlternativeLeaders';
import { ROSTER_ALTERNATIVE_WAR_DECLARATIONS } from '../src/data/rosterAlternativeWarDeclarations';
import { NATION_DEFINITIONS, getNationDefinitionById } from '../src/data/nations';
import { ALL_LEADERS, getDefaultLeaderByNationId, getLeaderByNationId, getLeaderById, getLeadersByNationId, getLeaderPersonalityByNationId, setActiveLeaderSelections, setScenarioLeaderOverrides } from '../src/data/leaders';
import { getIdeologyById } from '../src/data/ideologies';
import { getAINationalAgendaById } from '../src/data/aiNationalAgendas';
import { getAIMilitaryDoctrineById } from '../src/data/aiMilitaryDoctrines';
import { getCovertPersonalityById } from '../src/data/covertPersonalities';
import { getLeaderEraStrategyProfile, getAILeaderEraStrategyById, resolveLeaderEraStrategy } from '../src/data/aiLeaderEraStrategies';
import { ERA_TIMELINE } from '../src/data/eraTimeline';
import { getGamesSportById } from '../src/data/gamesOfNationsSports';
import { getCultureNodeById } from '../src/data/cultureTree';
import { getLeaderWarDeclarationPhrases } from '../src/data/leaderWarDeclarations';
import { createAIWarDeclarationDialogueRequest } from '../src/systems/ai/AIWarDeclarationDialogue';
import { effectiveLeader, validateConfiguration, serializeConfiguration, deserializeConfiguration } from '../src/editor/leaderEditorModel';
import { getLeaderRoomImagePath } from '../src/utils/assetPaths';
import { ScenarioLoader } from '../src/systems/ScenarioLoader';
import { SaveLoadService } from '../src/systems/SaveLoadService';
import { SAVED_GAME_VERSION } from '../src/types/saveGame';
import type { ScenarioData } from '../src/types/scenario';

const json = (path: string) => JSON.parse(fs.readFileSync(path, 'utf8'));

test('every playable nation has alternatives, unchanged defaults, and no unnecessary additions', () => {
  assert.equal(ROSTER_ALTERNATIVE_LEADERS.length, 27);
  assert.equal(NATION_DEFINITIONS.length, audit.length);
  assert.equal(new Set(ALL_LEADERS.map(l => l.id)).size, ALL_LEADERS.length);
  for (const leader of ALL_LEADERS) assert.ok(getNationDefinitionById(leader.nationId), leader.id);
  for (const nation of NATION_DEFINITIONS) {
    const before = audit.find(row => row.nationId === nation.id)!;
    const leaders = getLeadersByNationId(nation.id);
    assert.ok(leaders.length >= 2, nation.name);
    assert.equal(leaders.length, before.finalCount, nation.name);
    assert.equal(leaders.filter(l => l.isDefault).length, 1, nation.name);
    assert.equal(getDefaultLeaderByNationId(nation.id)?.id, before.defaultLeaderId);
    assert.deepEqual(leaders.map(l => l.id), [...before.before, ...before.added]);
    assert.equal(before.added.length, before.before.length === 1 ? 1 : 0);
    for (const current of leaders) {
      // Alternatives form a set for either starting government, not a fixed replacement pair.
      setActiveLeaderSelections({ [nation.id]: current.id });
      assert.equal(getLeaderByNationId(nation.id)?.id, current.id);
      assert.equal(leaders.filter(l => l.id !== current.id).length, leaders.length - 1);
    }
  }
  setActiveLeaderSelections(undefined);
});

for (const leader of ROSTER_ALTERNATIVE_LEADERS) {
  test(`${leader.name}: complete valid profiles and selected identity through scenario/editor/save/dialogue`, () => {
    const { id, nationId, isDefault, ...patch } = leader;
    assert.equal(isDefault, false);
    assert.deepEqual(validateConfiguration({ version: 1, leaders: { [id]: patch } }), []);
    assert.equal(getIdeologyById(leader.ideologyId).id, leader.ideologyId);
    assert.equal(getAINationalAgendaById(leader.aiNationalAgendaId).id, leader.aiNationalAgendaId);
    assert.equal(getAIMilitaryDoctrineById(leader.aiMilitaryDoctrineId).id, leader.aiMilitaryDoctrineId);
    assert.equal(getCovertPersonalityById(leader.covertPersonalityId).id, leader.covertPersonalityId);
    assert.equal(typeof leader.opportunism, 'boolean');
    assert.equal(typeof leader.impulsiveBully, 'boolean');
    for (const id of leader.culturePriorities!) assert.ok(getCultureNodeById(id), id);
    assert.equal(getGamesSportById(leader.gamesOfNationsPreferences.traditionalFavourite).category, 'traditional');
    assert.equal(getGamesSportById(leader.gamesOfNationsPreferences.additionalFavourite).category, 'additional');
    const profile = getLeaderEraStrategyProfile(id)!;
    assert.ok(profile);
    for (const strategy of Object.values(profile.strategiesByEra)) assert.equal(getAILeaderEraStrategyById(strategy!).id, strategy);
    for (const { era } of ERA_TIMELINE) assert.equal(resolveLeaderEraStrategy(id, era).id, profile.strategiesByEra.ancient);
    assert.equal(Object.keys(leader.diplomacyFlavor!).length, 7);
    assert.ok(Object.values(leader.diplomacyFlavor!).every(line => line!.trim().length > 20));
    const original = getDefaultLeaderByNationId(nationId)!;
    const differences = ['ideologyId', 'aiNationalAgendaId', 'aiMilitaryDoctrineId', 'covertPersonalityId', 'culturePriorities'] as const;
    assert.ok(differences.filter(key => JSON.stringify(leader[key]) !== JSON.stringify(original[key])).length >= 2, id);
    assert.notDeepEqual(leader.aiPersonality, original.aiPersonality);
    const edited = deserializeConfiguration(serializeConfiguration({version: 1, leaders: {[id]: {aiPersonality: {economyBias: leader.aiPersonality!.economyBias + 1}}}}));
    assert.equal(effectiveLeader(edited, id).aiPersonality.economyBias, leader.aiPersonality!.economyBias + 1);
    const scenario: ScenarioData = {
      meta: { name: 'Alternative government', version: 1 },
      map: { width: 1, height: 1, tileSize: 64, tiles: [{q: 0, r: 0, type: 'plains'}] },
      nations: [{...getNationDefinitionById(nationId)!, leaderId: id, isHuman: true, startTerritoryCenter: {q: 0, r: 0}}],
      cities: [], units: [], leaderConfiguration: edited,
    };
    assert.equal(ScenarioLoader.parse(JSON.parse(JSON.stringify(scenario))).nations[0].leaderId, id);
    const saved = SaveLoadService.validate(JSON.parse(JSON.stringify({
      version: SAVED_GAME_VERSION, savedAt: new Date(0).toISOString(), mapKey: 'test',
      humanNationId: nationId, activeNationIds: [nationId], leaderSelections: {[nationId]: id}, leaderConfiguration: edited,
      turn: {currentRound: 1, currentTurnIndex: 0}, tiles: [], nations: [], cities: [], units: [], diplomacy: [], discovery: [], wonders: [],
    })));
    assert.equal(saved.ok, true);
    if (!saved.ok) throw new Error('Save validation failed');
    try {
      setActiveLeaderSelections(saved.state.leaderSelections);
      assert.equal(getLeaderByNationId(nationId)?.id, id);
      assert.deepEqual(getLeaderPersonalityByNationId(nationId), leader.aiPersonality);
      assert.deepEqual(saved.state.leaderConfiguration, edited);
      setScenarioLeaderOverrides([{id: nationId, leaderName: 'Scenario government', leaderDescription: 'Scenario description'}]);
      assert.equal(getLeaderByNationId(nationId)?.name, 'Scenario government');
      assert.equal(getLeaderByNationId(nationId)?.id, id);
      setScenarioLeaderOverrides([]);
      assert.ok(ROSTER_ALTERNATIVE_WAR_DECLARATIONS[id]);
      const phrases = getLeaderWarDeclarationPhrases(id);
      for (const reason of ['conquest', 'hostility', 'threat', 'ideological', 'ambition'] as const) {
        assert.equal(phrases[reason].length, 2);
        assert.equal(new Set(phrases[reason]).size, 2);
        assert.ok(phrases[reason].every(line => line.trim().length > 20));
        const request = createAIWarDeclarationDialogueRequest({action: 'declareWar', actorNationId: nationId, targetNationId: 'nation_sweden', attitude: 'hostile', militaryComparison: 'stronger', threatLevel: 'low', relationState: 'PEACE', trust: 10, fear: 20, hostility: 80, affinity: -10, suspicion: 30, warDeclarationReason: reason, reasonText: 'test'}, 'nation_sweden', 17);
        assert.equal(request?.leaderId, id);
        assert.ok(phrases[reason].includes(request!.phrase));
      }
      // Reject a leader selected for the wrong nation, preserving normal fallback.
      setActiveLeaderSelections({ nation_sweden: id });
      assert.equal(getLeaderByNationId('nation_sweden')?.id, getDefaultLeaderByNationId('nation_sweden')?.id);
      setActiveLeaderSelections(undefined);
      assert.equal(getLeaderByNationId(nationId)?.id, original.id);
    } finally { setActiveLeaderSelections(undefined); setScenarioLeaderOverrides([]); }
  });
}

test('all new portraits, rooms, generated editor catalogs and national audio resolve', async () => {
  const catalog = json('public/assets/data/nations-manifest.json');
  const sounds = json('public/assets/sounds/manifest.json').playlists;
  const editor = fs.readFileSync('public/editor/epoch-leader-editor.js', 'utf8');
  const spriteManifest = fs.readFileSync('public/assets/sprites/manifest.json', 'utf8');
  for (const leader of ROSTER_ALTERNATIVE_LEADERS) {
    const nation = getNationDefinitionById(leader.nationId)!;
    const entry = catalog.nations.find((n: any) => n.nationId === nation.id);
    assert.equal(entry.leaderId, getDefaultLeaderByNationId(nation.id)?.id);
    assert.ok(entry.leaders.some((l: any) => l.leaderId === leader.id && l.leaderImage === leader.image));
    assert.ok(editor.includes(leader.id));
    const image = await loadImage(`public${leader.image}`);
    assert.deepEqual([image.width, image.height], [416, 416]);
    const roomPath = getLeaderRoomImagePath(leader.image);
    const room = fs.readFileSync(`public${roomPath}`);
    assert.equal(room.toString('ascii', 0, 4), 'RIFF');
    assert.equal(room.toString('ascii', 8, 12), 'WEBP');
    for (const path of [leader.image, roomPath]) {
      assert.ok(spriteManifest.includes(path.replace('/assets/sprites/', '')));
      if (process.env.EPOCH_VERIFY_BUILD) assert.deepEqual(fs.readFileSync(`dist${path}`), fs.readFileSync(`public${path}`));
    }
    // Existing Mali key mismatch uses SetupMusicManager's start fallback for either leader.
    // Preserve the user's national-audio boundary; do not silently add a new mapping here.
    const playlist = sounds[nation.id] ?? (nation.id === 'nation_mali_empire' ? sounds.start : undefined);
    assert.ok(playlist.length > 0);
    for (const path of playlist) assert.ok(fs.statSync(`public${path}`).size > 0);
    const source = nation.audioPlaylistId ?? nation.audioPlaylistNationId;
    if (source) assert.deepEqual(playlist, sounds[source]);
  }
  assert.deepEqual(sounds.nation_belarus, sounds.nation_russia);
  assert.deepEqual(sounds.nation_yugoslavia, sounds.nation_poland);
  assert.deepEqual(sounds.nation_czechoslovakia, sounds.nation_poland);
});

test('major requested political contrasts remain mechanically meaningful', () => {
  const l = (id: string) => getLeaderById(`leader_${id}`)!;
  const ai = (id: string) => l(id).aiPersonality!;
  assert.ok(ai('mikhail_gorbachev').diplomacyBias - ai('joseph_stalin').diplomacyBias >= 40);
  assert.ok(ai('mikhail_gorbachev').peacePreference - ai('joseph_stalin').peacePreference >= 50);
  assert.equal(l('juan_peron').aiNationalAgendaId, 'growth');
  assert.notEqual(l('juan_peron').ideologyId, l('javier_milei').ideologyId);
  assert.ok(ai('juan_peron').cultureBias - ai('javier_milei').cultureBias >= 20);
  assert.ok(ai('mohammad_reza_pahlavi').diplomacyBias - ai('ruhollah_khomeini').diplomacyBias >= 40);
  assert.equal(l('mohammad_reza_pahlavi').aiMilitaryDoctrineId, 'eliteArmy');
  assert.ok(ai('yitzhak_rabin').peacePreference - ai('benjamin_netanyahu').peacePreference >= 40);
  assert.ok(ai('urho_kekkonen').peacePreference - ai('alexander_stubb').peacePreference >= 20);
  assert.ok(ai('stephen_harper').diplomacyBias < ai('justin_trudeau').diplomacyBias);
  assert.ok(ai('petro_poroshenko').diplomacyBias < ai('volodymyr_zelenskyy').diplomacyBias);
  assert.equal(l('anne_bonny').opportunism, true);
  assert.equal(l('anne_bonny').impulsiveBully, false);
  assert.ok(ai('anne_bonny').economyBias > ai('mad_jack').economyBias);
  assert.equal(l('han_seo_jin').ideologyId, 'progressivism');
  assert.match(l('han_seo_jin').description!, /fictional character created for Epoch/i);
  assert.ok(ai('han_seo_jin').diplomacyBias - ai('kim_jong_un').diplomacyBias >= 50);
  assert.ok(ai('sviatlana_tsikhanouskaya').diplomacyBias - ai('alexander_lukashenko').diplomacyBias >= 40);
  assert.notEqual(l('peter_ii_of_yugoslavia').ideologyId, l('josip_broz_tito').ideologyId);
  assert.ok(ai('vaclav_havel').cultureBias - ai('antonin_zapotocky').cultureBias >= 20);
});
