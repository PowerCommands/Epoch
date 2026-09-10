import type { Unit } from '../entities/Unit';
import type { City } from '../entities/City';
import { TileType, type MapData, type Tile } from '../types/map';
import type { CityManager } from './CityManager';
import type { WonderSystem } from './WonderSystem';
import type { NationManager } from './NationManager';
import { getBuildingById, isBarbarianCamp } from '../data/buildings';
import { getWonderById } from '../data/wonders';
import { getAllegianceType } from '../entities/UnitType';
import type { CovertSuspicionSystem } from './diplomacy/CovertSuspicionSystem';
import { getImprovementOwnerId } from './ImprovementOwnership';

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
 * InfrastructureSabotageSystem — military sabotage and free builder demolition
 * of infrastructure on the unit's current tile.
 *
 * Single responsibility: validate and apply infrastructure sabotage. It does not
 * change combat, diplomacy, or unit category meanings. Capability is read from
 * `UnitType.canDestroyImprovement` / `canDestroyBuilding`; targeting/ownership
 * gating lives here.
 *
 * Behavior:
 * - Workers / Work Boats remove their own buildings and improvements entirely,
 *   without loot, cost, movement or charge consumption. Wonders are protected.
 * The following rules apply to military/covert sabotage:
 * - Destroy Improvement removes the tile improvement entirely (rebuilt normally).
 * - Destroy Building does NOT remove the building/wonder — it marks it `broken`
 *   so it stays visible but provides no effects until a Worker/Work Boat repairs
 *   it. Cities and world wonders are never deleted.
 * - Consumes the unit's movement for the turn (same style as other actions).
 * - Logs a clear event but applies no diplomatic consequences (war is handled by
 *   the caller via {@link getActOfWarTarget}).
 */
export class InfrastructureSabotageSystem {
  // Optional: covert (hidden-nation) sabotage feeds the Suspicion system.
  // Injected after construction to avoid a constructor cycle.
  private covertSuspicionSystem: CovertSuspicionSystem | null = null;
  private onInfrastructureChanged: (nationIds: readonly string[]) => void = () => {};

  constructor(
    private readonly mapData: MapData,
    private readonly cityManager: CityManager,
    private readonly wonderSystem: WonderSystem,
    private readonly nationManager: NationManager,
    private readonly log: SabotageLogger,
  ) {}

  setCovertSuspicionSystem(system: CovertSuspicionSystem): void {
    this.covertSuspicionSystem = system;
  }

  setInfrastructureChangedHandler(handler: (nationIds: readonly string[]) => void): void {
    this.onInfrastructureChanged = handler;
  }

  /**
   * Report a destroy action as a covert incident when the actor is a hidden-nation
   * (deniable) unit against an owned target. Normal-unit sabotage is overt (an
   * act of war handled by the caller), so it creates no covert suspicion.
   */
  private reportCovertSabotage(unit: Unit, victimNationId: string | undefined, valuable: boolean): void {
    const covert = this.covertSuspicionSystem;
    if (!covert || !victimNationId) return;
    if (getAllegianceType(unit.unitType) !== 'hiddenNation') return;
    covert.reportIncident({
      attackerNationId: unit.ownerId,
      victimNationId,
      action: unit.unitType.id === 'privateer' ? 'privateerRaid' : 'agentSabotage',
      valuable,
    });
  }

  /** Builders clear own improvements; military/covert units raze foreign ones. */
  canDestroyImprovement(unit: Unit): boolean {
    if (unit.unitType.canBuildImprovements === true) {
      const tile = this.getBuilderDemolitionTile(unit);
      return tile !== undefined && tile.improvementId !== undefined
        && getImprovementOwnerId(tile) === unit.ownerId;
    }
    // Razing capability comes from a military demolisher (canDestroyImprovement)
    // OR a covert saboteur (canSabotageImprovements, e.g. Spy/Agent).
    if (unit.unitType.canDestroyImprovement !== true && unit.unitType.canSabotageImprovements !== true) return false;
    const tile = this.getUnitTile(unit);
    if (!tile || tile.improvementId === undefined) return false;
    return getImprovementOwnerId(tile) !== unit.ownerId;
  }

  /**
   * Builders remove own ordinary buildings, including ruins. Other capable
   * units may damage an unbroken foreign building or world wonder.
   */
  canDestroyBuilding(unit: Unit): boolean {
    if (unit.unitType.canBuildImprovements === true) {
      const tile = this.getBuilderDemolitionTile(unit);
      return tile !== undefined && tile.buildingId !== undefined
        && tile.ownerId === unit.ownerId
        && this.findCityOwningTile(tile)?.ownerId === unit.ownerId
        && !isBarbarianCamp(tile.buildingId);
    }
    // Military demolisher (canDestroyBuilding) OR covert saboteur (canSabotageBuildings, e.g. Agent).
    if (unit.unitType.canDestroyBuilding !== true && unit.unitType.canSabotageBuildings !== true) return false;
    const tile = this.getUnitTile(unit);
    if (!tile) return false;
    if (tile.ownerId === unit.ownerId) return false; // never your own territorial infrastructure
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
    // Builders can only dismantle their own infrastructure.
    if (unit.unitType.canBuildImprovements === true) return undefined;
    // hiddenNation units act deniably — destroying infrastructure never triggers war.
    if (getAllegianceType(unit.unitType) === 'hiddenNation') return undefined;
    const tile = this.getUnitTile(unit);
    if (!tile) return undefined;

    if (kind === 'improvement') {
      if (!this.canDestroyImprovement(unit)) return undefined;
      // Improvement ownership: territory owner, or the resource-only owner for
      // water improvements. canDestroyImprovement already guarantees it is not
      // the unit's own nation; an unowned improvement returns undefined (no war).
      return getImprovementOwnerId(tile);
    }

    if (!this.canDestroyBuilding(unit)) return undefined;
    return tile.ownerId;
  }

