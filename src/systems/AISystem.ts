import type { Unit } from '../entities/Unit';
import type { City } from '../entities/City';
import type { UnitType } from '../entities/UnitType';
import type { MapData } from '../types/map';
import { TileType } from '../types/map';
import { ALL_UNIT_TYPES, WARRIOR, ARCHER, CAVALRY, SETTLER } from '../data/units';
import { GRANARY, WORKSHOP, MARKET } from '../data/buildings';
import { UnitManager } from './UnitManager';
import { CityManager } from './CityManager';
import { NationManager } from './NationManager';
import { TurnManager } from './TurnManager';
import { MovementSystem } from './MovementSystem';
import { CombatSystem } from './CombatSystem';
import { ProductionSystem } from './ProductionSystem';
import { FoundCitySystem } from './FoundCitySystem';

const MAX_MILITARY = 3;
const MAX_AI_CITIES = 3;
const SETTLER_MIN_CITY_DISTANCE = 5;
const MILITARY_OPTIONS = ALL_UNIT_TYPES.filter((unitType) => (
  unitType.baseStrength > 0 && !unitType.isNaval
));

const ADJACENT_OFFSETS = [
  { dx: 0, dy: -1 }, // N
  { dx: 1, dy: 0 },  // E
  { dx: 0, dy: 1 },  // S
  { dx: -1, dy: 0 }, // W
];

