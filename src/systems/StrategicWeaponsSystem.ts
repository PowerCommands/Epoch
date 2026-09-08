import { STRATEGIC_WEAPONS, NUCLEAR_SHELTER_DAMAGE_MULTIPLIER, type AreaWeaponDefinition } from '../data/strategicWeapons';
import type { Unit } from '../entities/Unit';
import { TileType, type MapData, type Tile } from '../types/map';
import type { UnitManager } from './UnitManager';
import type { CityManager } from './CityManager';
import type { IGridSystem } from './grid/IGridSystem';
import type { DiplomacyManager } from './DiplomacyManager';

export interface StrategicDetonation {
  nationId: string;
  weaponId: string;
  platform: string;
  target: { x: number; y: number };
  nuclear: boolean;
  victimNationIds: string[];
  tiles: number;
  unitsDestroyed: number;
  contaminatedTiles: number;
}
export function contaminateTile(tile: Tile): boolean {
  if ([TileType.Mountain, TileType.Coast, TileType.Ocean, TileType.NuclearWaste].includes(tile.type)) return false;
  tile.originalTerrain = tile.type;
  tile.type = TileType.NuclearWaste;
  return true;
}
export function cleanNuclearWaste(tile: Tile): boolean {
  if (tile.type !== TileType.NuclearWaste || tile.originalTerrain === undefined) return false;
  tile.type = tile.originalTerrain;
  tile.originalTerrain = undefined;
  tile.improvementId = undefined;
  tile.improvementOwnerId = undefined;
  return true;
}
/** Uses the same axial hex geometry as combat, workers and city territory. */
export function getBlastTiles(map: MapData, grid: IGridSystem, x: number, y: number, radius: number): Tile[] {
  return grid.getTilesInRange({ x, y }, radius, map, { includeCenter: true });
}

export class StrategicWeaponsSystem {
  private listeners: ((event: StrategicDetonation) => void)[] = [];
  constructor(private readonly units: UnitManager, private readonly cities: CityManager,
    private readonly map: MapData, private readonly grid: IGridSystem,
    private readonly diplomacy?: DiplomacyManager, private readonly getRound: () => number = () => 1) {}

  onDetonation(listener: (event: StrategicDetonation) => void): void { this.listeners.push(listener); }

  getLaunchFailure(weapon: Unit, x: number, y: number): string | undefined {
    const config = STRATEGIC_WEAPONS[weapon.unitType.id];
    if (!config) return 'Not strategic ordnance';
    if (this.units.getUnit(weapon.id) !== weapon || !weapon.isAlive()) return 'Weapon no longer exists';
    if (weapon.movementPoints <= 0) return 'Weapon has no actions remaining';
    const carrier = this.units.getTransportForUnit(weapon);
    if (weapon.carriedByUnitId) {
      if (!carrier?.isAlive() || carrier.ownerId !== weapon.ownerId || !carrier.cargoUnitIds.includes(weapon.id)
        || !config.carrierIds.includes(carrier.unitType.id)) return 'Invalid delivery platform';
      if (carrier.movementPoints <= 0) return 'Delivery platform has no actions remaining';
    } else {
      if (config.landLaunch === 'none') return 'Load this Atomic Bomb aboard a Bomber or Stealth Bomber';
      const tile = this.map.tiles[weapon.tileY]?.[weapon.tileX];
      if (!tile || [TileType.Coast, TileType.Ocean].includes(tile.type)) return 'Requires land or Nuclear Submarine cargo';
      if (config.landLaunch === 'silo') {
        const city = this.cities.getCityAt(weapon.tileX, weapon.tileY);
        if (!city || city.ownerId !== weapon.ownerId || !this.cities.getBuildings(city.id).hasActive('nuclear_silo')) {
          return 'Station this missile on an owned city with a working Nuclear Silo, or load a Nuclear Submarine';
        }
      }
    }
    const origin = carrier ?? weapon;
    const distance = this.grid.getDistance({ x: origin.tileX, y: origin.tileY }, { x, y });
    const range = weapon.unitType.id === 'atomic_bomb' ? carrier?.unitType.range ?? 0 : weapon.unitType.range ?? 0;
    if (!this.map.tiles[y]?.[x] || distance < 1 || distance > range) return `Target must be within launch range ${range}`;
    // Never silently drag neutral countries into war through collateral damage.
    const victims = this.getVictims(this.getTiles(config, x, y), weapon.ownerId);
    if (!victims.length) return 'Blast must affect an enemy nation';
    if (victims.some(id => this.diplomacy && !this.diplomacy.canAttack(weapon.ownerId, id))) return 'Blast would hit a nation you are not at war with';
    return undefined;
  }

