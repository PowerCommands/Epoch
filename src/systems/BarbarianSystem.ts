import type { MapData, Tile } from '../types/map';
import { TileType } from '../types/map';
import type { GridCoord } from '../types/grid';
import type { IGridSystem } from './grid/IGridSystem';
import type { UnitManager } from './UnitManager';
import type { CityManager } from './CityManager';
import type { NationManager } from './NationManager';
import type { TurnManager } from './TurnManager';
import type { MovementSystem } from './MovementSystem';
import type { PathfindingSystem } from './PathfindingSystem';
import type { CombatSystem } from './CombatSystem';
import type { InfrastructureSabotageSystem } from './InfrastructureSabotageSystem';
import type { Unit } from '../entities/Unit';
import { getUnitTypeById } from '../data/units';
import {
  BARBARIAN_NATION_ID,
  BARBARIAN_CAMP_BUILDING_ID,
  BARBARIAN_SPAWN_UNIT_ID,
  BARBARIAN_CONFIG,
  DEFAULT_BARBARIAN_SPAWN_INTERVAL,
  isBarbarianNation,
} from '../data/barbarians';

export type BarbarianLogger = (message: string) => void;

/** Passable land a camp can sit on / a barbarian can be spawned onto. */
const PASSABLE_LAND_TYPES: ReadonlySet<TileType> = new Set([
  TileType.Plains,
  TileType.Forest,
  TileType.Jungle,
  TileType.Desert,
  TileType.Beach,
  TileType.Meadow,
]);

/** How far a barbarian unit looks for a target each round. */
const BARBARIAN_ENGAGE_RADIUS = 6;

/** How far an AI unit will divert to clear a Barbarian Camp (moderate priority). */
const AI_CAMP_CLEAR_RADIUS = 8;

/**
 * BarbarianSystem — drives the neutral barbarian faction: it spawns units from
 * existing Barbarian Camps and runs simple barbarian unit behaviour. It does NOT
 * change combat, diplomacy, or building rules — camps are razed through the
 * existing InfrastructureSabotageSystem (broken-state), and barbarians are
 * permanently hostile via DiplomacyManager.canAttack.
 *
 * Camps are entirely scenario-driven: they exist ONLY where a scenario author
 * placed them in the Editor. The game never generates camps (no game-start,
 * round, save-load, or random-map placement). They live on the map as
 * `tile.buildingId === BARBARIAN_CAMP_BUILDING_ID`, with broken state on
 * `tile.buildingBroken`, so they persist through save/load for free.
 *
 * Barbarians are intentionally NOT a participant nation (see NationManager): they
 * take no turn in the normal order. Instead {@link runRound} is called once per
 * round from the scene's round hook.
 */
export class BarbarianSystem {
  constructor(
    private readonly mapData: MapData,
    private readonly gridSystem: IGridSystem,
    private readonly unitManager: UnitManager,
    private readonly cityManager: CityManager,
    private readonly nationManager: NationManager,
    private readonly turnManager: TurnManager,
    private readonly movementSystem: MovementSystem,
    private readonly pathfindingSystem: PathfindingSystem,
    private readonly combatSystem: CombatSystem,
    private readonly log: BarbarianLogger = () => {},
    /**
     * Rounds between spawns from each camp (scenario-authored). Already resolved
     * to a valid integer ≥ 1 by the caller; defaults to the standard interval.
     */
    private readonly spawnIntervalRounds: number = DEFAULT_BARBARIAN_SPAWN_INTERVAL,
  ) {}

  /** Active (non-broken) camp tiles currently on the map. */
  getActiveCampTiles(): Tile[] {
    const camps: Tile[] = [];
    for (const row of this.mapData.tiles) {
      for (const tile of row) {
        if (tile.buildingId === BARBARIAN_CAMP_BUILDING_ID && !tile.buildingBroken) {
          camps.push(tile);
        }
      }
    }
    return camps;
  }

