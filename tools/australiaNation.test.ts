import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { loadImage } from 'canvas';
import { AUSTRALIAN_LEADERS, JOHN_HOWARD, BOB_HAWKE } from '../src/data/australianLeaders';
import { getDefaultLeaderByNationId, getLeadersByNationId, getAlternativeLeadersByNationId, getLeaderByNationId, setActiveLeaderSelections, setActiveLeaderForNation, setScenarioLeaderOverrides, getLeaderPersonalityByNationId } from '../src/data/leaders';
import { getNationDefinitionById } from '../src/data/nations';
import { getAIMilitaryDoctrineById } from '../src/data/aiMilitaryDoctrines';
import { getIdeologyById } from '../src/data/ideologies';
import { resolveLeaderEraStrategy } from '../src/data/aiLeaderEraStrategies';
import { LEADER_WAR_DECLARATIONS } from '../src/data/leaderWarDeclarations';
import { getGamesSportById } from '../src/data/gamesOfNationsSports';
import { validateConfiguration } from '../src/editor/leaderEditorModel';
import { getLeaderRoomImagePath } from '../src/utils/assetPaths';
import { ScenarioLoader } from '../src/systems/ScenarioLoader';
import { SaveLoadService } from '../src/systems/SaveLoadService';
import { SAVED_GAME_VERSION } from '../src/types/saveGame';
import cityNames from '../src/data/cityNames.json';

const nationId = 'nation_australia';
const json = (path: string) => JSON.parse(fs.readFileSync(path, 'utf8'));

test('Australia is a playable editor nation with Howard default, both leaders, cities and shared England audio', async () => {
  const nation = getNationDefinitionById(nationId)!;
  assert.equal(nation.name, 'Australia');
  assert.equal(getDefaultLeaderByNationId(nationId)?.id, JOHN_HOWARD.id);
  assert.deepEqual(getLeadersByNationId(nationId), AUSTRALIAN_LEADERS);
  assert.equal(getLeadersByNationId(nationId).filter(l => l.isDefault).length, 1);
  const entry = json('public/assets/data/nations-manifest.json').nations.find((n: any) => n.nationId === nationId);
  assert.equal(entry.leaderId, JOHN_HOWARD.id);
  assert.deepEqual(entry.leaders.map((l: any) => l.leaderId), AUSTRALIAN_LEADERS.map(l => l.id));
  assert.equal(entry.flagImage, nation.flagImage);
  assert.equal(entry.color, nation.color);
  assert.equal(entry.secondaryColor, nation.secondaryColor);
  assert.equal(nation.currencySymbol, 'A$');
  assert.equal(cityNames.nation_australia[0], 'Canberra');
  assert.ok(cityNames.nation_australia.length >= 20);
  assert.equal(new Set(cityNames.nation_australia).size, cityNames.nation_australia.length);
  assert.deepEqual(json('public/assets/data/city-names-manifest.json').cityNames[nationId], cityNames.nation_australia);
  const playlists = json('public/assets/sounds/manifest.json').playlists;
  assert.equal(nation.audioPlaylistNationId, 'nation_england');
  assert.ok(playlists.nation_england.length > 0);
  assert.deepEqual(playlists[nationId], playlists.nation_england);
  assert.equal(fs.existsSync('public/assets/sounds/nation_australia'), false);
  for (const track of playlists[nationId]) assert.ok(fs.statSync(`public${track}`).size > 0);
  const flag = await loadImage(`public${nation.flagImage}`);
  assert.deepEqual([flag.width, flag.height], [900, 450]);
});

