import type { Unit } from '../entities/Unit';
import type { IGridSystem } from './grid/IGridSystem';
import type { UnitManager } from './UnitManager';
import type { PathfindingSystem } from './PathfindingSystem';
import type { MovementSystem } from './MovementSystem';
import type { CombatSystem } from './CombatSystem';
import type { CityManager } from './CityManager';
import { isMilitaryUnitType } from '../utils/unitRoleUtils';

/** How far an insurgent looks for enemies to hunt each turn. */
const INSURGENT_TARGET_SEARCH_RADIUS = 10;
/** Cap on pathfinding attempts when picking a reachable target / roam destination. */
const MAX_INSURGENT_PATHFINDING_CHECKS = 6;

/**
 * InsurgentBehaviorSystem — autonomous combat behavior for insurgent forces
 * (Rebels, Partisans). The human/AI owner decides where insurgents operate
 * (movement); these units decide for themselves how they fight.
 *
 * Each turn an insurgent: attacks an adjacent valid enemy, else hunts the nearest
 * reachable hostile military/naval/insurgent unit, else roams toward a foreign
 * city to seek contact. It reuses the existing combat, pathfinding and movement
 * systems — combat against/by insurgents needs no war (handled in CombatSystem
 * and MovementSystem for hidden-nation units), so no diplomacy changes occur.
 *
 * Insurgents are permanently hostile to all foreign nations and friendly only to
 * their owner and the owner's other insurgents. They never target cities,
 * buildings, improvements, civilians (workers/settlers) or covert Spy/Agent units.
 */
export class InsurgentBehaviorSystem {
  constructor(
    private readonly unitManager: UnitManager,
    private readonly cityManager: CityManager,
    private readonly gridSystem: IGridSystem,
    private readonly pathfindingSystem: PathfindingSystem,
    private readonly movementSystem: MovementSystem,
    private readonly combatSystem: CombatSystem,
  ) {}

  /** Run autonomous behavior for every insurgent owned by `nationId`. */
  runForNation(nationId: string): void {
    const insurgents = this.unitManager.getUnitsByOwner(nationId)
      .filter((unit) => unit.unitType.isInsurgentForce === true);
    for (const unit of insurgents) {
      // A unit may die from its own combat earlier in the loop.
      if (this.unitManager.getUnit(unit.id) === undefined) continue;
      this.runUnit(unit);
    }
  }

  /** One insurgent's autonomous turn. Safe to call after a manual relocation. */
  runUnit(unit: Unit): void {
    if (unit.unitType.isInsurgentForce !== true) return;
    if (unit.carriedByUnitId !== undefined) return;
    if (unit.movementPoints <= 0) return;

    // 1. Attack an adjacent hostile target.
    const adjacent = this.findAdjacentTarget(unit);
    if (adjacent) {
      this.combatSystem.tryAttack(unit, adjacent.tileX, adjacent.tileY, { source: 'system' });
      return;
    }

    // 2-4. Hunt the nearest reachable hostile military/naval/insurgent unit.
    if (this.huntNearestTarget(unit)) return;

    // 5-6. No target in range: roam toward foreign territory to seek contact.
    this.roamTowardForeignCity(unit);
  }

  private findAdjacentTarget(unit: Unit): Unit | null {
    for (const coord of this.gridSystem.getAdjacentCoords({ x: unit.tileX, y: unit.tileY })) {
      const target = this.unitManager.getUnitAt(coord.x, coord.y);
      if (target && this.isValidTarget(unit, target)) return target;
    }
    return null;
  }

  /**
   * Valid insurgent targets are foreign military/naval units and foreign
   * insurgents. Friendly (same-owner) units, civilians (workers/settlers),
   * leaders, and covert Spy/Agent units are never targeted. Land insurgents
   * cannot engage naval units (land melee vs. naval is disallowed in combat).
   */
  private isValidTarget(unit: Unit, target: Unit): boolean {
    if (target.ownerId === unit.ownerId) return false; // owner + own insurgents are friendly
    const category = target.unitType.category;
    if (category === 'civilian' || category === 'leader') return false;
    // Exclude covert Spy/Agent (covert, non-insurgent); foreign insurgents are valid.
    if (category === 'covert' && target.unitType.isInsurgentForce !== true) return false;
    if (!isMilitaryUnitType(target.unitType)) return false;
    if (unit.unitType.isNaval !== true && target.unitType.isNaval === true) return false;
    return true;
  }

  private huntNearestTarget(unit: Unit): boolean {
    const from = { x: unit.tileX, y: unit.tileY };
    const candidates = this.unitManager.getAllUnits()
      .filter((target) => this.isValidTarget(unit, target))
      .map((target) => ({ target, distance: this.gridSystem.getDistance(from, { x: target.tileX, y: target.tileY }) }))
      .filter((entry) => entry.distance <= INSURGENT_TARGET_SEARCH_RADIUS)
      .sort((a, b) => a.distance - b.distance || a.target.tileY - b.target.tileY || a.target.tileX - b.target.tileX);

    const limit = Math.min(candidates.length, MAX_INSURGENT_PATHFINDING_CHECKS);
    for (let index = 0; index < limit; index += 1) {
      const target = candidates[index].target;
      const approachTiles = this.gridSystem.getAdjacentCoords({ x: target.tileX, y: target.tileY });
      const path = this.pathfindingSystem.findBestPathToAnyTarget(unit, approachTiles, { respectMovementPoints: false });
      if (path === null) continue;

      const fromX = unit.tileX;
      const fromY = unit.tileY;
      this.movementSystem.moveAlongPath(unit, path, { source: 'system' });
      if (unit.tileX === fromX && unit.tileY === fromY) return true; // blocked, but a target was chosen

      // Arrived adjacent with movement to spare: strike now.
      if (
        this.unitManager.getUnit(target.id) !== undefined
        && unit.movementPoints > 0
        && this.gridSystem.isAdjacent({ x: unit.tileX, y: unit.tileY }, { x: target.tileX, y: target.tileY })
      ) {
        this.combatSystem.tryAttack(unit, target.tileX, target.tileY, { source: 'system' });
      }
      return true;
    }
    return false;
  }

  private roamTowardForeignCity(unit: Unit): boolean {
    const from = { x: unit.tileX, y: unit.tileY };
    const destinations = this.cityManager.getAllCities()
      .filter((city) => city.ownerId !== unit.ownerId)
      .map((city) => ({ city, distance: this.gridSystem.getDistance(from, { x: city.tileX, y: city.tileY }) }))
      .sort((a, b) => a.distance - b.distance || a.city.tileY - b.city.tileY || a.city.tileX - b.city.tileX)
      .slice(0, MAX_INSURGENT_PATHFINDING_CHECKS);

    for (const { city } of destinations) {
      const approachTiles = this.gridSystem.getAdjacentCoords({ x: city.tileX, y: city.tileY });
      const path = this.pathfindingSystem.findBestPathToAnyTarget(unit, approachTiles, { respectMovementPoints: false });
      if (path === null) continue;
      const fromX = unit.tileX;
      const fromY = unit.tileY;
      this.movementSystem.moveAlongPath(unit, path, { source: 'system' });
      if (unit.tileX !== fromX || unit.tileY !== fromY) return true;
    }
    return false;
  }
}
