import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import cityNames from '../src/data/cityNames.json';
import {
  getDefaultLeaderByNationId,
  getLeaderByNationId,
  getLeaderCovertPersonalityByNationId,
  getLeadersByNationId,
  JOSEPH_STALIN,
  setActiveLeaderSelections,
  setScenarioLeaderOverrides,
} from '../src/data/leaders';
import { getNationDefinitionById } from '../src/data/nations';
import { NationManager } from '../src/systems/NationManager';
import { SaveLoadService } from '../src/systems/SaveLoadService';
import { ScenarioLoader } from '../src/systems/ScenarioLoader';
import type { MapData } from '../src/types/map';
import { SAVED_GAME_VERSION } from '../src/types/saveGame';
import type { ScenarioData, ScenarioNation } from '../src/types/scenario';
import { getLeaderRoomImagePath } from '../src/utils/assetPaths';

const SOVIET_ID = 'nation_soviet_union';

test.afterEach(() => {
  setActiveLeaderSelections(undefined);
  setScenarioLeaderOverrides([]);
});

test('Soviet Union is a distinct canonical nation and Russia remains unchanged', () => {
  assert.deepEqual(getNationDefinitionById(SOVIET_ID), {
    id: SOVIET_ID,
    name: 'Soviet Union',
    color: '#8b1a1a',
    secondaryColor: '#d4af37',
    currencyName: 'Soviet Ruble',
    currencySymbol: '₽',
    audioPlaylistNationId: 'nation_russia',
  });
  assert.deepEqual(getNationDefinitionById('nation_russia'), {
    id: 'nation_russia',
    name: 'Russia',
    color: '#ffffff',
    secondaryColor: '#0039a6',
    currencyName: 'Ruble',
    currencySymbol: '₽',
  });
});

test('Joseph Stalin is the Soviet Union default and never a Russian leader', () => {
  assert.equal(JOSEPH_STALIN.id, 'leader_joseph_stalin');
  assert.equal(JOSEPH_STALIN.nationId, SOVIET_ID);
  assert.equal(JOSEPH_STALIN.isDefault, true);
  assert.equal(JOSEPH_STALIN.title, 'General Secretary');
  assert.deepEqual(getLeadersByNationId(SOVIET_ID).map((leader) => leader.id), ['leader_joseph_stalin']);
  assert.equal(getDefaultLeaderByNationId(SOVIET_ID)?.id, 'leader_joseph_stalin');
  assert.equal(getLeaderByNationId(SOVIET_ID)?.id, 'leader_joseph_stalin');
  assert.equal(getDefaultLeaderByNationId('nation_russia')?.id, 'ivan-iv');
  assert.deepEqual(getLeadersByNationId('nation_russia').map((leader) => leader.id), ['ivan-iv']);
  assert.equal(getLeaderCovertPersonalityByNationId(SOVIET_ID), 'paranoid');
  assert.equal(getLeaderRoomImagePath(JOSEPH_STALIN.image), '/assets/sprites/leaders/joseph-stalin-room.webp');
});

test('Soviet city pool begins with Moscow and contains the requested WWII-era names', () => {
  const pool = cityNames[SOVIET_ID as keyof typeof cityNames];
  assert.equal(pool[0], 'Moscow');
  assert.ok(pool.length >= 15);
  for (const city of ['Leningrad', 'Stalingrad', 'Kiev', 'Minsk', 'Kharkov', 'Sevastopol', 'Sverdlovsk', 'Gorky']) {
    assert.ok(pool.includes(city), city);
  }
});