/**
 * AISystem kör grundläggande AI för icke-mänskliga nationer.
 *
 * Prioritetsordning per tur:
 * 0. Settlers — found cities or move toward founding sites
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
    combatSystem: CombatSystem,
    productionSystem: ProductionSystem,
    foundCitySystem: FoundCitySystem,
    mapData: MapData,
  ) {
    this.unitManager = unitManager;
    this.cityManager = cityManager;
    this.nationManager = nationManager;
    this.turnManager = turnManager;
    this.movementSystem = movementSystem;
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

      // Try founding at current position
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

    // Move one step toward target while settler has movement
    while (settler.movementPoints > 0) {
      const best = this.bestStepToward(settler, target.x, target.y);
      if (!best) break;
      this.unitManager.moveUnit(settler.id, best.x, best.y, 1);

      // Check if we arrived and can found
      if (settler.tileX === target.x && settler.tileY === target.y) {
        if (this.foundCitySystem.canFound(settler)) {
          this.foundCitySystem.foundCity(settler);
        }
        break;
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

        const settlerDist = Math.abs(x - settler.tileX) + Math.abs(y - settler.tileY);
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
      const d = Math.abs(city.tileX - tileX) + Math.abs(city.tileY - tileY);
      if (d < min) min = d;
    }
    return min;
  }

  // ─── Combat ──────────────────────────────────────────────────────────────────

  private runCombat(nationId: string): void {
    const units = this.unitManager.getUnitsByOwner(nationId);

    for (const unit of units) {
      if (unit.movementPoints <= 0) continue;
      if (unit.unitType.baseStrength <= 0) continue; // settlers can't attack
      if (this.unitManager.getUnit(unit.id) === undefined) continue;

      this.tryAttackInRange(unit);
    }
  }

  private tryAttackInRange(unit: Unit): boolean {
    const range = unit.unitType.range ?? 1;

    for (let dy = -range; dy <= range; dy++) {
      for (let dx = -range; dx <= range; dx++) {
        if (dx === 0 && dy === 0) continue;
        const tx = unit.tileX + dx;
        const ty = unit.tileY + dy;

        if (this.combatSystem.tryAttack(unit, tx, ty)) {
          return true;
        }
      }
    }
    return false;
  }

  // ─── Movement ────────────────────────────────────────────────────────────────

  private runMovement(nationId: string): void {
    const units = this.unitManager.getUnitsByOwner(nationId);

    for (const unit of units) {
      if (unit.movementPoints <= 0) continue;
      if (unit.unitType.isNaval) continue;
      if (unit.unitType.canFound) continue; // settlers handled in runSettlers
      if (this.unitManager.getUnit(unit.id) === undefined) continue;

      this.moveTowardNearestEnemyCity(unit, nationId);
    }
  }

  private moveTowardNearestEnemyCity(unit: Unit, nationId: string): void {
    const enemyCities = this.cityManager.getAllCities()
      .filter((c) => c.ownerId !== nationId);

    if (enemyCities.length === 0) return;

    let nearest: City | null = null;
    let nearestDist = Infinity;
    for (const city of enemyCities) {
      const dist = Math.abs(city.tileX - unit.tileX) + Math.abs(city.tileY - unit.tileY);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = city;
      }
    }

    if (nearest === null) return;

    const best = this.bestStepToward(unit, nearest.tileX, nearest.tileY);
    if (best) {
      this.unitManager.moveUnit(unit.id, best.x, best.y, 1);
    }
  }

  private bestStepToward(unit: Unit, targetX: number, targetY: number): { x: number; y: number } | null {
    const currentDist = Math.abs(targetX - unit.tileX) + Math.abs(targetY - unit.tileY);
    let bestTile: { x: number; y: number } | null = null;
    let bestDist = currentDist;

    for (const offset of ADJACENT_OFFSETS) {
      const tx = unit.tileX + offset.dx;
      const ty = unit.tileY + offset.dy;

      if (!this.isValidMoveTile(unit, tx, ty)) continue;

      const dist = Math.abs(targetX - tx) + Math.abs(targetY - ty);
      if (dist < bestDist) {
        bestDist = dist;
        bestTile = { x: tx, y: ty };
      }
    }

    return bestTile;
  }

  private isValidMoveTile(unit: Unit, tileX: number, tileY: number): boolean {
    const tile = this.mapData.tiles[tileY]?.[tileX];
    if (!tile) return false;
    if (tile.type === TileType.Ocean || tile.type === TileType.Coast) return false;

    const occupant = this.unitManager.getUnitAt(tileX, tileY);
    if (occupant !== undefined && occupant.id !== unit.id) return false;

    return true;
  }

  // ─── Production ──────────────────────────────────────────────────────────────

  private runProduction(nationId: string): void {
    const cities = this.cityManager.getCitiesByOwner(nationId);
    const militaryCount = this.countMilitary(nationId);
    const cityCount = cities.length;
    const hasSettler = this.unitManager.getUnitsByOwner(nationId)
      .some((u) => u.unitType.canFound);

    for (const city of cities) {
      if (this.productionSystem.getProduction(city.id)) continue;

      // Priority 1: defend city with military unit if needed and under cap
      if (this.needsDefender(city, nationId) && militaryCount < MAX_MILITARY) {
        this.productionSystem.setProduction(city.id, { kind: 'unit', unitType: WARRIOR });
        continue;
      }

      // Priority 2: settler if fewer than 3 cities, under military cap, no existing settler
      if (cityCount < MAX_AI_CITIES && militaryCount < MAX_MILITARY && !hasSettler) {
        this.productionSystem.setProduction(city.id, { kind: 'unit', unitType: SETTLER });
        continue;
      }

      // Priority 3: buildings
      if (this.tryQueueBuilding(city)) continue;

      // Priority 4: military unit if under cap — rotate types
      if (militaryCount < MAX_MILITARY) {
        const unitType = this.pickMilitaryUnit(nationId);
        this.productionSystem.setProduction(city.id, { kind: 'unit', unitType });
        continue;
      }

      // All buildings built and at military cap — queue nothing
    }
  }

  private countMilitary(nationId: string): number {
    return this.unitManager.getUnitsByOwner(nationId)
      .filter((u) => u.unitType.baseStrength > 0)
      .length;
  }

  private pickMilitaryUnit(nationId: string): UnitType {
    const units = this.unitManager.getUnitsByOwner(nationId)
      .filter((u) => u.unitType.baseStrength > 0 && !u.unitType.isNaval);

    const hasArcher = units.some((u) => u.unitType.id === 'archer');
    const hasCavalry = units.some((u) => u.unitType.id === 'cavalry');

    // Prioritize variety: warrior first (cheap), then archer, then cavalry
    if (!hasArcher) return MILITARY_OPTIONS.find((u) => u.id === ARCHER.id) ?? WARRIOR;
    if (!hasCavalry) return MILITARY_OPTIONS.find((u) => u.id === CAVALRY.id) ?? WARRIOR;
    return MILITARY_OPTIONS.find((u) => u.id === WARRIOR.id) ?? WARRIOR;
  }

  private needsDefender(city: City, nationId: string): boolean {
    const tilesToCheck = [
      { x: city.tileX, y: city.tileY },
      ...ADJACENT_OFFSETS.map((o) => ({ x: city.tileX + o.dx, y: city.tileY + o.dy })),
    ];

    for (const pos of tilesToCheck) {
      const unit = this.unitManager.getUnitAt(pos.x, pos.y);
      if (unit && unit.ownerId === nationId && unit.unitType.baseStrength > 0) return false;
    }

    return true;
  }

  private tryQueueBuilding(city: City): boolean {
    const buildings = this.cityManager.getBuildings(city.id);
    const candidates = [GRANARY, WORKSHOP, MARKET];

    for (const building of candidates) {
      if (!buildings.has(building.id)) {
        this.productionSystem.setProduction(city.id, { kind: 'building', buildingType: building });
        return true;
      }
    }

    return false;
  }
}
