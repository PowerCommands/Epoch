import type { Unit } from '../entities/Unit';
import type { City } from '../entities/City';
import type { UnitType } from '../entities/UnitType';
import type { MapData, Tile } from '../types/map';
import type { Producible } from '../types/producible';
import { TileType } from '../types/map';
import { ALL_UNIT_TYPES, WARRIOR, ARCHER } from '../data/units';
import { GRANARY, WORKSHOP, MARKET } from '../data/buildings';
import { UnitManager } from './UnitManager';
import { CityManager } from './CityManager';
import { NationManager } from './NationManager';
import { TurnManager } from './TurnManager';
import { getTileMovementCost, MovementSystem } from './MovementSystem';
import { CombatSystem } from './CombatSystem';
import { ProductionSystem } from './ProductionSystem';
import { FoundCitySystem } from './FoundCitySystem';
import { PathfindingSystem } from './PathfindingSystem';
import { calculateCityEconomy } from './CityEconomy';
import { AIBehaviorProfile, DEFAULT_AI_PROFILE } from '../types/ai';
import type { IGridSystem } from './grid/IGridSystem';
import type { PolicySystem } from './PolicySystem';
import type { ResearchSystem } from './ResearchSystem';

const MAX_MILITARY = 3;
const SETTLER_MIN_CITY_DISTANCE = 5;
const LOW_NET_FOOD_THRESHOLD = 1;
const LOW_PRODUCTION_THRESHOLD = 2;
const MILITARY_OPTIONS = ALL_UNIT_TYPES.filter((unitType) => (
  unitType.baseStrength > 0 && !unitType.isNaval
));

/**
 * AISystem kör grundläggande AI för icke-mänskliga nationer.
 *
 * Prioritetsordning per tur:
 * 0. Settlers — found the first city immediately, then expand toward spaced sites
 * 1. Strid — attackera angränsande fiender (skip 0-strength units)
 * 2. Rörelse — gå mot närmaste fiendestad
 * 3. Produktion — respektera 2-warrior cap, settler-villkor
 */
export class AISystem {
  private readonly unitManager: UnitManager;
  private readonly cityManager: CityManager;
  private readonly nationManager: NationManager;
  private readonly turnManager: TurnManager;
  private readonly movementSystem: MovementSystem;
  private readonly pathfindingSystem: PathfindingSystem;
  private readonly combatSystem: CombatSystem;
  private readonly productionSystem: ProductionSystem;
  private readonly foundCitySystem: FoundCitySystem;
  private readonly mapData: MapData;

  constructor(
    unitManager: UnitManager,
    cityManager: CityManager,
    nationManager: NationManager,
    turnManager: TurnManager,
    movementSystem: MovementSystem,
    pathfindingSystem: PathfindingSystem,
    combatSystem: CombatSystem,
    productionSystem: ProductionSystem,
    foundCitySystem: FoundCitySystem,
    mapData: MapData,
    private readonly gridSystem: IGridSystem,
    private readonly researchSystem?: ResearchSystem,
    private readonly policySystem?: PolicySystem,
  ) {
    this.unitManager = unitManager;
    this.cityManager = cityManager;
    this.nationManager = nationManager;
    this.turnManager = turnManager;
    this.movementSystem = movementSystem;
    this.pathfindingSystem = pathfindingSystem;
    this.combatSystem = combatSystem;
    this.productionSystem = productionSystem;
    this.foundCitySystem = foundCitySystem;
    this.mapData = mapData;
  }

  isHuman(nationId: string): boolean {
    const nation = this.nationManager.getNation(nationId);
    return nation?.isHuman ?? false;
  }

  runTurn(nationId: string): void {
    this.runSettlers(nationId);
    this.runCombat(nationId);
    this.runMovement(nationId);
    this.runProduction(nationId);
  }

  // ─── Settlers ────────────────────────────────────────────────────────────────

