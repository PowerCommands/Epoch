import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { loadImage } from 'canvas';
import { AIStrategySelector } from '../src/systems/ai/AIStrategySelector';
import { ECONOMIC_AI_STRATEGY, AGGRESSIVE_AI_STRATEGY } from '../src/data/aiStrategies';
import { MODERN_ALTERNATIVE_LEADERS } from '../src/data/modernAlternativeLeaders';
import { ALL_LEADERS, getLeaderByNationId, getLeadersByNationId, getDefaultLeaderByNationId, setActiveLeaderSelections, setScenarioLeaderOverrides, getActiveLeaderSelections } from '../src/data/leaders';
import { effectiveLeader, validateConfiguration, serializeConfiguration, deserializeConfiguration, effectiveEra } from '../src/editor/leaderEditorModel';
import { setLeaderConfiguration, type LeaderConfiguration } from '../src/data/leaderConfiguration';
import { getAIMilitaryDoctrineById } from '../src/data/aiMilitaryDoctrines';
import { getAILeaderEraStrategyById } from '../src/data/aiLeaderEraStrategies';
import { getLeaderRoomImagePath } from '../src/utils/assetPaths';
import { ScenarioLoader } from '../src/systems/ScenarioLoader';
import { SaveLoadService } from '../src/systems/SaveLoadService';
import { SAVED_GAME_VERSION } from '../src/types/saveGame';
import type { ScenarioData } from '../src/types/scenario';

const expected: Record<string, string> = {
  franklin_d_roosevelt: 'usa', donald_j_trump: 'usa', mao_zedong: 'china',
  emmanuel_macron: 'france', angela_merkel: 'germany', narendra_modi: 'india',
  vladimir_putin: 'russia', tony_blair: 'england', giorgia_meloni: 'italy',
  jair_bolsonaro: 'brazil', pedro_sanchez: 'spain', donald_tusk: 'poland',
  mette_frederiksen: 'denmark', olof_palme: 'sweden',
};
const leader = (id: string) => MODERN_ALTERNATIVE_LEADERS.find(l => l.id === `leader_${id}`)!;

test('all fourteen authentic alternatives have unique IDs, complete valid definitions and unchanged defaults', () => {
  assert.equal(MODERN_ALTERNATIVE_LEADERS.length, 14);
  assert.equal(new Set(ALL_LEADERS.map(l => l.id)).size, ALL_LEADERS.length);
  for (const [id, nation] of Object.entries(expected)) {
    const l = leader(id);
    assert.ok(l, id);
    assert.equal(l.nationId, `nation_${nation}`);
    assert.equal(l.isDefault, false);
    assert.equal(getLeadersByNationId(l.nationId).filter(l => l.isDefault).length, 1);
    assert.ok(l.title && l.description && l.diplomacyFlavor?.greeting);
    const { id: _, nationId: __, isDefault: ___, ...patch } = l;
    assert.deepEqual(validateConfiguration({ version: 1, leaders: { [l.id]: patch } }), [], l.id);
  }
  assert.deepEqual(getLeadersByNationId('nation_usa').map(l => l.id), [
    'leader_george-washington', 'leader_franklin_d_roosevelt', 'leader_donald_j_trump',
  ]);
});