  /**
   * Remove the improvement; only military/covert sabotage consumes the turn.
   * Returns true on success.
   */
  destroyImprovement(unit: Unit): boolean {
    if (!this.canDestroyImprovement(unit)) return false;
    const tile = this.getUnitTile(unit)!;
    const improvementId = tile.improvementId!;
    const victimNationId = getImprovementOwnerId(tile);

    tile.improvementId = undefined;
    tile.improvementOwnerId = undefined;
    // Legacy sea claims are tied to their improvement and must not survive it.
    tile.resourceOwnerNationId = undefined;
    if (unit.unitType.canBuildImprovements === true) {
      this.logBuilderDemolition(unit, tile, improvementId);
      return true;
    }
    this.consumeUnitTurn(unit);

    // Loot: the destroying nation gains gold, created from nothing (the previous
    // owner loses nothing). Granted only here, i.e. only when an improvement is
    // actually razed. Applies to any nation (human or AI).
    this.nationManager.getResources(unit.ownerId).gold += IMPROVEMENT_DESTRUCTION_LOOT_GOLD;

    this.log({
      nationId: unit.ownerId,
      message: `${unit.unitType.name} razed enemy improvement (${improvementId}) at (${tile.x}, ${tile.y}) for ${IMPROVEMENT_DESTRUCTION_LOOT_GOLD} gold${this.deniableSuffix(unit)}.`,
    });
    this.reportCovertSabotage(unit, victimNationId, false);
    if (victimNationId) this.onInfrastructureChanged([victimNationId]);
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
    if (unit.unitType.canBuildImprovements === true) {
      const buildingId = tile.buildingId!;
      const city = this.findCityOwningTile(tile)!;
      // Repeatable structures live on individual tiles, not in CityBuildings.
      if (!getBuildingById(buildingId)?.repeatable) {
        this.cityManager.getBuildings(city.id).remove(buildingId);
      }
      tile.buildingId = undefined;
      tile.buildingBroken = undefined;
      this.logBuilderDemolition(unit, tile, getBuildingById(buildingId)?.name ?? buildingId);
      return true;
    }
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
      if (getBuildingById(target.id)?.repeatable) tile.buildingBroken = true;
      else this.cityManager.getBuildings(owningCity.id).setBroken(target.id, true);
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
    // Camps are neutral/ownerless → no covert victim. Damaging an owned
    // building/wonder is high-value sabotage when done by a deniable unit.
    if (target.kind !== 'camp') {
      this.reportCovertSabotage(unit, owningCity?.ownerId ?? tile.ownerId, true);
    }
    const affectedNationId = target.kind === 'wonder'
      ? this.wonderSystem.getCompletedWonder(target.id)?.ownerId
      : owningCity?.ownerId;
    if (affectedNationId) this.onInfrastructureChanged([affectedNationId]);
    return true;
  }

  /**
   * Loot gold the unit's pending destroy-building action would grant right now
   * (25 for a Barbarian Camp, 0 otherwise). Lets the UI play the gold-reward
   * animation for human players without duplicating target detection.
   */
  getDestroyBuildingLootGold(unit: Unit): number {
    if (unit.unitType.canBuildImprovements === true) return 0;
    if (!this.canDestroyBuilding(unit)) return 0;
    const tile = this.getUnitTile(unit);
    if (!tile) return 0;
    const target = this.getBreakableTarget(tile);
    return target?.kind === 'camp' ? BARBARIAN_CAMP_DESTRUCTION_LOOT_GOLD : 0;
  }

  getDestroyImprovementLootGold(unit: Unit): number {
    return unit.unitType.canBuildImprovements !== true && this.canDestroyImprovement(unit)
      ? IMPROVEMENT_DESTRUCTION_LOOT_GOLD : 0;
  }

  /** Free domestic demolition, restricted to the builder's land/water domain. */
  private getBuilderDemolitionTile(unit: Unit): Tile | undefined {
    if (!unit.isAlive() || unit.carriedByUnitId || unit.isBuildingImprovement()) return undefined;
    const tile = this.getUnitTile(unit);
    if (!tile || tile.wonderId !== undefined || tile.wonderConstruction !== undefined
      || tile.buildingConstruction !== undefined || tile.improvementConstruction !== undefined
      || this.cityManager.getCityAt(tile.x, tile.y)) return undefined;
    const water = tile.type === TileType.Coast || tile.type === TileType.Ocean;
    if (water !== (unit.unitType.isNaval === true)) return undefined;
    return tile;
  }

  private logBuilderDemolition(unit: Unit, tile: Tile, name: string): void {
    // No movement, Gold, charges or unit lifetime are consumed. The cleared
    // tile can immediately be used by the normal construction workflow.
    unit.queuedDestination = undefined;
    this.log({
      nationId: unit.ownerId,
      message: `${unit.unitType.name} demolished ${name} at (${tile.x}, ${tile.y}). No Gold, movement or build charges used.`,
    });
    this.onInfrastructureChanged([unit.ownerId]);
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
      if (owningCity && (getBuildingById(tile.buildingId)?.repeatable ? !tile.buildingBroken : !this.cityManager.getBuildings(owningCity.id).isBroken(tile.buildingId))) {
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

  private findCityOwningTile(tile: Tile): City | undefined {
    return this.cityManager.getAllCities().find((city) =>
      city.ownedTileCoords.some((coord) => coord.x === tile.x && coord.y === tile.y),
    );
  }

  private getUnitTile(unit: Unit): Tile | undefined {
    return this.mapData.tiles[unit.tileY]?.[unit.tileX];
  }
}
