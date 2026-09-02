import { Nation } from '../entities/Nation';
import { getNationDefinitionById } from '../data/nations';
import { getLeaderByNationId, getLeaderCovertPersonalityByNationId } from '../data/leaders';
import { getCovertPersonalityById } from '../data/covertPersonalities';
import type { CovertPersonality } from '../types/covertPersonality';
import {
  BARBARIAN_NATION_ID,
  BARBARIAN_NATION_NAME,
  BARBARIAN_NATION_COLOR,
  BARBARIAN_NATION_SECONDARY_COLOR,
  isBarbarianNation,
} from '../data/barbarians';
import { NationResources } from '../entities/NationResources';
import { MapData, TileType } from '../types/map';
import type { ScenarioNation } from '../types/scenario';
import type { IGridSystem } from './grid/IGridSystem';

const INITIAL_CLAIM_SIZE = 3;

/**
 * NationManager är "single source of truth" för all nationsdata.
 *
 * Ingen Phaser-koppling — kan användas i tester och på en framtida
 * server-sida utan ändringar.
 */
export class NationManager {
  private readonly nations = new Map<string, Nation>();
  private readonly resources = new Map<string, NationResources>();

  addNation(nation: Nation): void {
    this.nations.set(nation.id, nation);
    this.resources.set(nation.id, new NationResources(nation.id));
  }

  getNation(id: string): Nation | undefined {
    return this.nations.get(id);
  }

  /**
   * All participant nations. Deliberately EXCLUDES the synthetic barbarian
   * nation so it never appears as a turn-taker, diplomacy/economy/victory
   * participant, or selectable nation. Barbarian units still resolve their owner
   * via {@link getNation} for combat/rendering, and barbarians are driven
   * separately by BarbarianSystem.
   */
  getAllNations(): Nation[] {
    return Array.from(this.nations.values()).filter((nation) => !isBarbarianNation(nation.id));
  }

  /** All registered nations including the synthetic barbarian nation. */
  getAllNationsIncludingNeutral(): Nation[] {
    return Array.from(this.nations.values());
  }

  /**
   * Create and register the synthetic barbarian nation if it does not already
   * exist, returning it. Idempotent — safe to call on fresh start and on load.
   */
  ensureBarbarianNation(): Nation {
    const existing = this.nations.get(BARBARIAN_NATION_ID);
    if (existing) return existing;
    const nation = new Nation({
      id: BARBARIAN_NATION_ID,
      name: BARBARIAN_NATION_NAME,
      color: BARBARIAN_NATION_COLOR,
      secondaryColor: BARBARIAN_NATION_SECONDARY_COLOR,
      isHuman: false,
    });
    this.addNation(nation);
    return nation;
  }

  removeNation(nationId: string): void {
    this.nations.delete(nationId);
    this.resources.delete(nationId);
  }

  getResources(nationId: string): NationResources {
    return this.resources.get(nationId)!;
  }

  /**
   * Resolve a nation's covert personality (its runtime id → preset), falling
   * back to the neutral default for unknown/missing nations.
   */
  getCovertPersonality(nationId: string): CovertPersonality {
    return getCovertPersonalityById(this.nations.get(nationId)?.covertPersonalityId);
  }

  /** Return the id of the first human-controlled nation, or undefined. */
  getHumanNationId(): string | undefined {
    for (const nation of this.nations.values()) {
      if (nation.isHuman) return nation.id;
    }
    return undefined;
  }

  /** Räkna antalet tiles som ägs av en viss nation. */
  getTileCount(nationId: string, mapData: MapData): number {
    let count = 0;
    for (const row of mapData.tiles) {
      for (const tile of row) {
        if (tile.ownerId === nationId) count++;
      }
    }
    return count;
  }

  /**
   * Andel (0–100) av kartans totala landyta som ägs av en viss nation.
   * Land = allt utom hav, kust och is. Beräknas on-demand (en O(tiles)-svep,
   * samma kostnad som getTileCount) — anropas när Leader Details-vyn renderas,
   * inte varje turn, så ingen cache behövs.
   */
  getLandTilePercent(nationId: string, mapData: MapData): number {
    let ownedLand = 0;
    let totalLand = 0;
    for (const row of mapData.tiles) {
      for (const tile of row) {
        if (
          tile.type === TileType.Ocean ||
          tile.type === TileType.Coast ||
          tile.type === TileType.Ice
        ) {
          continue;
        }
        totalLand++;
        if (tile.ownerId === nationId) ownedLand++;
      }
    }
    if (totalLand === 0) return 0;
    return (ownedLand / totalLand) * 100;
  }

