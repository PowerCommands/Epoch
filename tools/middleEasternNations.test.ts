import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { loadImage } from 'canvas';
import { MIDDLE_EASTERN_LEADERS } from '../src/data/middleEasternLeaders';
import { NATION_DEFINITIONS, getNationDefinitionById } from '../src/data/nations';
import { ALL_LEADERS, getDefaultLeaderByNationId, getLeadersByNationId, getLeaderByNationId, setActiveLeaderSelections } from '../src/data/leaders';
import { getIdeologyById } from '../src/data/ideologies';
import { getAINationalAgendaById } from '../src/data/aiNationalAgendas';
import { getAIMilitaryDoctrineById } from '../src/data/aiMilitaryDoctrines';
import { getCovertPersonalityById } from '../src/data/covertPersonalities';
import { resolveLeaderEraStrategy } from '../src/data/aiLeaderEraStrategies';
import { getGamesSportById } from '../src/data/gamesOfNationsSports';
import { LEADER_WAR_DECLARATIONS, getLeaderWarDeclarationPhrases } from '../src/data/leaderWarDeclarations';
import { effectiveLeader, validateConfiguration, serializeConfiguration, deserializeConfiguration } from '../src/editor/leaderEditorModel';
import { getLeaderRoomImagePath } from '../src/utils/assetPaths';
import { ScenarioLoader } from '../src/systems/ScenarioLoader';
import { SaveLoadService } from '../src/systems/SaveLoadService';
import { SAVED_GAME_VERSION } from '../src/types/saveGame';
import { createAIWarDeclarationDialogueRequest } from '../src/systems/ai/AIWarDeclarationDialogue';
import cityNames from '../src/data/cityNames.json';
import type { ScenarioData } from '../src/types/scenario';

const expected = {
  nation_iran: 'leader_ruhollah_khomeini', nation_iraq: 'leader_saddam_hussein',
  nation_egypt: 'leader_cleopatra_vii', nation_israel: 'leader_benjamin_netanyahu',
  nation_turkey: 'leader_recep_tayyip_erdogan', nation_saudi_arabia: 'leader_mohammed_bin_salman',
};
const json = (path: string) => JSON.parse(fs.readFileSync(path, 'utf8'));