for (const leader of AUSTRALIAN_LEADERS) test(`${leader.name}: valid profiles, assets, sports, dialogue and scenario/save selection`, async () => {
  const { id, nationId: _, isDefault, ...patch } = leader;
  assert.deepEqual(validateConfiguration({ version: 1, leaders: { [id]: patch } }), []);
  assert.equal(getGamesSportById(leader.gamesOfNationsPreferences.traditionalFavourite).category, 'traditional');
  assert.equal(getGamesSportById(leader.gamesOfNationsPreferences.additionalFavourite).category, 'additional');
  assert.equal(Object.keys(leader.diplomacyFlavor!).length, 7);
  for (const phrases of Object.values(LEADER_WAR_DECLARATIONS[id])) assert.equal(new Set(phrases).size, 2);
  const portrait = await loadImage(`public${leader.image}`);
  assert.deepEqual([portrait.width, portrait.height], [416, 416]);
  const room = fs.readFileSync(`public${getLeaderRoomImagePath(leader.image)}`);
  assert.equal(room.toString('ascii', 8, 12), 'WEBP');
  assert.ok(fs.readFileSync('public/editor/epoch-leader-editor.js', 'utf8').includes(id));
  const scenario = ScenarioLoader.parse({
    meta: { name: 'Australia', version: 1 },
    map: { width: 1, height: 1, tileSize: 64, tiles: [{ q: 0, r: 0, type: 'plains' }] },
    nations: [{ ...getNationDefinitionById(nationId)!, isHuman: true, startTerritoryCenter: { q: 0, r: 0 }, leaderId: id }],
    cities: [{ id: 'capital', name: 'Canberra', nationId, q: 0, r: 0, isCapital: true }], units: [],
  });
  assert.equal(scenario.nations[0].leaderId, id);
  const saved = SaveLoadService.validate({
    version: SAVED_GAME_VERSION, savedAt: new Date(0).toISOString(), mapKey: 'test', humanNationId: nationId,
    activeNationIds: [nationId], leaderSelections: { [nationId]: id }, turn: { currentRound: 1, currentTurnIndex: 0 },
    tiles: [], nations: [], cities: [], units: [], diplomacy: [], discovery: [], wonders: [],
  });
  assert.equal(saved.ok, true);
  if (saved.ok) assert.equal(saved.state.leaderSelections?.[nationId], id);
});

test('leadership changes preserve Australia and resolve distinct live behavior in both directions and scenario aliases', () => {
  try {
    for (const runtimeId of [nationId, 'scenario_australia']) {
      setScenarioLeaderOverrides(runtimeId === nationId ? [] : [{ id: runtimeId, replacementNationId: nationId }]);
      for (const [current, replacement] of [[JOHN_HOWARD, BOB_HAWKE], [BOB_HAWKE, JOHN_HOWARD]]) {
        assert.equal(setActiveLeaderForNation(runtimeId, current.id), true);
        assert.deepEqual(getAlternativeLeadersByNationId(runtimeId).map(l => l.id), [replacement.id]);
        assert.equal(setActiveLeaderForNation(runtimeId, replacement.id), true);
        assert.equal(getLeaderByNationId(runtimeId)?.ideologyId, replacement.ideologyId);
        assert.deepEqual(getLeaderPersonalityByNationId(runtimeId), replacement.aiPersonality);
      }
    }
  } finally { setActiveLeaderSelections(undefined); setScenarioLeaderOverrides([]); }
  const h = JOHN_HOWARD.aiPersonality!, b = BOB_HAWKE.aiPersonality!;
  assert.ok(h.warTolerance > b.warTolerance && h.casualtyToleranceRatio > b.casualtyToleranceRatio);
  assert.ok(h.economyBias < b.economyBias && h.diplomacyBias < b.diplomacyBias && h.peacePreference < b.peacePreference);
  const hd = getAIMilitaryDoctrineById(JOHN_HOWARD.aiMilitaryDoctrineId);
  const bd = getAIMilitaryDoctrineById(BOB_HAWKE.aiMilitaryDoctrineId);
  assert.ok(hd.militaryBudget.strengthMultiplier > bd.militaryBudget.strengthMultiplier);
  assert.ok(hd.preferredRoles.navalRanged > 1);
  for (const l of AUSTRALIAN_LEADERS) {
    const d = getAIMilitaryDoctrineById(l.aiMilitaryDoctrineId);
    assert.ok(d.qualityBias > 1 && d.quantityBias < 1 && d.modernizationBias > 1);
    assert.equal(l.maxPreferredCities, 5);
    assert.ok(l.aiPersonality!.expansionBias < 0 && l.aiPersonality!.aggressionBias < 0);
    assert.equal(l.aiPersonality!.resourceExploitationInterest, 4);
    assert.ok(resolveLeaderEraStrategy(l.id, 'ancient').foundingPreferences!.coastalAccess! > 1);
  }
  assert.ok(getIdeologyById(BOB_HAWKE.ideologyId).tradeBias > getIdeologyById(JOHN_HOWARD.ideologyId).tradeBias);
  const he = resolveLeaderEraStrategy(JOHN_HOWARD.id, 'modern');
  const be = resolveLeaderEraStrategy(BOB_HAWKE.id, 'modern');
  assert.ok(he.productionWeights.military > be.productionWeights.military);
  assert.ok(he.militaryBehavior.minimumMilitaryReadiness > be.militaryBehavior.minimumMilitaryReadiness);
  assert.ok(be.diplomacyWeights.trade > he.diplomacyWeights.trade);
});