  /**
   * Skapa en NationManager med 6 historical nations on the Europe map.
   * Each nation gets an active-grid claimed territory centered on their capital.
   */
  static createDefault(mapData: MapData, gridSystem: IGridSystem): NationManager {
    const manager = new NationManager();

    const configs: {
      id: string;
      name: string;
      color: number;
      secondaryColor: number;
      cx: number;
      cy: number;
    }[] = [
      { id: 'nation_england', name: 'England',            color: 0xC8102E, secondaryColor: 0xF3C75F, cx: 22,  cy: 59 },
      { id: 'nation_france',  name: 'France',             color: 0x002395, secondaryColor: 0xF2F2ED, cx: 26,  cy: 66 },
      { id: 'nation_hre',     name: 'Holy Roman Empire',  color: 0xFFD700, secondaryColor: 0x3E3426, cx: 83,  cy: 68 },
      { id: 'nation_sweden',  name: 'Sweden',             color: 0x006AA7, secondaryColor: 0xF3D36B, cx: 86,  cy: 37 },
      { id: 'nation_ottoman', name: 'Ottoman Empire',     color: 0xE30A17, secondaryColor: 0xE8D9B5, cx: 112, cy: 88 },
      { id: 'nation_spain',   name: 'Spain',              color: 0xAA151B, secondaryColor: 0xF1C94B, cx: 15,  cy: 91 },
    ];

    for (const cfg of configs) {
      manager.addNation(new Nation({
        id: cfg.id,
        name: cfg.name,
        color: cfg.color,
        secondaryColor: cfg.secondaryColor,
        covertPersonalityId: getLeaderCovertPersonalityByNationId(cfg.id),
      }));
      NationManager.claimArea(mapData, cfg.id, cfg.cx, cfg.cy, INITIAL_CLAIM_SIZE, gridSystem);
    }

    return manager;
  }

  /**
   * Create a NationManager from scenario data.
   * AI nations get active-grid claimed territory centered on startTerritoryCenter.
   * Human nations wait until they found their first city so moving the starting settler
   * does not leave behind an initial territory claim.
   */
  static loadFromScenario(
    nations: ScenarioNation[],
    mapData: MapData,
    gridSystem: IGridSystem,
  ): NationManager {
    const manager = new NationManager();

    for (const cfg of nations) {
      const definition = getNationDefinitionById(cfg.id);
      const color = parseInt(cfg.color.replace('#', ''), 16);
      const secondaryColor = parseInt(
        (cfg.secondaryColor ?? definition?.secondaryColor ?? cfg.color).replace('#', ''),
        16,
      );
      const nation = new Nation({
        id: cfg.id,
        name: cfg.name,
        color,
        secondaryColor,
        isHuman: cfg.isHuman,
        aiStrategyId: cfg.aiStrategyId,
        aiStrategyStartedTurn: 0,
        aiNationalAgendaId: cfg.aiNationalAgendaId ?? getLeaderByNationId(cfg.id)?.aiNationalAgendaId,
        covertPersonalityId: cfg.covertPersonalityId ?? getLeaderCovertPersonalityByNationId(cfg.id),
        researchedTechIds: cfg.researchedTechIds,
        currentResearchTechId: cfg.currentResearchTechId,
        researchProgress: cfg.researchProgress,
        unlockedCultureNodeIds: cfg.unlockedCultureNodeIds,
        currentCultureNodeId: cfg.currentCultureNodeId,
        cultureProgress: cfg.cultureProgress,
      });
      manager.addNation(nation);
      // Seed the scenario-authored starting treasury. Loaded saves overwrite this
      // later from the saved gold, so it only takes effect on a fresh game start.
      const startingGold = typeof cfg.gold === 'number' && Number.isFinite(cfg.gold)
        ? Math.max(0, Math.floor(cfg.gold))
        : 0;
      if (startingGold > 0) manager.getResources(cfg.id).gold = startingGold;
      if (!cfg.isHuman) {
        if (!nation.aiGoals) {
          nation.aiGoals = [
            {
              id: 'initial-expand',
              type: 'expand',
              priority: 0.5,
              remainingTurns: 20,
            },
          ];
        }
        NationManager.claimArea(
          mapData,
          cfg.id,
          cfg.startTerritoryCenter.q,
          cfg.startTerritoryCenter.r,
          INITIAL_CLAIM_SIZE,
          gridSystem,
        );
      }
    }

    return manager;
  }

  /**
   * Tilldela en fyrkant av tiles till en nation.
   * Alla terrängtyper, inklusive Ocean och Coast, kan ägas.
   * Tiles already claimed by another nation are skipped.
   */
  private static claimArea(
    mapData: MapData,
    nationId: string,
    centerX: number,
    centerY: number,
    size: number,
    gridSystem: IGridSystem,
  ): void {
    const range = Math.floor(size / 2);
    const tiles = gridSystem.getTilesInRange(
      { x: centerX, y: centerY },
      range,
      mapData,
      { includeCenter: true },
    );

    for (const tile of tiles) {
      if (!tile.ownerId) {
        tile.ownerId = nationId;
      }
    }
  }
}
