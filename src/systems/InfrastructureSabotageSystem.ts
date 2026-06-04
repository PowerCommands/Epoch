import type { Unit } from '../entities/Unit';
import type { City } from '../entities/City';
import type { MapData, Tile } from '../types/map';
import type { CityManager } from './CityManager';
import type { WonderSystem } from './WonderSystem';
import type { NationManager } from './NationManager';
import { getBuildingById, isBarbarianCamp } from '../data/buildings';
import { getWonderById } from '../data/wonders';
import { getAllegianceType } from '../entities/UnitType';

export type DestroyActionKind = 'improvement' | 'building';

/** Loot granted to the destroying nation when an improvement is razed. */
export const IMPROVEMENT_DESTRUCTION_LOOT_GOLD = 10;

/** Loot granted to the destroying nation when a Barbarian Camp is razed. */
export const BARBARIAN_CAMP_DESTRUCTION_LOOT_GOLD = 25;

export type SabotageLogger = (event: { nationId: string; message: string }) => void;

/**
 * A breakable structure on a tile. `camp` is a neutral, ownerless tile
 * structure (Barbarian Camp) whose broken state lives on the tile rather than
 * in a city's CityBuildings.
 */
interface BreakableTarget {
  kind: 'building' | 'wonder' | 'camp';
  id: string;
}

/**
 * InfrastructureSabotageSystem — lets capable military units sabotage enemy
 * infrastructure on the tile they stand on.
 *
 * Single responsibility: validate and apply infrastructure sabotage. It does not
 * change combat, diplomacy, or unit category meanings. Capability is read from
 * `UnitType.canDestroyImprovement` / `canDestroyBuilding`; targeting/ownership
 * gating lives here.
 *
 * Behavior:
 * - Destroy Improvement removes the tile improvement entirely (rebuilt normally).
 * - Destroy Building does NOT remove the building/wonder — it marks it `broken`
 *   so it stays visible but provides no effects until a Worker/Work Boat repairs
 *   it. Cities and world wonders are never deleted.
 * - Consumes the unit's movement for the turn (same style as other actions).
 * - Logs a clear event but applies no diplomatic consequences (war is handled by
 *   the caller via {@link getActOfWarTarget}).
 */
export class InfrastructureSabotageSystem {
  constructor(
    private readonly mapData: MapData,
    private readonly cityManager: CityManager,
    private readonly wonderSystem: WonderSystem,
    private readonly nationManager: NationManager,
    private readonly log: SabotageLogger,
  ) {}

  /** True when `unit` may raze an enemy improvement on its current tile. */
  canDestroyImprovement(unit: Unit): boolean {
    if (unit.unitType.canDestroyImprovement !== true) return false;
    const tile = this.getUnitTile(unit);
    if (!tile || tile.improvementId === undefined) return false;
    return !this.isOwnedBy(tile, unit.ownerId);
  }

  /**
   * True when `unit` may damage an enemy building or world wonder on its current
   * tile (one that exists, is enemy-owned, and is not already broken).
   */
  canDestroyBuilding(unit: Unit): boolean {
    if (unit.unitType.canDestroyBuilding !== true) return false;
    const tile = this.getUnitTile(unit);
    if (!tile) return false;
    if (this.isOwnedBy(tile, unit.ownerId)) return false; // never your own infrastructure
    return this.getBreakableTarget(tile) !== null;
  }

  /**
   * Returns the nation that razing the {@link kind} on the unit's current tile
   * would be an act of war against, or undefined when it is NOT an act of war:
   * - the unit is a `hiddenNation` (deniable) unit,
   * - there is no valid destroy target on the tile,
   * - the infrastructure is unowned (neutral),
   * - or it belongs to the unit's own nation.
   *
   * This is the diplomacy decision point; war declaration itself stays in the
   * caller (GameScene) so this system keeps no diplomacy state.
   */
  getActOfWarTarget(unit: Unit, kind: DestroyActionKind): string | undefined {
    // hiddenNation units act deniably — destroying infrastructure never triggers war.
    if (getAllegianceType(unit.unitType) === 'hiddenNation') return undefined;
    const tile = this.getUnitTile(unit);
    if (!tile) return undefined;

    if (kind === 'improvement') {
      if (!this.canDestroyImprovement(unit)) return undefined;
      // Improvement ownership: territory owner, or the resource-only owner for
      // water improvements. canDestroyImprovement already guarantees it is not
      // the unit's own nation; an unowned improvement returns undefined (no war).
      return tile.resourceOwnerNationId ?? tile.ownerId;
    }

    if (!this.canDestroyBuilding(unit)) return undefined;
    return tile.ownerId;
  }

  /**
   * Remove the improvement from the unit's current tile and consume its turn.
   * Returns true on success.
   */
  destroyImprovement(unit: Unit): boolean {
    if (!this.canDestroyImprovement(unit)) return false;
    const tile = this.getUnitTile(unit)!;
    const improvementId = tile.improvementId!;

    tile.improvementId = undefined;
    this.consumeUnitTurn(unit);

    // Loot: the destroying nation gains gold, created from nothing (the previous
    // owner loses nothing). Granted only here, i.e. only when an improvement is
    // actually razed. Applies to any nation (human or AI).
    this.nationManager.getResources(unit.ownerId).gold += IMPROVEMENT_DESTRUCTION_LOOT_GOLD;

    this.log({
      nationId: unit.ownerId,
      message: `${unit.unitType.name} razed enemy improvement (${improvementId}) at (${tile.x}, ${tile.y}) for ${IMPROVEMENT_DESTRUCTION_LOOT_GOLD} gold${this.deniableSuffix(unit)}.`,
    });
    return true;
  }