test('explicit traits are independent and European alternatives are strategically distinct', () => {
  assert.deepEqual(MODERN_ALTERNATIVE_LEADERS.filter(l => l.impulsiveBully).map(l => l.id), ['leader_donald_j_trump', 'leader_jair_bolsonaro']);
  assert.deepEqual(MODERN_ALTERNATIVE_LEADERS.filter(l => l.opportunism).map(l => l.id), ['leader_donald_j_trump', 'leader_vladimir_putin']);
  const profiles = MODERN_ALTERNATIVE_LEADERS.map(l => JSON.stringify(l.aiPersonality));
  assert.equal(new Set(profiles).size, 14);
  const fdr = leader('franklin_d_roosevelt').aiPersonality!;
  assert.ok(fdr.aggressionBias < 0 && fdr.warTolerance > 70 && fdr.casualtyToleranceRatio > .5);
  const blair = leader('tony_blair').aiPersonality!;
  assert.ok(blair.diplomacyBias > 20 && blair.warTolerance > 65 && blair.peacePreference < 50);
  assert.ok(leader('mao_zedong').aiPersonality!.casualtyToleranceRatio > getDefaultLeaderByNationId('nation_china')!.aiPersonality!.casualtyToleranceRatio);
  assert.ok(leader('narendra_modi').aiPersonality!.aggressionBias > getDefaultLeaderByNationId('nation_india')!.aiPersonality!.aggressionBias);
  for (const id of ['donald_tusk', 'mette_frederiksen']) {
    const l = leader(id);
    assert.ok(l.aiPersonality!.aggressionBias < 0 && l.aiPersonality!.expansionBias < 0);
    const doctrine = getAIMilitaryDoctrineById(l.aiMilitaryDoctrineId);
    assert.ok(doctrine.militaryBudget.strengthMultiplier >= 1.1);
    assert.equal(doctrine.militaryBudget.allowOverbuildingWhenThreatened, true);
    assert.equal(effectiveEra({ version: 1 }, l.id, 'modern').id, 'defensiveBuilder');
  }
  const putinEra = getAILeaderEraStrategyById(effectiveEra({ version: 1 }, leader('vladimir_putin').id, 'modern').id);
  assert.ok(putinEra.foundingPreferences!.strategicResource! > 1);
  assert.equal(putinEra.militaryBehavior.targetWeakNeighbor, true);
});

test('Roosevelt develops the economy in peace and mobilizes strongly once at war', () => {
  const fdr = leader('franklin_d_roosevelt');
  const selector = new AIStrategySelector();
  const context = {
    nationId: fdr.nationId, currentTurn: 20, currentStrategyId: 'balanced', strategyStartedTurn: 0,
    nationalAgendaId: fdr.aiNationalAgendaId!, leaderPersonality: fdr.aiPersonality!,
    cityCount: 4, unitCount: 4, gold: 200, goldPerTurn: 5, netHappiness: 5,
    atWar: false, enemyMilitaryNearby: false, highestThreatLevel: 'low' as const,
  };
  assert.equal(selector.selectStrategy(context), 'economic');
  assert.equal(selector.selectStrategy({ ...context, atWar: true }), 'aggressive');
  const doctrine = getAIMilitaryDoctrineById(fdr.aiMilitaryDoctrineId);
  const peaceBudget = Math.ceil(ECONOMIC_AI_STRATEGY.military.maxUnits * doctrine.militaryBudget.maxUnitsMultiplier);
  const warBudget = Math.ceil(AGGRESSIVE_AI_STRATEGY.military.maxUnits * doctrine.militaryBudget.maxUnitsMultiplier);
  assert.ok(warBudget >= peaceBudget * 2);
  assert.equal(doctrine.strategicTolerance.tolerateWarWeariness, true);
});