  private runSettlers(nationId: string): void {
    const settlers = this.unitManager.getUnitsByOwner(nationId)
      .filter((u) => u.unitType.canFound);

    for (const settler of settlers) {
      if (this.unitManager.getUnit(settler.id) === undefined) continue;

      const ownsNoCities = this.cityManager.getCitiesByOwner(nationId).length === 0;
      const isOpeningRound = this.turnManager.getCurrentRound() === 1;

      // Opening-round rule: every AI founds its capital immediately if possible.
      if (isOpeningRound && ownsNoCities && this.foundCitySystem.canFound(settler)) {
        this.foundCitySystem.foundCity(settler);
        continue; // settler consumed
      }

      // Later settlers respect spacing from all existing cities.
      if (this.foundCitySystem.canFound(settler)) {
        const allCities = this.cityManager.getAllCities();
        const minDist = this.minDistanceToCities(settler.tileX, settler.tileY, allCities);
        if (minDist >= SETTLER_MIN_CITY_DISTANCE) {
          this.foundCitySystem.foundCity(settler);
          continue; // settler consumed
        }
      }

      // Move toward valid founding site
      this.moveSettlerTowardSite(settler, nationId);
    }
  }

  private moveSettlerTowardSite(settler: Unit, nationId: string): void {
    const target = this.findFoundingSite(settler, nationId);
    if (!target) return;

    const path = this.pathfindingSystem.findPath(settler, target.x, target.y, {
      respectMovementPoints: false,
    });
    if (path === null) return;

    this.movementSystem.moveAlongPath(settler, path);

    if (settler.tileX === target.x && settler.tileY === target.y) {
      if (this.foundCitySystem.canFound(settler)) {
        this.foundCitySystem.foundCity(settler);
      }
    }
  }

  private findFoundingSite(settler: Unit, _nationId: string): { x: number; y: number } | null {
    const allCities = this.cityManager.getAllCities();

    let bestTile: { x: number; y: number } | null = null;
    let bestDist = Infinity;

    for (let y = 0; y < this.mapData.height; y++) {
      for (let x = 0; x < this.mapData.width; x++) {
        const tile = this.mapData.tiles[y][x];
        if (tile.type === TileType.Ocean || tile.type === TileType.Coast || tile.type === TileType.Ice) continue;
        if (this.cityManager.getCityAt(x, y) !== undefined) continue;

        const cityDist = this.minDistanceToCities(x, y, allCities);
        if (cityDist < SETTLER_MIN_CITY_DISTANCE) continue;

        const settlerDist = this.gridSystem.getDistance(
          { x: settler.tileX, y: settler.tileY },
          { x, y },
        );
        if (settlerDist < bestDist) {
          bestDist = settlerDist;
          bestTile = { x, y };
        }
      }
    }

    return bestTile;
  }

  private minDistanceToCities(tileX: number, tileY: number, cities: City[]): number {
    if (cities.length === 0) return Infinity;
    let min = Infinity;
    for (const city of cities) {
      const d = this.gridSystem.getDistance(
        { x: city.tileX, y: city.tileY },
        { x: tileX, y: tileY },
      );
      if (d < min) min = d;
    }
    return min;
  }

  // ─── Combat ──────────────────────────────────────────────────────────────────

  private runCombat(nationId: string): void {
    const units = this.unitManager.getUnitsByOwner(nationId);
    const profile = this.getProfile(nationId);

    for (const unit of units) {
      if (unit.movementPoints <= 0) continue;
      if (unit.unitType.baseStrength <= 0) continue; // settlers can't attack
      if (!this.canTakeAggressiveAction(unit, profile)) continue;
      if (this.unitManager.getUnit(unit.id) === undefined) continue;

      this.tryAttackInRange(unit);
    }
  }

  private tryAttackInRange(unit: Unit): boolean {
    const range = unit.unitType.range ?? 1;

    const tiles = this.gridSystem.getTilesInRange(
      { x: unit.tileX, y: unit.tileY },
      range,
      this.mapData,
      { includeCenter: false },
    );

    for (const tile of tiles) {
      if (this.combatSystem.tryAttack(unit, tile.x, tile.y)) {
        return true;
      }
    }
    return false;
  }

  // ─── Movement ────────────────────────────────────────────────────────────────

