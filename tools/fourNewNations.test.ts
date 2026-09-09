import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { loadImage } from 'canvas';
import { getGamesSportById } from '../src/data/gamesOfNationsSports';
import cityNames from '../src/data/cityNames.json';
import { NATION_DEFINITIONS, getNationDefinitionById } from '../src/data/nations';
import { ALL_LEADERS, getDefaultLeaderByNationId, getLeadersByNationId } from '../src/data/leaders';
import { resolveLeaderEraStrategy } from '../src/data/aiLeaderEraStrategies';
import { getAIMilitaryDoctrineById } from '../src/data/aiMilitaryDoctrines';
import { getLeaderWarDeclarationPhrases } from '../src/data/leaderWarDeclarations';
import { validateConfiguration } from '../src/editor/leaderEditorModel';
import { getLeaderRoomImagePath } from '../src/utils/assetPaths';
import { ScenarioLoader } from '../src/systems/ScenarioLoader';
import { SaveLoadService } from '../src/systems/SaveLoadService';
import { SAVED_GAME_VERSION } from '../src/types/saveGame';
import { createAIWarDeclarationDialogueRequest } from '../src/systems/ai/AIWarDeclarationDialogue';
import type { ScenarioData } from '../src/types/scenario';

export const NEW_NATIONS = [
  ['canada', 'justin_trudeau', 'Canadian Dollar', '$', 'Ottawa'],
  ['mexico', 'claudia_sheinbaum_pardo', 'Mexican Peso', '$', 'Mexico City'],
  ['argentina', 'javier_milei', 'Argentine Peso', '$', 'Buenos Aires'],
  ['ukraine', 'volodymyr_zelenskyy', 'Hryvnia', '₴', 'Kyiv'],
  ['finland', 'alexander_stubb', 'Euro', '€', 'Helsinki'],
] as const;

for (const [slug, leaderSlug, currency, symbol, capital] of NEW_NATIONS) {
  const nationId = `nation_${slug}`;
  const leaderId = `leader_${leaderSlug}`;
  test(`${slug}: complete canonical content, editor registry, currency and original audio`, async () => {
    const nation = getNationDefinitionById(nationId)!;
    const leader = getDefaultLeaderByNationId(nationId)!;
    assert.equal(leader.id, leaderId);
    assert.equal(getLeadersByNationId(nationId).filter(l => l.isDefault).length, 1);
    assert.equal(nation.currencyName, currency);
    assert.equal(nation.currencySymbol, symbol);
    const { id, nationId: _, isDefault, ...patch } = leader;
    assert.deepEqual(validateConfiguration({ version: 1, leaders: { [id]: patch } }), []);
    assert.equal(getGamesSportById(leader.gamesOfNationsPreferences.traditionalFavourite).category, 'traditional');
    assert.equal(getGamesSportById(leader.gamesOfNationsPreferences.additionalFavourite).category, 'additional');
    assert.equal(Object.keys(leader.diplomacyFlavor!).length, 7);
    assert.ok(Object.values(leader.diplomacyFlavor!).every(line => line.length > 40));
    const names = cityNames[nationId as keyof typeof cityNames];
    assert.equal(names[0], capital);
    assert.ok(names.length >= 20);
    assert.equal(new Set(names).size, names.length);
    const manifest = JSON.parse(fs.readFileSync('public/assets/data/nations-manifest.json', 'utf8'));
    const entry = manifest.nations.find((n: any) => n.nationId === nationId);
    assert.equal(entry.leaderId, leaderId);
    assert.equal(entry.currencySymbol, symbol);
    assert.equal(entry.currencyName, currency);
    assert.equal(entry.leaders[0].leaderImage, leader.image);
    assert.equal(entry.color, nation.color);
    assert.equal(entry.secondaryColor, nation.secondaryColor);
    const cityManifest = JSON.parse(fs.readFileSync('public/assets/data/city-names-manifest.json', 'utf8'));
    assert.deepEqual(cityManifest.cityNames[nationId], names);
    const sounds = JSON.parse(fs.readFileSync('public/assets/sounds/manifest.json', 'utf8'));
    assert.deepEqual(sounds.playlists[nationId], [1, 2].map(i => `/assets/sounds/${nationId}/${nationId}_theme-0${i}.mp3`));
    for (const path of sounds.playlists[nationId]) assert.ok(fs.statSync(`public${path}`).size > 0);
    for (const [path, w, h] of [[leader.image, 416, 416], [getLeaderRoomImagePath(leader.image), 2048, 872]] as const) {
      assert.ok(fs.statSync(`public${path}`).size > 0);
      if (path.endsWith('.webp')) continue;
      const image = await loadImage(`public${path}`);
      assert.deepEqual([image.width, image.height], [w, h]);
    }
  });
  test(`${slug}: scenario/save IDs and all war reasons reach audience dialogue`, () => {
    const nation = getNationDefinitionById(nationId)!;
    const scenario: ScenarioData = {
      meta: { name: slug, version: 1 },
      map: { width: 1, height: 1, tileSize: 64, tiles: [{ q: 0, r: 0, type: 'plains' }] },
      nations: [{ ...nation, isHuman: true, startTerritoryCenter: { q: 0, r: 0 }, leaderId }],
      cities: [{ id: 'capital', name: capital, nationId, q: 0, r: 0, isCapital: true }],
      units: [{ nationId, unitTypeId: 'warrior', q: 0, r: 0 }],
    };
    const parsed = ScenarioLoader.parse(JSON.parse(JSON.stringify(scenario)));
    assert.equal(parsed.nations[0].leaderId, leaderId);
    assert.equal(parsed.cities[0].nationId, nationId);
    const validated = SaveLoadService.validate({
      version: SAVED_GAME_VERSION, savedAt: new Date(0).toISOString(), mapKey: 'test',
      humanNationId: nationId, activeNationIds: [nationId], leaderSelections: { [nationId]: leaderId },
      turn: { currentRound: 1, currentTurnIndex: 0 },
      tiles: [], nations: [], cities: [], units: [], diplomacy: [], discovery: [], wonders: [],
    });
    assert.equal(validated.ok, true);
    if (validated.ok) assert.equal(validated.state.leaderSelections?.[nationId], leaderId);
    const phrases = getLeaderWarDeclarationPhrases(leaderId);
    for (const reason of ['conquest', 'hostility', 'threat', 'ideological', 'ambition'] as const) {
      assert.equal(new Set(phrases[reason]).size, 2);
      const request = createAIWarDeclarationDialogueRequest({
        action: 'declareWar', actorNationId: nationId, targetNationId: 'nation_sweden',
        attitude: 'hostile', militaryComparison: 'stronger', threatLevel: 'low', relationState: 'PEACE',
        trust: 10, fear: 20, hostility: 80, affinity: -10, suspicion: 30,
        warDeclarationReason: reason, reasonText: 'test',
      }, 'nation_sweden', 17);
      assert.equal(request?.leaderId, leaderId);
      assert.ok(phrases[reason].includes(request!.phrase));
    }
  });
}