for (const l of MODERN_ALTERNATIVE_LEADERS) {
  test(`${l.name}: editor edit/export/import, scenario identity and saved selection roundtrip`, () => {
    try {
      assert.equal(effectiveLeader({ version: 1 }, l.id).name, l.name);
      const config: LeaderConfiguration = { version: 1, leaders: { [l.id]: {
        aiPersonality: { economyBias: l.aiPersonality!.economyBias + 1 },
        impulsiveBully: l.impulsiveBully, opportunism: l.opportunism,
        diplomacyFlavor: { friendly: 'Our agreement stands.' },
      } } };
      const restoredConfig = deserializeConfiguration(serializeConfiguration(config));
      const edited = effectiveLeader(restoredConfig, l.id);
      assert.equal(edited.aiPersonality.economyBias, l.aiPersonality!.economyBias + 1);
      assert.equal(edited.impulsiveBully, l.impulsiveBully);
      assert.equal(edited.opportunism, l.opportunism);
      assert.equal(edited.diplomacyFlavor?.greeting, l.diplomacyFlavor?.greeting);
      const scenario: ScenarioData = {
        meta: { name: 'Modern leader roundtrip', version: 1 },
        map: { width: 1, height: 1, tileSize: 64, tiles: [{ q: 0, r: 0, type: 'plains' }] },
        nations: [{ id: l.nationId, name: l.nationId, color: '#123456', isHuman: true,
          startTerritoryCenter: { q: 0, r: 0 }, leaderId: l.id, leaderName: 'Scenario name' }],
        cities: [], units: [], leaderConfiguration: restoredConfig,
      };
      const restoredScenario: ScenarioData = JSON.parse(JSON.stringify(scenario));
      const parsed = ScenarioLoader.parse(restoredScenario);
      assert.equal(parsed.nations[0].leaderId, l.id);
      assert.deepEqual(restoredScenario.leaderConfiguration, restoredConfig);
      setLeaderConfiguration(restoredScenario.leaderConfiguration);
      setActiveLeaderSelections({ [l.nationId]: parsed.nations[0].leaderId! });
      setScenarioLeaderOverrides(parsed.nations);
      assert.equal(getLeaderByNationId(l.nationId)?.name, 'Scenario name');
      assert.equal(getLeaderByNationId(l.nationId)?.id, l.id);
      assert.equal(getLeaderByNationId(l.nationId)?.aiPersonality?.economyBias, edited.aiPersonality.economyBias);
      const saved = JSON.parse(JSON.stringify({
        version: SAVED_GAME_VERSION, savedAt: new Date(0).toISOString(), mapKey: 'test',
        humanNationId: l.nationId, activeNationIds: [l.nationId], leaderSelections: getActiveLeaderSelections(),
        leaderConfiguration: restoredConfig, turn: { currentRound: 1, currentTurnIndex: 0 },
        tiles: [], nations: [], cities: [], units: [], diplomacy: [], discovery: [], wonders: [],
      }));
      setActiveLeaderSelections(undefined);
      setScenarioLeaderOverrides([]);
      setLeaderConfiguration(undefined);
      const validated = SaveLoadService.validate(saved);
      assert.equal(validated.ok, true);
      if (!validated.ok) return;
      setActiveLeaderSelections(validated.state.leaderSelections);
      setLeaderConfiguration(validated.state.leaderConfiguration);
      const loaded = getLeaderByNationId(l.nationId)!;
      assert.equal(loaded.id, l.id);
      assert.equal(loaded.name, l.name);
      assert.equal(loaded.aiPersonality?.economyBias, edited.aiPersonality.economyBias);
      assert.equal(loaded.impulsiveBully, l.impulsiveBully);
      assert.equal(loaded.opportunism, l.opportunism);
    } finally {
      setActiveLeaderSelections(undefined); setScenarioLeaderOverrides([]); setLeaderConfiguration(undefined);
    }
  });
}

test('generated nation/editor catalogs expose the complete expanded rosters', () => {
  const manifest = JSON.parse(fs.readFileSync('public/assets/data/nations-manifest.json', 'utf8'));
  for (const nation of new Set(MODERN_ALTERNATIVE_LEADERS.map(l => l.nationId))) {
    const entry = manifest.nations.find((n: any) => n.nationId === nation);
    assert.deepEqual(entry.leaders.map((l: any) => l.leaderId), getLeadersByNationId(nation).map(l => l.id));
    assert.equal(entry.leaderId, getDefaultLeaderByNationId(nation)?.id);
  }
  const bundle = fs.readFileSync('public/editor/epoch-leader-editor.js', 'utf8');
  for (const l of MODERN_ALTERNATIVE_LEADERS) assert.ok(bundle.includes(l.id), l.id);
});

test('all local portrait PNGs decode and Audience/Gossip rooms are local WebP assets', async () => {
  for (const l of MODERN_ALTERNATIVE_LEADERS) {
    for (const [path, width, height, limit] of [
      [l.image, 416, 416, 400_000], [getLeaderRoomImagePath(l.image), 2048, 872, 400_000],
    ] as const) {
      const bytes = fs.readFileSync(`public${path}`);
      if (path.endsWith('.png')) {
        const img = await loadImage(bytes);
        assert.equal(img.width, width, path); assert.equal(img.height, height, path);
      } else {
        assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', path);
        assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', path);
        // Browser coverage below decodes WebP (node-canvas lacks WebP support).
      }
      assert.ok(bytes.length < limit, `${path}: ${bytes.length} bytes`);
      // Run once again with EPOCH_VERIFY_BUILD=1 after the production build.
      if (process.env.EPOCH_VERIFY_BUILD) assert.deepEqual(fs.readFileSync(`dist${path}`), bytes, path);
    }
  }
});