  /**
   * Damage one building or world wonder on the unit's current tile, marking it
   * broken (it is NOT removed) and consuming the unit's turn. Buildings/wonders
   * are one-per-tile so the choice is deterministic: the structure on the tile
   * the unit stands on (a wonder takes precedence if both somehow coexist).
   * Returns true on success.
   */
  destroyBuilding(unit: Unit): boolean {
    if (!this.canDestroyBuilding(unit)) return false;
    const tile = this.getUnitTile(unit)!;
    const target = this.getBreakableTarget(tile)!;
    const owningCity = this.findCityOwningTile(tile);
    const location = owningCity ? ` in ${owningCity.name}` : '';

    let lootGold = 0;
    if (target.kind === 'wonder') {
      this.wonderSystem.setWonderBroken(target.id, true);
    } else if (target.kind === 'camp') {
      // Neutral, ownerless structure: razing a camp removes it from the map
      // entirely (it does NOT linger as a broken ruin), so its tile restrictions
      // disappear immediately. Grants loot (same model as improvement plundering)
      // to human and AI alike.
      tile.buildingId = undefined;
      tile.buildingBroken = undefined;
      lootGold = BARBARIAN_CAMP_DESTRUCTION_LOOT_GOLD;
      this.nationManager.getResources(unit.ownerId).gold += lootGold;
    } else if (owningCity) {
      this.cityManager.getBuildings(owningCity.id).setBroken(target.id, true);
    }
    this.consumeUnitTurn(unit);

    const name = target.kind === 'wonder'
      ? getWonderById(target.id)?.name ?? target.id
      : getBuildingById(target.id)?.name ?? target.id;
    const lootSuffix = lootGold > 0 ? ` for ${lootGold} gold` : '';
    // A camp is removed outright; buildings/wonders are left standing but broken.
    const outcome = target.kind === 'camp' ? 'razed and removed' : 'now broken';
    const verb = target.kind === 'camp' ? 'razed' : 'damaged';
    this.log({
      nationId: unit.ownerId,
      message: `${unit.unitType.name} ${verb} ${name}${location} at (${tile.x}, ${tile.y})${lootSuffix}. The ${target.kind} is ${outcome}${this.deniableSuffix(unit)}.`,
    });
    return true;
  }

  /**
   * Loot gold the unit's pending destroy-building action would grant right now
   * (25 for a Barbarian Camp, 0 otherwise). Lets the UI play the gold-reward
   * animation for human players without duplicating target detection.
   */
  getDestroyBuildingLootGold(unit: Unit): number {
    if (!this.canDestroyBuilding(unit)) return 0;
    const tile = this.getUnitTile(unit);
    if (!tile) return 0;
    const target = this.getBreakableTarget(tile);
    return target?.kind === 'camp' ? BARBARIAN_CAMP_DESTRUCTION_LOOT_GOLD : 0;
  }

  /**
   * The structure on `tile` that can be damaged right now: a not-already-broken
   * world wonder, or a not-already-broken building belonging to a city. Returns
   * null when there is nothing breakable. Wonders take precedence.
   */
  private getBreakableTarget(tile: Tile): BreakableTarget | null {
    if (tile.wonderId !== undefined && !this.wonderSystem.isWonderBroken(tile.wonderId)) {
      return { kind: 'wonder', id: tile.wonderId };
    }
    if (tile.buildingId !== undefined) {
      // Barbarian Camp: ownerless tile structure, broken state tracked on the tile.
      if (isBarbarianCamp(tile.buildingId)) {
        return tile.buildingBroken ? null : { kind: 'camp', id: tile.buildingId };
      }
      const owningCity = this.findCityOwningTile(tile);
      if (owningCity && !this.cityManager.getBuildings(owningCity.id).isBroken(tile.buildingId)) {
        return { kind: 'building', id: tile.buildingId };
      }
    }
    return null;
  }

  /** Notes hidden/deniable allegiance in the log for hiddenNation raiders. */
  private deniableSuffix(unit: Unit): string {
    return getAllegianceType(unit.unitType) === 'hiddenNation'
      ? ' while operating under hidden allegiance'
      : '';
  }

  private consumeUnitTurn(unit: Unit): void {
    unit.movementPoints = 0;
    unit.queuedDestination = undefined;
  }

  /**
   * Treats both territory ownership and resource-only ownership as "owned" so a
   * unit never razes its own nation's infrastructure. Tiles with no owner are
   * not owned by anyone, so razing them is allowed.
   */
  private isOwnedBy(tile: Tile, nationId: string): boolean {
    return tile.ownerId === nationId || tile.resourceOwnerNationId === nationId;
  }

  private findCityOwningTile(tile: Tile): City | undefined {
    return this.cityManager.getAllCities().find((city) =>
      city.ownedTileCoords.some((coord) => coord.x === tile.x && coord.y === tile.y),
    );
  }

  private getUnitTile(unit: Unit): Tile | undefined {
    return this.mapData.tiles[unit.tileY]?.[unit.tileX];
  }
}