test('six unique nations, canonical defaults, shared audio and generated editor catalogs', () => {
  assert.equal(new Set(NATION_DEFINITIONS.map(n => n.id)).size, NATION_DEFINITIONS.length);
  assert.equal(new Set(ALL_LEADERS.map(l => l.id)).size, ALL_LEADERS.length);
  const sounds = json('public/assets/sounds/manifest.json').playlists;
  const tracks = fs.readdirSync('public/assets/sounds/nations_middle_east').filter(f => f.endsWith('.mp3')).sort().map(f => `/assets/sounds/nations_middle_east/${f}`);
  assert.equal(tracks.length, 2);
  const manifest = json('public/assets/data/nations-manifest.json');
  for (const [id, defaultId] of Object.entries(expected)) {
    const nation = getNationDefinitionById(id)!;
    assert.ok(nation.currencyName && nation.currencySymbol);
    assert.match(nation.color, /^#[0-9a-f]{6}$/i);
    assert.match(nation.secondaryColor, /^#[0-9a-f]{6}$/i);
    assert.equal(getDefaultLeaderByNationId(id)?.id, defaultId);
    assert.equal(getLeadersByNationId(id).filter(l => l.isDefault).length, 1);
    assert.equal(nation.audioPlaylistId, 'nations_middle_east');
    assert.deepEqual(sounds[id], tracks);
    assert.equal(fs.existsSync(`public/assets/sounds/${id}`), false);
    for (const track of tracks) assert.ok(fs.statSync(`public${track}`).size > 0);
    const entry = manifest.nations.find((n: any) => n.nationId === id);
    assert.equal(entry.leaderId, defaultId);
    assert.deepEqual(entry.leaders.map((l: any) => l.leaderId), getLeadersByNationId(id).map(l => l.id));
    const names = cityNames[id as keyof typeof cityNames];
    assert.ok(names.length >= 20);
    assert.equal(new Set(names).size, names.length);
    assert.deepEqual(json('public/assets/data/city-names-manifest.json').cityNames[id], names);
  }
  assert.deepEqual(getLeadersByNationId('nation_egypt').map(l => [l.id, l.isDefault]), [['leader_cleopatra_vii', true], ['leader_abdel_fattah_el_sisi', false]]);
});

for (const l of MIDDLE_EASTERN_LEADERS) {
  test(`${l.name}: valid profiles, dialogue, editor edits, scenario/save roundtrip and assets`, async () => {
    const { id, nationId, isDefault, ...patch } = l;
    assert.deepEqual(validateConfiguration({ version: 1, leaders: { [id]: patch } }), []);
    assert.equal(getIdeologyById(l.ideologyId).id, l.ideologyId);
    assert.equal(getAINationalAgendaById(l.aiNationalAgendaId).id, l.aiNationalAgendaId);
    assert.equal(getAIMilitaryDoctrineById(l.aiMilitaryDoctrineId).id, l.aiMilitaryDoctrineId);
    assert.equal(getCovertPersonalityById(l.covertPersonalityId).id, l.covertPersonalityId);
    for (const era of ['ancient', 'classical', 'medieval', 'renaissance', 'industrial', 'modern'] as const) assert.ok(resolveLeaderEraStrategy(id, era).id);
    assert.equal(getGamesSportById(l.gamesOfNationsPreferences.traditionalFavourite).category, 'traditional');
    assert.equal(getGamesSportById(l.gamesOfNationsPreferences.additionalFavourite).category, 'additional');
    assert.equal(Object.keys(l.diplomacyFlavor!).length, 7);
    const edited = deserializeConfiguration(serializeConfiguration({ version: 1, leaders: { [id]: { aiPersonality: { economyBias: l.aiPersonality!.economyBias + 1 } } } }));
    assert.equal(effectiveLeader(edited, id).aiPersonality.economyBias, l.aiPersonality!.economyBias + 1);
    const scenario: ScenarioData = {
      meta: { name: 'Middle East', version: 1 },
      map: { width: 1, height: 1, tileSize: 64, tiles: [{ q: 0, r: 0, type: 'plains' }] },
      nations: [{ ...getNationDefinitionById(nationId)!, leaderId: id, isHuman: true, startTerritoryCenter: { q: 0, r: 0 } }],
      cities: [], units: [], leaderConfiguration: edited,
    };
    const restored = JSON.parse(JSON.stringify(scenario));
    assert.equal(ScenarioLoader.parse(restored).nations[0].leaderId, id);
    const saved = SaveLoadService.validate(JSON.parse(JSON.stringify({
      version: SAVED_GAME_VERSION, savedAt: new Date(0).toISOString(), mapKey: 'test',
      humanNationId: nationId, activeNationIds: [nationId], leaderSelections: { [nationId]: id }, leaderConfiguration: edited,
      turn: { currentRound: 1, currentTurnIndex: 0 }, tiles: [], nations: [], cities: [], units: [], diplomacy: [], discovery: [], wonders: [],
    })));
    assert.equal(saved.ok, true);
    try {
      if (!saved.ok) throw new Error('Invalid saved state');
      setActiveLeaderSelections(saved.state.leaderSelections);
      assert.equal(getLeaderByNationId(nationId)?.id, id);
      assert.deepEqual(saved.state.leaderConfiguration, edited);
      assert.ok(LEADER_WAR_DECLARATIONS[id]);
      const phrases = getLeaderWarDeclarationPhrases(id);
      for (const reason of ['conquest', 'hostility', 'threat', 'ideological', 'ambition'] as const) {
        assert.equal(new Set(phrases[reason]).size, 2);
        const request = createAIWarDeclarationDialogueRequest({ action: 'declareWar', actorNationId: nationId, targetNationId: 'nation_sweden', attitude: 'hostile', militaryComparison: 'stronger', threatLevel: 'low', relationState: 'PEACE', trust: 10, fear: 20, hostility: 80, affinity: -10, suspicion: 30, warDeclarationReason: reason, reasonText: 'test' }, 'nation_sweden', 17);
        assert.equal(request?.leaderId, id);
        assert.ok(phrases[reason].includes(request!.phrase));
      }
    } finally { setActiveLeaderSelections(undefined); }
    const image = await loadImage(`public${l.image}`);
    assert.deepEqual([image.width, image.height], [416, 416]);
    const room = fs.readFileSync(`public${getLeaderRoomImagePath(l.image)}`);
    assert.equal(room.toString('ascii', 0, 4), 'RIFF');
    assert.equal(room.toString('ascii', 8, 12), 'WEBP');
    assert.ok(fs.readFileSync('public/editor/epoch-leader-editor.js', 'utf8').includes(id));
    if (process.env.EPOCH_VERIFY_BUILD) for (const path of [l.image, getLeaderRoomImagePath(l.image)]) assert.deepEqual(fs.readFileSync(`dist${path}`), fs.readFileSync(`public${path}`));
  });
}

test('distinct military, cultural and economic identities survive profile composition', () => {
  const [iran, iraq, cleopatra, sisi, israel, turkey, saudi] = MIDDLE_EASTERN_LEADERS;
  assert.ok(iraq.aiPersonality!.aggressionBias - iran.aiPersonality!.aggressionBias >= 30);
  assert.ok(iran.aiPersonality!.warTolerance >= 85);
  assert.equal(iran.opportunism, false);
  assert.equal(iraq.opportunism, true);
  assert.equal(iraq.impulsiveBully, true);
  assert.equal(resolveLeaderEraStrategy(iraq.id, 'modern').militaryBehavior.targetWeakNeighbor, true);
  assert.equal(resolveLeaderEraStrategy(iran.id, 'modern').militaryBehavior.targetWeakNeighbor, false);
  assert.ok(cleopatra.aiPersonality!.cultureBias > sisi.aiPersonality!.cultureBias);
  assert.equal(israel.maxPreferredCities, 4);
  assert.equal(israel.opportunism, false);
  assert.ok(resolveLeaderEraStrategy(israel.id, 'modern').militaryBehavior.minimumMilitaryReadiness > 1);
  assert.ok(getAIMilitaryDoctrineById(israel.aiMilitaryDoctrineId).modernizationBias > 1);
  assert.equal(turkey.opportunism, true);
  assert.equal(saudi.aiPersonality!.resourceExploitationInterest, 4);
  assert.ok(saudi.aiPersonality!.economyBias > turkey.aiPersonality!.economyBias);
  assert.ok(saudi.aiPersonality!.warTolerance < 40);
  assert.equal(saudi.covertPersonalityId, 'merchant');
});