  /**
   * Advance the barbarian faction one round: spawn from existing (scenario-placed)
   * camps on the spawn cadence, then move/attack existing barbarian units. Call
   * once per round.
   */
  runRound(): void {
    this.nationManager.ensureBarbarianNation();
    this.removeBrokenCamps();
    const round = this.turnManager.getCurrentRound();
    if (round > 0 && round % this.spawnIntervalRounds === 0) {
      this.spawnFromCamps();
    }
    this.actBarbarianUnits();
  }

  /**
   * Razing a camp removes it outright, so broken camps should never persist. This
   * sweep clears any that slipped through (e.g. older saves from when razing left
   * a broken ruin), making the camp — and its tile restrictions — disappear.
   */
  private removeBrokenCamps(): void {
    for (const row of this.mapData.tiles) {
      for (const tile of row) {
        if (tile.buildingId === BARBARIAN_CAMP_BUILDING_ID && tile.buildingBroken) {
          tile.buildingId = undefined;
          tile.buildingBroken = undefined;
        }
      }
    }
  }

  /**
   * Moderate-priority AI camp clearing for one nation: military units able to
   * destroy buildings will raze a camp they stand on, or divert toward a nearby
   * camp and raze it on arrival. Call at the nation's turn start, BEFORE the main
   * AI movement pass, so units still have movement points. Deliberately limited
   * (only canDestroyBuilding units, modest radius) so remote camps survive.
   */
  runAICampClearingForNation(nationId: string, sabotage: InfrastructureSabotageSystem): void {
    if (isBarbarianNation(nationId)) return;
    if (this.getActiveCampTiles().length === 0) return;

    for (const unit of this.unitManager.getUnitsByOwner(nationId)) {
      if (unit.unitType.canDestroyBuilding !== true) continue;
      if (unit.movementPoints <= 0) continue;

      if (sabotage.canDestroyBuilding(unit)) {
        sabotage.destroyBuilding(unit);
        continue;
      }

      const camp = this.findNearestActiveCamp(unit, AI_CAMP_CLEAR_RADIUS);
      if (!camp) continue;

      const path = this.pathfindingSystem.findPath(unit, camp.x, camp.y, { respectMovementPoints: false });
      if (path && path.length > 1) {
        this.movementSystem.moveAlongPath(unit, path);
      }
      if (sabotage.canDestroyBuilding(unit)) {
        sabotage.destroyBuilding(unit);
      }
    }
  }