test('roster remains unique and four personalities differ with resilient Ukrainian defense', () => {
  assert.equal(new Set(NATION_DEFINITIONS.map(n => n.id)).size, NATION_DEFINITIONS.length);
  assert.equal(new Set(ALL_LEADERS.map(l => l.id)).size, ALL_LEADERS.length);
  const [canada, mexico, argentina, ukraine] = NEW_NATIONS.map(([slug]) => getDefaultLeaderByNationId(`nation_${slug}`)!);
  assert.ok(canada.aiPersonality!.diplomacyBias > mexico.aiPersonality!.diplomacyBias);
  assert.ok(mexico.aiPersonality!.cultureBias > canada.aiPersonality!.cultureBias);
  assert.ok(argentina.aiPersonality!.economyBias > canada.aiPersonality!.economyBias);
  assert.equal(argentina.opportunism, false);
  assert.equal(argentina.covertPersonalityId, 'opportunist');
  assert.equal(ukraine.aiNationalAgendaId, 'homeland_defense');
  assert.ok(ukraine.aiPersonality!.aggressionBias < 0 && ukraine.aiPersonality!.expansionBias < 0);
  assert.ok(ukraine.aiPersonality!.warTolerance >= 80);
  const doctrine = getAIMilitaryDoctrineById(ukraine.aiMilitaryDoctrineId);
  assert.equal(doctrine.militaryBudget.allowOverbuildingWhenThreatened, true);
  assert.ok(doctrine.modernizationBias > 1);
  const era = resolveLeaderEraStrategy(ukraine.id, 'modern');
  assert.equal(era.id, 'defensiveBuilder');
  assert.equal(era.militaryBehavior.targetWeakNeighbor, false);
  assert.ok(era.militaryBehavior.minimumMilitaryReadiness > 1);
  assert.ok(!/Kiev|Kharkov|Odessa|Lvov|Dnepr|Zaporozhye|Lugansk/.test(cityNames.nation_ukraine.join(' ')));
});


test('Finland combines diplomatic openness with prepared professional defense in every era', () => {
  const leader = getDefaultLeaderByNationId('nation_finland')!;
  assert.equal(leader.title, 'President');
  assert.equal(leader.ideologyId, 'globalism');
  assert.equal(leader.aiNationalAgendaId, 'homeland_defense');
  assert.equal(leader.covertPersonalityId, 'pragmatist');
  assert.equal(leader.opportunism, false);
  assert.equal(leader.impulsiveBully, false);
  assert.ok(leader.aiPersonality!.diplomacyBias >= 25);
  assert.ok(leader.aiPersonality!.aggressionBias < 0);
  assert.ok(leader.aiPersonality!.expansionBias < 0);
  assert.ok(leader.aiPersonality!.warTolerance >= 65);
  assert.ok(leader.aiPersonality!.peacePreference >= 65);
  for (const era of ['ancient', 'classical', 'medieval', 'renaissance', 'industrial', 'modern'] as const) {
    const strategy = resolveLeaderEraStrategy(leader.id, era);
    assert.equal(strategy.id, 'defensiveBuilder');
    assert.equal(strategy.militaryBehavior.targetWeakNeighbor, false);
    assert.ok(strategy.militaryBehavior.minimumMilitaryReadiness > 1);
    assert.ok(strategy.diplomacyWeights.embassy > 1);
  }
  const doctrine = getAIMilitaryDoctrineById(leader.aiMilitaryDoctrineId);
  assert.ok(doctrine.qualityBias > doctrine.quantityBias);
  assert.ok(doctrine.modernizationBias > 1);
  assert.equal(doctrine.militaryBudget.allowOverbuildingWhenThreatened, true);
  assert.equal(leader.gamesOfNationsPreferences.traditionalFavourite, 'javelin');
  assert.equal(leader.gamesOfNationsPreferences.additionalFavourite, 'pole_vault');
  for (const name of ['Jyväskylä', 'Hämeenlinna', 'Seinäjoki', 'Maarianhamina']) {
    assert.ok(cityNames.nation_finland.includes(name));
  }
});