  private runMovement(nationId: string): void {
    const units = this.unitManager.getUnitsByOwner(nationId);
    const profile = this.getProfile(nationId);

    for (const unit of units) {
      if (unit.movementPoints <= 0) continue;
      if (unit.unitType.isNaval) continue;
      if (unit.unitType.canFound) continue; // settlers handled in runSettlers
      if (!this.canTakeAggressiveAction(unit, profile)) continue;
      if (this.unitManager.getUnit(unit.id) === undefined) continue;

      this.moveTowardNearestEnemyCity(unit, nationId, profile);
    }
  }

  private moveTowardNearestEnemyCity(
    unit: Unit,
    nationId: string,
    profile: AIBehaviorProfile,
  ): void {
    const target = this.pickEnemyCityTarget(unit, nationId, profile);
    if (target === null) return;

    this.movementSystem.moveAlongPath(unit, target.path);
  }

  private pickEnemyCityTarget(
    unit: Unit,
    nationId: string,
    profile: AIBehaviorProfile,
  ): { city: City; path: Tile[]; cost: number; distance: number } | null {
    const targets = this.cityManager.getAllCities()
      .filter((city) => city.ownerId !== nationId)
      .map((city) => {
        const path = this.findBestApproachPath(unit, city);
        return {
          city,
          path,
          cost: path === null ? Infinity : this.getPathCost(path),
          distance: this.gridSystem.getDistance(
            { x: city.tileX, y: city.tileY },
            { x: unit.tileX, y: unit.tileY },
          ),
        };
      });

    const sameContinentTargets = targets.filter((target) => target.path !== null);
    const availableTargets =
      profile.preferSameContinent && sameContinentTargets.length > 0
        ? sameContinentTargets
        : targets;

    const engagedTargets = availableTargets.filter((target) => (
      target.distance <= profile.engageDistance
    ));
    const candidates = engagedTargets.length > 0 ? engagedTargets : availableTargets;
    if (candidates.length === 0) return null;

    candidates.sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      if (a.cost !== b.cost) return a.cost - b.cost;
      if (a.city.tileY !== b.city.tileY) return a.city.tileY - b.city.tileY;
      return a.city.tileX - b.city.tileX;
    });

    if (candidates.length > 1 && Math.random() < profile.randomnessFactor) {
      const alternateIndex = 1 + Math.floor(Math.random() * (candidates.length - 1));
      const target = candidates[alternateIndex];
      return target.path === null ? null : { ...target, path: target.path };
    }

    const target = candidates[0];
    return target.path === null ? null : { ...target, path: target.path };
  }

  private findBestApproachPath(unit: Unit, city: City): Tile[] | null {
    const targets = this.gridSystem.getAdjacentCoords({ x: city.tileX, y: city.tileY });
    return this.pathfindingSystem.findBestPathToAnyTarget(unit, targets, {
      respectMovementPoints: false,
    });
  }

  private getPathCost(path: Tile[]): number {
    let cost = 0;
    for (let i = 1; i < path.length; i++) {
      cost += getTileMovementCost(path[i]);
    }
    return cost;
  }

  private getProfile(nationId: string): AIBehaviorProfile {
    return this.nationManager.getNation(nationId)?.aiProfile ?? DEFAULT_AI_PROFILE;
  }

  private canTakeAggressiveAction(unit: Unit, profile: AIBehaviorProfile): boolean {
    const healthRatio = unit.health / unit.unitType.baseHealth;
    if (healthRatio < profile.minAttackHealthRatio) return false;
    if (this.hasFriendlySupport(unit, profile.groupingDistance)) return true;
    return healthRatio >= Math.min(1, profile.minAttackHealthRatio + 0.15);
  }

  private hasFriendlySupport(unit: Unit, distance: number): boolean {
    return this.unitManager.getUnitsByOwner(unit.ownerId)
      .some((other) => {
        if (other.id === unit.id) return false;
        if (other.unitType.baseStrength <= 0) return false;
        if (other.unitType.isNaval) return false;
        const dist = this.gridSystem.getDistance(
          { x: other.tileX, y: other.tileY },
          { x: unit.tileX, y: unit.tileY },
        );
        return dist <= distance;
      });
  }

  // ─── Production ──────────────────────────────────────────────────────────────

  private runProduction(nationId: string): void {
    const cities = this.cityManager.getCitiesByOwner(nationId);
    let plannedMilitaryCount = this.countMilitary(nationId);

    for (const city of cities) {
      if (this.productionSystem.getProduction(city.id)) continue;

      const choice = this.chooseCityProduction(city, nationId, plannedMilitaryCount);
      if (!choice) continue;

      this.productionSystem.setProduction(city.id, choice);
      if (choice.kind === 'unit' && choice.unitType.baseStrength > 0) {
        plannedMilitaryCount++;
      }
    }
  }

  private countMilitary(nationId: string): number {
    return this.unitManager.getUnitsByOwner(nationId)
      .filter((u) => u.unitType.baseStrength > 0)
      .length;
  }

  private chooseCityProduction(
    city: City,
    nationId: string,
    plannedMilitaryCount: number,
  ): Producible | undefined {
    const buildings = this.cityManager.getBuildings(city.id);
    const economy = calculateCityEconomy(
      city,
      this.mapData,
      buildings,
      this.gridSystem,
      this.policySystem?.getCombinedModifiers(nationId),
    );
    const canBuildMilitary = plannedMilitaryCount < MAX_MILITARY;

    if (canBuildMilitary && this.needsDefender(city, nationId)) {
      return { kind: 'unit', unitType: this.pickMilitaryUnitForCity(city, nationId) };
    }

    if (
      economy.netFood <= LOW_NET_FOOD_THRESHOLD &&
      !buildings.has(GRANARY.id) &&
      this.canBuildBuilding(nationId, GRANARY.id)
    ) {
      return { kind: 'building', buildingType: GRANARY };
    }

    if (
      economy.production <= LOW_PRODUCTION_THRESHOLD &&
      !buildings.has(WORKSHOP.id) &&
      this.canBuildBuilding(nationId, WORKSHOP.id)
    ) {
      return { kind: 'building', buildingType: WORKSHOP };
    }

    if (!buildings.has(MARKET.id) && this.canBuildBuilding(nationId, MARKET.id)) {
      return { kind: 'building', buildingType: MARKET };
    }

    if (canBuildMilitary) {
      return { kind: 'unit', unitType: this.pickMilitaryUnitForCity(city, nationId) };
    }

    return undefined;
  }

  private pickMilitaryUnitForCity(city: City, nationId: string): UnitType {
    const available = MILITARY_OPTIONS.filter((u) => this.canBuildUnit(nationId, u.id));
    const archer = available.find((u) => u.id === ARCHER.id);
    if (archer && !this.hasFriendlyRangedUnitNearby(city, nationId)) return archer;
    return available.find((u) => u.id === WARRIOR.id) ?? WARRIOR;
  }

  private canBuildUnit(nationId: string, unitId: string): boolean {
    return this.researchSystem?.isUnitUnlocked(nationId, unitId) ?? true;
  }

  private canBuildBuilding(nationId: string, buildingId: string): boolean {
    return this.researchSystem?.isBuildingUnlocked(nationId, buildingId) ?? true;
  }

  private needsDefender(city: City, nationId: string): boolean {
    const tilesToCheck = [
      { x: city.tileX, y: city.tileY },
      ...this.gridSystem.getAdjacentCoords({ x: city.tileX, y: city.tileY }),
    ];

    for (const pos of tilesToCheck) {
      const unit = this.unitManager.getUnitAt(pos.x, pos.y);
      if (unit && unit.ownerId === nationId && unit.unitType.baseStrength > 0) return false;
    }

    return true;
  }

  private hasFriendlyRangedUnitNearby(city: City, nationId: string): boolean {
    const tilesToCheck = [
      { x: city.tileX, y: city.tileY },
      ...this.gridSystem.getAdjacentCoords({ x: city.tileX, y: city.tileY }),
    ];

    for (const pos of tilesToCheck) {
      const unit = this.unitManager.getUnitAt(pos.x, pos.y);
      if (
        unit &&
        unit.ownerId === nationId &&
        unit.unitType.baseStrength > 0 &&
        !unit.unitType.isNaval &&
        (unit.unitType.range ?? 1) > 1
      ) {
        return true;
      }
    }

    return false;
  }
}