  private findNearestActiveCamp(unit: Unit, radius: number): Tile | undefined {
    const from: GridCoord = { x: unit.tileX, y: unit.tileY };
    let best: Tile | undefined;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const camp of this.getActiveCampTiles()) {
      const dist = this.gridSystem.getDistance(from, { x: camp.x, y: camp.y });
      if (dist <= radius && dist < bestDist) {
        bestDist = dist;
        best = camp;
      }
    }
    return best;
  }

  // --- Camp spawning -------------------------------------------------------

  // Camps ONLY ever produce barbarian units (BARBARIAN_SPAWN_UNIT_ID) — never
  // buildings, wonders, or any other unit. They have no production queue; this
  // direct unit creation is the sole thing a camp ever makes.
  private spawnFromCamps(): void {
    const unitType = getUnitTypeById(BARBARIAN_SPAWN_UNIT_ID);
    if (!unitType) return;

    for (const camp of this.getActiveCampTiles()) {
      const nearby = this.countNearbyBarbarians(camp, BARBARIAN_CONFIG.nearbyRadius);
      if (nearby >= BARBARIAN_CONFIG.maxNearbyBarbarians) continue;

      const spot = this.findOpenAdjacentLand(camp);
      if (!spot) continue;

      this.unitManager.createUnit({
        type: unitType,
        ownerId: BARBARIAN_NATION_ID,
        tileX: spot.x,
        tileY: spot.y,
      });
      this.log(`Barbarian Camp at (${camp.x}, ${camp.y}) spawned a ${unitType.name} at (${spot.x}, ${spot.y}).`);
    }
  }

  // --- Barbarian unit behaviour -------------------------------------------

  private actBarbarianUnits(): void {
    const units = this.unitManager.getUnitsByOwner(BARBARIAN_NATION_ID);
    if (units.length === 0) return;

    this.unitManager.resetMovementForOwner(BARBARIAN_NATION_ID);

    // Barbarians move/attack outside the participant turn order, so the movement
    // system must treat them as the active mover for the duration.
    this.movementSystem.withActiveNation(BARBARIAN_NATION_ID, () => {
      for (const unit of units) {
        if (this.unitManager.getUnit(unit.id) === undefined) continue; // may have died mid-loop
        this.actSingleBarbarian(unit);
      }
    });
  }

  private actSingleBarbarian(unit: Unit): void {
    const target = this.findNearestHostileTarget(unit);
    if (!target) return; // no target in range: hold position near camp (deterministic)

    // Already adjacent → strike now.
    if (this.gridSystem.isAdjacent({ x: unit.tileX, y: unit.tileY }, target)) {
      this.combatSystem.tryAttack(unit, target.x, target.y, { allowOutOfTurn: true });
      return;
    }

    // Otherwise close the distance, then strike if we end adjacent.
    const path = this.pathfindingSystem.findPath(unit, target.x, target.y, { respectMovementPoints: false });
    if (path && path.length > 1) {
      this.movementSystem.moveAlongPath(unit, path);
    }
    if (unit.movementPoints > 0 && this.gridSystem.isAdjacent({ x: unit.tileX, y: unit.tileY }, target)) {
      this.combatSystem.tryAttack(unit, target.x, target.y, { allowOutOfTurn: true });
    }
  }

  /** Nearest non-barbarian unit or city within the engage radius. */
  private findNearestHostileTarget(unit: Unit): GridCoord | undefined {
    const from: GridCoord = { x: unit.tileX, y: unit.tileY };
    let best: GridCoord | undefined;
    let bestDist = Number.POSITIVE_INFINITY;

    for (const other of this.unitManager.getAllUnits()) {
      if (isBarbarianNation(other.ownerId)) continue;
      const dist = this.gridSystem.getDistance(from, { x: other.tileX, y: other.tileY });
      if (dist <= BARBARIAN_ENGAGE_RADIUS && dist < bestDist) {
        bestDist = dist;
        best = { x: other.tileX, y: other.tileY };
      }
    }
    for (const city of this.cityManager.getAllCities()) {
      if (isBarbarianNation(city.ownerId)) continue;
      const dist = this.gridSystem.getDistance(from, { x: city.tileX, y: city.tileY });
      if (dist <= BARBARIAN_ENGAGE_RADIUS && dist < bestDist) {
        bestDist = dist;
        best = { x: city.tileX, y: city.tileY };
      }
    }
    return best;
  }

  // --- Spawn helpers -------------------------------------------------------

  private findOpenAdjacentLand(camp: Tile): Tile | undefined {
    for (const neighbor of this.gridSystem.getNeighbors({ x: camp.x, y: camp.y }, this.mapData)) {
      if (!PASSABLE_LAND_TYPES.has(neighbor.type)) continue;
      if (this.unitManager.getUnitAt(neighbor.x, neighbor.y)) continue;
      if (this.cityManager.getCityAt(neighbor.x, neighbor.y)) continue;
      return neighbor;
    }
    return undefined;
  }

  private countNearbyBarbarians(camp: Tile, radius: number): number {
    let count = 0;
    for (const unit of this.unitManager.getUnitsByOwner(BARBARIAN_NATION_ID)) {
      if (this.gridSystem.getDistance({ x: camp.x, y: camp.y }, { x: unit.tileX, y: unit.tileY }) <= radius) {
        count += 1;
      }
    }
    return count;
  }
}