  launch(weapon: Unit, x: number, y: number): boolean {
    if (this.getLaunchFailure(weapon, x, y)) return false;
    const config = STRATEGIC_WEAPONS[weapon.unitType.id];
    const tiles = this.getTiles(config, x, y);
    const carrier = this.units.getTransportForUnit(weapon);
    const event: StrategicDetonation = { nationId: weapon.ownerId, weaponId: weapon.unitType.id,
      platform: carrier?.unitType.id ?? (config.landLaunch === 'silo' ? 'nuclear_silo' : 'land'),
      target: { x, y }, nuclear: config.nuclear, victimNationIds: this.getVictims(tiles, weapon.ownerId),
      tiles: tiles.length, unitsDestroyed: 0, contaminatedTiles: 0 };
    if (carrier) this.units.consumeAllMovement(carrier.id);
    // Remove ordnance before damage: a carrier hit by its own blast must not cause double removal.
    this.units.removeUnit(weapon.id);
    this.applyAreaEffects(tiles, config, event);
    for (const listener of this.listeners) listener(event);
    return true;
  }

  private getTiles(config: AreaWeaponDefinition, x: number, y: number): Tile[] {
    return getBlastTiles(this.map, this.grid, x, y, config.radius);
  }
  private getVictims(tiles: Tile[], owner: string): string[] {
    const keys = new Set(tiles.map(t => `${t.x},${t.y}`));
    const owners = new Set(tiles.flatMap(t => [t.ownerId, t.improvementOwnerId, t.resourceOwnerNationId].filter((id): id is string => !!id)));
    for (const unit of this.units.getAllUnits()) if (keys.has(`${unit.tileX},${unit.tileY}`)) owners.add(unit.ownerId);
    for (const city of this.cities.getAllCities()) if (keys.has(`${city.tileX},${city.tileY}`)) owners.add(city.ownerId);
    owners.delete(owner);
    return [...owners].sort();
  }
  /** Generic deterministic area effects; all stacks and cargo are included, on land and at sea. */
  private applyAreaEffects(tiles: Tile[], config: AreaWeaponDefinition, event: StrategicDetonation): void {
    const keys = new Set(tiles.map(t => `${t.x},${t.y}`));
    const protection = new Map<string, number>();
    for (const city of this.cities.getAllCities()) {
      const key = `${city.tileX},${city.tileY}`;
      if (!keys.has(key)) continue;
      const buildings = this.cities.getBuildings(city.id);
      const modifier = config.nuclear && buildings.hasActive('bomb_shelter') ? NUCLEAR_SHELTER_DAMAGE_MULTIPLIER : 1;
      protection.set(key, modifier);
      city.lastTurnAttacked = this.getRound();
      city.health = Math.max(1, city.health - Math.round(config.cityDamage * modifier));
      city.population = Math.max(1, city.population - Math.floor(city.population * config.populationLoss * modifier));
      const candidates = buildings.getAll().filter(id => id !== 'bomb_shelter').sort();
      for (const id of candidates.slice(0, Math.floor(candidates.length * config.buildingDamageFraction * modifier))) buildings.setBroken(id, true);
      this.cities.notifyHealthChanged(city);
    }
    const casualties = new Set<string>();
    const unitsBeforeBlast = [...this.units.getAllUnits()];
    for (const unit of unitsBeforeBlast) {
      const key = `${unit.tileX},${unit.tileY}`;
      if (!keys.has(key) || !this.units.getUnit(unit.id)) continue;
      unit.health = Math.max(0, unit.health - Math.round(config.unitDamage * (protection.get(key) ?? 1)));
      if (!unit.isAlive()) casualties.add(unit.id);
      else this.units.notifyDamaged(unit);
    }
    // Destroyed platforms also destroy their cargo, including cargo that survived its direct blast damage.
    for (let size = -1; size !== casualties.size;) {
      size = casualties.size;
      for (const unit of unitsBeforeBlast) if (unit.carriedByUnitId && casualties.has(unit.carriedByUnitId)) casualties.add(unit.id);
    }
    event.unitsDestroyed = casualties.size;
    for (const unit of unitsBeforeBlast) if (casualties.has(unit.id)) {
      if (unit.ownerId !== event.nationId && (unit.unitType.baseStrength > 0 || (unit.unitType.rangedStrength ?? 0) > 0)) this.diplomacy?.recordWarUnitLoss(unit.ownerId, event.nationId);
      this.units.removeUnit(unit.id);
    }
    for (const tile of tiles) {
      if (config.destroysImprovements) {
        tile.improvementId = undefined;
        tile.improvementOwnerId = undefined;
        tile.resourceOwnerNationId = undefined;
        const worker = tile.improvementConstruction && this.units.getUnit(tile.improvementConstruction.unitId);
        if (worker) { worker.clearBuildAction(); this.units.notifyActionChanged(worker.id); }
        tile.improvementConstruction = undefined;
      }
      if (tile.buildingId) {
        const owningCity = this.cities.getAllCities().find(city => city.ownedTileCoords.some(coord => coord.x === tile.x && coord.y === tile.y));
        if (owningCity && this.cities.getBuildings(owningCity.id).has(tile.buildingId)) {
          const buildings = this.cities.getBuildings(owningCity.id);
          if (!keys.has(`${owningCity.tileX},${owningCity.tileY}`)) buildings.setBroken(tile.buildingId, true);
          tile.buildingBroken = buildings.isBroken(tile.buildingId);
        } else tile.buildingBroken = true;
      }
      if (config.createsWaste && contaminateTile(tile)) event.contaminatedTiles++;
    }
  }
}