test('Stalin media and generated nation/music manifests use normal data-driven paths', () => {
  assert.equal(fs.existsSync('public/assets/sprites/leaders/joseph-stalin.png'), true);
  assert.equal(fs.existsSync('public/assets/sprites/leaders/joseph-stalin-room.webp'), true);

  const nations = JSON.parse(fs.readFileSync('public/assets/data/nations-manifest.json', 'utf8')) as {
    nations: Array<{ nationId: string; leaderId: string; leaders: Array<{ leaderId: string; isDefault: boolean }> }>;
  };
  const soviet = nations.nations.find((nation) => nation.nationId === SOVIET_ID);
  assert.equal(soviet?.leaderId, 'leader_joseph_stalin');
  assert.deepEqual(soviet?.leaders, [{
    leaderId: 'leader_joseph_stalin',
    leaderName: 'Joseph Stalin',
    leaderTitle: 'General Secretary',
    leaderImage: '/assets/sprites/leaders/joseph-stalin.png',
    isDefault: true,
  }]);

  const sounds = JSON.parse(fs.readFileSync('public/assets/sounds/manifest.json', 'utf8')) as {
    playlists: Record<string, string[]>;
  };
  assert.deepEqual(sounds.playlists[SOVIET_ID], sounds.playlists.nation_russia);
  assert.equal(fs.existsSync('public/assets/sounds/nation_soviet_union'), false);
});

function scenarioNation(isHuman: boolean): ScenarioNation {
  return {
    id: SOVIET_ID,
    name: 'Soviet Union',
    color: '#8b1a1a',
    secondaryColor: '#d4af37',
    isHuman,
    startTerritoryCenter: { q: 1, r: 1 },
  };
}

function scenarioWithSoviets(isHuman: boolean): ScenarioData {
  return {
    meta: { name: 'Soviet integration test', version: 1 },
    map: {
      width: 3,
      height: 3,
      tileSize: 32,
      tiles: Array.from({ length: 9 }, (_, index) => ({ q: index % 3, r: Math.floor(index / 3), type: 'plains' })),
    },
    nations: [scenarioNation(isHuman)],
    cities: [{ id: 'city_moscow', name: 'Moscow', nationId: SOVIET_ID, q: 1, r: 1, isCapital: true }],
    units: [],
    nationDetails: {},
    initialDiplomacy: [],
  };
}

test('scenario/runtime loading supports Soviet Union as either human or AI', () => {
  for (const isHuman of [true, false]) {
    const parsed = ScenarioLoader.parse(scenarioWithSoviets(isHuman));
    const grid = {
      getTilesInRange: (_center: unknown, _range: number, mapData: MapData) => mapData.tiles.flat(),
    };
    const manager = NationManager.loadFromScenario(parsed.nations, parsed.mapData, grid as never);
    const soviet = manager.getNation(SOVIET_ID);
    assert.equal(soviet?.isHuman, isHuman);
    assert.equal(soviet?.name, 'Soviet Union');
    assert.equal(soviet?.covertPersonalityId, 'paranoid');
    if (!isHuman) assert.ok(parsed.mapData.tiles.flat().some((tile) => tile.ownerId === SOVIET_ID));
  }
});

test('save validation preserves a Soviet game and older Russia-only saves still load', () => {
  const base = {
    version: SAVED_GAME_VERSION,
    savedAt: new Date(0).toISOString(),
    mapKey: 'test',
    humanNationId: SOVIET_ID,
    activeNationIds: [SOVIET_ID],
    turn: { currentRound: 1, currentTurnIndex: 0 },
    tiles: [], cities: [], units: [], diplomacy: [], discovery: [], wonders: [],
  };
  const sovietSave = SaveLoadService.validate({
    ...base,
    nations: [{
      id: SOVIET_ID,
      isHuman: true,
      researchedTechIds: [],
      researchProgress: 0,
      gold: 100,
      culture: 0,
    }],
  });
  assert.equal(sovietSave.ok, true);
  if (sovietSave.ok) assert.equal(sovietSave.state.nations[0]?.id, SOVIET_ID);

  const oldRussiaSave = SaveLoadService.validate({
    ...base,
    humanNationId: 'nation_russia',
    activeNationIds: ['nation_russia'],
    nations: [],
  });
  assert.equal(oldRussiaSave.ok, true);
});
