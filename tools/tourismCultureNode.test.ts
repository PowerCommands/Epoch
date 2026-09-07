import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadImage } from 'canvas';

import { HOTEL } from '../src/data/buildings.ts';
import {
  CULTURE_TREE,
  TOURISM_CULTURE_NODE_ID,
  getCultureNodeById,
  getRequiredCultureNodeForBuilding,
  isCultureRequiredWithTechnologyForBuilding,
} from '../src/data/cultureTree.ts';
import { Nation } from '../src/entities/Nation.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { ResearchSystem } from '../src/systems/ResearchSystem.ts';
import { CultureSystem } from '../src/systems/culture/CultureSystem.ts';
import { NationHudDataProvider } from '../src/ui/hud/NationHudDataProvider.ts';
import { getCultureSpritePath } from '../src/utils/assetPaths.ts';

const NATION_ID = 'tourism_test_nation';

function makeProgressionHarness(isHuman: boolean) {
  const nationManager = new NationManager();
  const nation = new Nation({ id: NATION_ID, name: 'Tourism Test', color: 0x336699, isHuman });
  nationManager.addNation(nation);
  const cityManager = new CityManager();
  const culture = new CultureSystem(nationManager, () => 1);
  const research = new ResearchSystem(nationManager, cityManager, () => 1);
  research.setCultureBuildingUnlockResolver((nationId, buildingId) =>
    culture.isBuildingCultureUnlocked(nationId, buildingId));
  return { nation, nationManager, cityManager, culture, research };
}

test('Tourism is a Modern culture node between Urbanization and Professional Sports', () => {
  const urbanization = getCultureNodeById('urbanization');
  const tourism = getCultureNodeById(TOURISM_CULTURE_NODE_ID);
  const professionalSports = getCultureNodeById('professional_sports');
  assert.ok(urbanization);
  assert.ok(tourism);
  assert.ok(professionalSports);
  assert.equal(tourism.name, 'Tourism');
  assert.equal(tourism.era, 'modern');
  assert.deepEqual(tourism.prerequisites, ['urbanization']);
  assert.deepEqual(professionalSports.prerequisites, [TOURISM_CULTURE_NODE_ID]);
  assert.ok(urbanization.cost < tourism.cost);
  assert.ok(tourism.cost < professionalSports.cost);
  assert.deepEqual(getCultureNodeById('social_media')?.prerequisites, ['professional_sports', 'globalization']);
});

test('culture tree remains a valid dependency graph with the Tourism chain on consecutive layout levels', () => {
  const ids = new Set(CULTURE_TREE.map((node) => node.id));
  assert.equal(ids.size, CULTURE_TREE.length);
  for (const node of CULTURE_TREE) {
    for (const prerequisite of node.prerequisites ?? []) {
      assert.ok(ids.has(prerequisite), `${node.id} has missing prerequisite ${prerequisite}`);
    }
  }

  const levelCache = new Map<string, number>();
  const getLevel = (id: string): number => {
    const cached = levelCache.get(id);
    if (cached !== undefined) return cached;
    const node = getCultureNodeById(id);
    assert.ok(node);
    const level = node.prerequisites?.length
      ? Math.max(...node.prerequisites.map(getLevel)) + 1
      : 0;
    levelCache.set(id, level);
    return level;
  };
  assert.equal(getLevel(TOURISM_CULTURE_NODE_ID), getLevel('urbanization') + 1);
  assert.equal(getLevel('professional_sports'), getLevel(TOURISM_CULTURE_NODE_ID) + 1);
});

test('culture-tree HUD exposes Tourism artwork and connector prerequisites in progression order', () => {
  const { nation, nationManager, cityManager, culture, research } = makeProgressionHarness(true);
  nation.unlockedCultureNodeIds.push('urbanization');
  const provider = new NationHudDataProvider(
    nationManager,
    cityManager,
    {} as never,
    research,
    culture,
    {} as never,
  );
  const nodes = provider.getCultureTreeState(nation.id).nodes;
  const tourism = nodes.find((node) => node.id === TOURISM_CULTURE_NODE_ID);
  const professionalSports = nodes.find((node) => node.id === 'professional_sports');
  assert.deepEqual(tourism, {
    id: TOURISM_CULTURE_NODE_ID,
    name: 'Tourism',
    description: getCultureNodeById(TOURISM_CULTURE_NODE_ID)?.description,
    policyUnlockNames: [],
    policySlotUnlockLabels: [],
    imageKey: 'culture_tourism',
    prerequisites: ['urbanization'],
    status: 'available',
  });
  assert.deepEqual(professionalSports?.prerequisites, [TOURISM_CULTURE_NODE_ID]);
});

test('Tourism unlocks Hotel only alongside its existing Refrigeration requirement', () => {
  const { nation, research } = makeProgressionHarness(true);
  assert.equal(getRequiredCultureNodeForBuilding(HOTEL.id)?.id, TOURISM_CULTURE_NODE_ID);
  assert.equal(isCultureRequiredWithTechnologyForBuilding(HOTEL.id), true);
  assert.equal(research.getRequiredTechnologyForBuilding(HOTEL.id)?.id, 'refrigeration');

  assert.equal(research.isBuildingUnlocked(nation.id, HOTEL.id), false);
  nation.researchedTechIds.push('refrigeration');
  assert.equal(research.isBuildingUnlocked(nation.id, HOTEL.id), false);
  nation.unlockedCultureNodeIds.push(TOURISM_CULTURE_NODE_ID);
  assert.equal(research.isBuildingUnlocked(nation.id, HOTEL.id), true);

  nation.researchedTechIds = [];
  assert.equal(research.isBuildingUnlocked(nation.id, HOTEL.id), false);
});

test('AI nations can progress normally from Urbanization through Tourism to Professional Sports', () => {
  const { nation, culture } = makeProgressionHarness(false);
  nation.unlockedCultureNodeIds.push('urbanization');
  assert.equal(culture.canStartCultureNode(nation.id, TOURISM_CULTURE_NODE_ID), true);
  assert.equal(culture.canStartCultureNode(nation.id, 'professional_sports'), false);
  assert.equal(culture.startCultureNode(nation.id, TOURISM_CULTURE_NODE_ID), true);
  assert.equal(culture.completeCurrentCultureNode(nation.id)?.id, TOURISM_CULTURE_NODE_ID);
  assert.equal(culture.canStartCultureNode(nation.id, 'professional_sports'), true);
});

test('Tourism uses a loadable 256x256 PNG at the standard culture sprite path', async () => {
  assert.equal(getCultureSpritePath(TOURISM_CULTURE_NODE_ID), 'assets/sprites/cultures/tourism.png');
  const assetUrl = new URL('../public/assets/sprites/cultures/tourism.png', import.meta.url);
  const bytes = readFileSync(assetUrl);
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const image = await loadImage(fileURLToPath(assetUrl));
  assert.equal(image.width, 256);
  assert.equal(image.height, 256);
});
