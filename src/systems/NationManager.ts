import { Nation } from '../entities/Nation';
import { getNationDefinitionById } from '../data/nations';
import { NationResources } from '../entities/NationResources';
import { MapData } from '../types/map';
import { DEFAULT_AI_PROFILE } from '../types/ai';
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

  getAllNations(): Nation[] {
    return Array.from(this.nations.values());
  }

  getResources(nationId: string): NationResources {
    return this.resources.get(nationId)!;
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
      manager.addNation(new Nation({
        id: cfg.id,
        name: cfg.name,
        color,
        secondaryColor,
        isHuman: cfg.isHuman,
        aiProfile: cfg.isHuman ? undefined : DEFAULT_AI_PROFILE,
        researchedTechIds: cfg.researchedTechIds,
        currentResearchTechId: cfg.currentResearchTechId,
        researchProgress: cfg.researchProgress,
        unlockedPolicyIds: cfg.unlockedPolicyIds,
        currentPolicyId: cfg.currentPolicyId,
        policyProgress: cfg.policyProgress,
      }));
      if (!cfg.isHuman) {
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
