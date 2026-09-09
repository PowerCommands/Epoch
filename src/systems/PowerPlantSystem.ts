import { nuclearPlantAtRisk, nuclearPlantRoll, NUCLEAR_PLANT_MELTDOWN_CHANCE } from '../data/nuclearPlants';
import { TileType, type Tile } from '../types/map';
import { getBuildingById } from '../data/buildings';
import { getNaturalResourceById } from '../data/naturalResources';
import { getCityRenewableCapacity } from './RenewableBuildingEffects';
import { EMPTY_ENVIRONMENT, FOSSIL_PLANT_HAPPINESS, NUCLEAR_WASTE_HAPPINESS_PENALTY, type EnvironmentalHappiness } from '../data/environment';
import { BASE_CITY_POPULATION_CAPACITY } from '../data/populationCapacity';
import {
  POWER_PLANTS,
  getPowerPlantMetadata,
  isPowerPlantBuilding,
  type PowerPlantMetadata,
} from '../data/powerPlants';
import type { MapData } from '../types/map';
import type { CityManager } from './CityManager';
import type { ResourceAccessSystem } from './ResourceAccessSystem';

export type PowerPlantInactiveReason = 'missing_resource' | 'broken';
/** @deprecated Prefer BASE_CITY_POPULATION_CAPACITY from populationCapacity. */
export const UNPOWERED_POPULATION_CAPACITY = BASE_CITY_POPULATION_CAPACITY;

export interface CityPowerPlantState {
  readonly cityId: string;
  readonly buildingId: string;
  readonly requiredResourceId: PowerPlantMetadata['requiredResourceId'];
  readonly age: number;
  readonly lifespan: number;
  readonly remainingLifespan: number;
  readonly active: boolean;
  readonly inactiveReason?: PowerPlantInactiveReason;
}

export type PowerPlantEvent =
  | { readonly kind: 'maintained'; readonly cityId: string; readonly nationId: string; readonly buildingId: string }
  | { readonly kind: 'constructed'; readonly cityId: string; readonly nationId: string; readonly buildingId: string }
  | { readonly kind: 'replaced'; readonly cityId: string; readonly nationId: string; readonly buildingId: string; readonly previousBuildingId: string; readonly removedTileCoords: ReadonlyArray<{ x: number; y: number }> }
  | { readonly kind: 'becameInactive'; readonly cityId: string; readonly nationId: string; readonly buildingId: string; readonly reason: PowerPlantInactiveReason }
  | { readonly kind: 'becameActive'; readonly cityId: string; readonly nationId: string; readonly buildingId: string }
  | { readonly kind: 'expired'; readonly cityId: string; readonly nationId: string; readonly buildingId: string; readonly removedTileCoords: ReadonlyArray<{ x: number; y: number }> };

interface StoredPowerPlantState {
  buildingId: string;
  age: number;
}

interface AllocationState {
  active: boolean;
  inactiveReason?: PowerPlantInactiveReason;
}

export interface SavedPowerPlantCityState {
  readonly id: string;
  readonly powerPlantAge?: number;
}

type PowerPlantLog = (nationId: string, message: string) => void;
type PowerPlantListener = (event: PowerPlantEvent) => void;

/**
 * Owns the deliberately narrow power-plant runtime layer: one plant per city,
 * deterministic 1:1 resource allocation, age, expiration, and replacement.
 * Population and production effects consume this system's query API later.
 */
export class PowerPlantSystem {
  private readonly states = new Map<string, StoredPowerPlantState>();
  private readonly lastAllocation = new Map<string, AllocationState>();
  private readonly listeners: PowerPlantListener[] = [];
  private lastAgedRound: number;
  private meltdownEffect?: (nationId: string, x: number, y: number) => void;

  setMeltdownEffect(effect: (nationId: string, x: number, y: number) => void): void {
    this.meltdownEffect = effect;
  }

  getNuclearPlantTile(cityId: string): Tile | undefined {
    const city = this.cityManager.getCity(cityId);
    this.synchronizeCity(cityId);
    if (!city || this.states.get(cityId)?.buildingId !== 'nuclear_plant') return undefined;
    return city.ownedTileCoords.map(c => this.mapData.tiles[c.y]?.[c.x])
      .find(tile => tile?.buildingId === 'nuclear_plant')
      ?? this.mapData.tiles[city.tileY]?.[city.tileX];
  }

  getNuclearPlantAt(tile: Tile, nationId: string): CityPowerPlantState | undefined {
    for (const city of this.cityManager.getCitiesByOwner(nationId)) {
      const target = this.getNuclearPlantTile(city.id);
      if (target?.x === tile.x && target.y === tile.y) return this.getCityPowerPlant(city.id);
    }
    return undefined;
  }

  logMaintenanceStarted(cityId: string): void {
    const city = this.cityManager.getCity(cityId);
    if (city) this.log(city.ownerId, `[NuclearPlant] Worker started maintenance at ${city.name}`);
  }

  maintainNuclearPlant(cityId: string): boolean {
    this.synchronizeCity(cityId);
    const state = this.states.get(cityId);
    const city = this.cityManager.getCity(cityId);
    if (!city || state?.buildingId !== 'nuclear_plant') return false;
    state.age = 0;
    this.emit({ kind: 'maintained', cityId, nationId: city.ownerId, buildingId: state.buildingId });
    this.log(city.ownerId, `[NuclearPlant] Maintenance completed at ${city.name} — lifecycle reset to 0`);
    return true;
  }

  constructor(
    private readonly cityManager: CityManager,
    private readonly resourceAccessSystem: ResourceAccessSystem,
    private readonly mapData: MapData,
    currentRound = 1,
    private readonly log: PowerPlantLog = () => {},
  ) {
    this.lastAgedRound = currentRound;
    this.synchronizeAllCities();
    this.refreshAllocation(false);
  }

  onChanged(listener: PowerPlantListener): void {
    this.listeners.push(listener);
  }

  isPowerPlant(buildingId: string): boolean {
    return isPowerPlantBuilding(buildingId);
  }

  getConstructionBlockReason(cityId: string, buildingId: string): string | undefined {
    const metadata = getPowerPlantMetadata(buildingId);
    if (!metadata) return undefined;
    const city = this.cityManager.getCity(cityId);
    if (!city) return 'Unknown city';
    if (this.resourceAccessSystem.hasResource(city.ownerId, metadata.requiredResourceId)) return undefined;
    return `Requires ${this.getResourceName(metadata.requiredResourceId)}`;
  }

  completeConstruction(
    cityId: string,
    buildingId: string,
    completedTileCoord?: { x: number; y: number },
  ): { ok: true; previousBuildingId?: string; removedTileCoords: ReadonlyArray<{ x: number; y: number }> } | { ok: false; reason: string } {
    const metadata = getPowerPlantMetadata(buildingId);
    const building = getBuildingById(buildingId);
    const city = this.cityManager.getCity(cityId);
    if (!metadata) return { ok: false, reason: 'Unknown power plant.' };
    if (!building) return { ok: false, reason: 'Missing building definition.' };
    if (!city) return { ok: false, reason: 'Unknown city.' };

    this.synchronizeCity(cityId);
    const previous = this.states.get(cityId);
    const removedTileCoords = previous
      ? this.removePhysicalPlant(cityId, previous.buildingId, completedTileCoord)
      : [];

    this.cityManager.getBuildings(cityId).add(building);
    this.states.set(cityId, { buildingId, age: 0 });
    this.lastAllocation.delete(cityId);
    this.refreshAllocation(true);

    if (previous) {
      const previousName = getBuildingById(previous.buildingId)?.name ?? previous.buildingId;
      this.log(city.ownerId, `[PowerPlant] ${building.name} replaced ${previousName} in ${city.name}; age reset to 0.`);
      this.emit({
        kind: 'replaced',
        cityId,
        nationId: city.ownerId,
        buildingId,
        previousBuildingId: previous.buildingId,
        removedTileCoords,
      });
    } else {
      this.log(city.ownerId, `[PowerPlant] ${building.name} constructed in ${city.name}; age 0/${metadata.lifespanTurns}.`);
      this.emit({ kind: 'constructed', cityId, nationId: city.ownerId, buildingId });
    }

    return {
      ok: true,
      previousBuildingId: previous?.buildingId,
      removedTileCoords,
    };
  }

  /** Age every extant plant once per elapsed game round, active or inactive. */
  handleRoundStart(round: number): void {
    if (round <= this.lastAgedRound) {
      this.refreshAllocation(true);
      return;
    }

    this.synchronizeAllCities();
    for (let nextRound = this.lastAgedRound + 1; nextRound <= round; nextRound++) {
      for (const [cityId, state] of [...this.states].sort(([a], [b]) => a.localeCompare(b))) {
        state.age++;
        if (state.buildingId === 'nuclear_plant') this.checkNuclearPlant(cityId, nextRound);
      }
      this.removeExpiredPlants(true);
    }
    this.lastAgedRound = round;
    this.refreshAllocation(true);
  }

  /** Re-evaluate resource-derived activity without changing ages. */
  refreshAllocation(emitTransitions = true): void {
    this.synchronizeAllCities();
    const next = this.computeAllocation();

    if (emitTransitions) {
      for (const [cityId, status] of next) {
        const previous = this.lastAllocation.get(cityId);
        if (!previous || previous.active === status.active) continue;
        const city = this.cityManager.getCity(cityId);
        const state = this.states.get(cityId);
        if (!city || !state) continue;
        const buildingName = getBuildingById(state.buildingId)?.name ?? state.buildingId;
        if (status.active) {
          this.log(city.ownerId, `[PowerPlant] ${buildingName} in ${city.name} became active again.`);
          this.emit({ kind: 'becameActive', cityId, nationId: city.ownerId, buildingId: state.buildingId });
        } else {
          const resourceName = this.getResourceName(getPowerPlantMetadata(state.buildingId)!.requiredResourceId);
          const reasonText = status.inactiveReason === 'broken'
            ? 'the building is broken'
            : `insufficient ${resourceName} capacity`;
          this.log(city.ownerId, `[PowerPlant] ${buildingName} in ${city.name} became inactive: ${reasonText}.`);
          this.emit({
            kind: 'becameInactive',
            cityId,
            nationId: city.ownerId,
            buildingId: state.buildingId,
            reason: status.inactiveReason ?? 'missing_resource',
          });
        }
      }
    }

    this.lastAllocation.clear();
    for (const [cityId, status] of next) this.lastAllocation.set(cityId, status);
  }

  restore(savedCities: readonly SavedPowerPlantCityState[], currentRound: number): void {
    this.states.clear();
    this.lastAllocation.clear();
    this.lastAgedRound = currentRound;
    const ageByCityId = new Map(savedCities.map((city) => [city.id, city.powerPlantAge]));
    this.synchronizeAllCities();
    for (const [cityId, state] of this.states) {
      state.age = Math.max(0, Math.floor(ageByCityId.get(cityId) ?? 0));
    }
    this.removeExpiredPlants(false);
  }

  getCityPowerPlant(cityId: string): CityPowerPlantState | undefined {
    this.synchronizeCity(cityId);
    const state = this.states.get(cityId);
    if (!state) return undefined;
    const metadata = getPowerPlantMetadata(state.buildingId);
    if (!metadata) return undefined;
    const allocation = this.computeAllocation().get(cityId) ?? { active: false, inactiveReason: 'missing_resource' as const };
    return {
      cityId,
      buildingId: state.buildingId,
      requiredResourceId: metadata.requiredResourceId,
      age: state.age,
      lifespan: metadata.lifespanTurns,
      remainingLifespan: Math.max(0, metadata.lifespanTurns - state.age),
      active: allocation.active,
      inactiveReason: allocation.inactiveReason,
    };
  }

  isCityPowerPlantActive(cityId: string): boolean {
    return this.getCityPowerPlant(cityId)?.active ?? false;
  }

  getPowerPlantAge(cityId: string): number | undefined {
    return this.getCityPowerPlant(cityId)?.age;
  }

  getPowerPlantRemainingLifespan(cityId: string): number | undefined {
    return this.getCityPowerPlant(cityId)?.remainingLifespan;
  }

  getPowerPlantInactiveReason(cityId: string): PowerPlantInactiveReason | undefined {
    return this.getCityPowerPlant(cityId)?.inactiveReason;
  }

  getCityPopulationCapacity(cityId: string): number {
    const plant = this.getCityPowerPlant(cityId);
    const plantBonus = plant?.active
      ? getPowerPlantMetadata(plant.buildingId)?.populationCapacityBonus ?? 0
      : 0;
    const infrastructureBonus = this.cityManager.getBuildings(cityId).getAll().reduce((total, buildingId) => {
      const building = getBuildingById(buildingId);
      // Repeated installations are counted from their physical tiles below.
      return total + (building?.repeatable ? 0 : building?.modifiers.populationCapacity ?? 0);
    }, 0);
    return BASE_CITY_POPULATION_CAPACITY + infrastructureBonus + plantBonus + this.getCityRenewableCapacity(cityId);
  }

  getCityRenewableCapacity(cityId: string): number {
    const city = this.cityManager.getCity(cityId);
    return city ? getCityRenewableCapacity(city, this.mapData) : 0;
  }

  getEnvironmentalHappiness(nationId: string): EnvironmentalHappiness {
    const result = { ...EMPTY_ENVIRONMENT };
    for (const city of this.cityManager.getCitiesByOwner(nationId)) {
      const plant = this.getCityPowerPlant(city.id);
      if (!plant?.active) continue;
      const penalty = FOSSIL_PLANT_HAPPINESS[plant.buildingId] ?? 0;
      if (plant.buildingId === 'coal_power_plant') result.coal += penalty;
      if (plant.buildingId === 'oil_power_plant') result.oil += penalty;
      if (plant.buildingId === 'gas_power_plant') result.gas += penalty;
    }
    for (const row of this.mapData.tiles) for (const tile of row) {
      if (tile.ownerId === nationId && tile.type === TileType.NuclearWaste) result.nuclearWaste += NUCLEAR_WASTE_HAPPINESS_PENALTY;
    }
    return result;
  }

  getCityProductionMultiplier(cityId: string): number {
    const plant = this.getCityPowerPlant(cityId);
    if (!plant?.active) return 1;
    return getPowerPlantMetadata(plant.buildingId)?.futureProductionMultiplier ?? 1;
  }

  isCityInEnergyShortage(cityId: string, population: number): boolean {
    return population > this.getCityPopulationCapacity(cityId);
  }

  getNationPowerPlantResourceCapacity(nationId: string, resourceId: string): number {
    return Math.max(0, this.resourceAccessSystem.getResourceSourceCount(nationId, resourceId));
  }

  /** One live allocation pass for national energy-policy evaluation. */
  getNationActivePowerPlants(nationId: string): readonly string[] {
    this.synchronizeAllCities();
    const allocation = this.computeAllocation();
    return this.cityManager.getCitiesByOwner(nationId)
      .filter(city => allocation.get(city.id)?.active)
      .map(city => this.states.get(city.id)!.buildingId);
  }

  getNationActivePowerPlantCount(nationId: string, resourceId: string): number {
    const allocation = this.computeAllocation();
    let count = 0;
    for (const city of this.cityManager.getCitiesByOwner(nationId)) {
      const state = this.states.get(city.id);
      if (!state || getPowerPlantMetadata(state.buildingId)?.requiredResourceId !== resourceId) continue;
      if (allocation.get(city.id)?.active) count += 1;
    }
    return count;
  }

  private computeAllocation(): Map<string, AllocationState> {
    const result = new Map<string, AllocationState>();
    const eligibleByNationAndResource = new Map<string, string[]>();

    for (const city of this.cityManager.getAllCities()) {
      const state = this.states.get(city.id);
      if (!state) continue;
      const metadata = getPowerPlantMetadata(state.buildingId);
      if (!metadata) continue;
      if (this.cityManager.getBuildings(city.id).isBroken(state.buildingId)) {
        result.set(city.id, { active: false, inactiveReason: 'broken' });
        continue;
      }
      const key = `${city.ownerId}\u0000${metadata.requiredResourceId}`;
      const cityIds = eligibleByNationAndResource.get(key);
      if (cityIds) cityIds.push(city.id);
      else eligibleByNationAndResource.set(key, [city.id]);
    }

    for (const [key, cityIds] of eligibleByNationAndResource) {
      const separator = key.indexOf('\u0000');
      const nationId = key.slice(0, separator);
      const resourceId = key.slice(separator + 1);
      const capacity = this.getNationPowerPlantResourceCapacity(nationId, resourceId);
      cityIds.sort((a, b) => a.localeCompare(b));
      cityIds.forEach((cityId, index) => {
        result.set(cityId, index < capacity
          ? { active: true }
          : { active: false, inactiveReason: 'missing_resource' });
      });
    }

    return result;
  }

  private synchronizeAllCities(): void {
    const liveCityIds = new Set(this.cityManager.getAllCities().map((city) => city.id));
    for (const cityId of [...this.states.keys()]) {
      if (!liveCityIds.has(cityId)) this.states.delete(cityId);
    }
    for (const cityId of liveCityIds) this.synchronizeCity(cityId);
  }

  private synchronizeCity(cityId: string): void {
    const city = this.cityManager.getCity(cityId);
    if (!city) {
      this.states.delete(cityId);
      return;
    }
    const buildings = this.cityManager.getBuildings(cityId);
    const plantEntries = buildings.getAllEntries().filter((entry) => isPowerPlantBuilding(entry.buildingId));
    if (plantEntries.length === 0) {
      this.states.delete(cityId);
      return;
    }

    const current = this.states.get(cityId);
    const kept = current && plantEntries.some((entry) => entry.buildingId === current.buildingId)
      ? current.buildingId
      : plantEntries.slice().sort((a, b) => (
        (getPowerPlantMetadata(b.buildingId)?.populationCapacityBonus ?? 0)
        - (getPowerPlantMetadata(a.buildingId)?.populationCapacityBonus ?? 0)
        || a.buildingId.localeCompare(b.buildingId)
      ))[0].buildingId;
    if (!current || current.buildingId !== kept) this.states.set(cityId, { buildingId: kept, age: 0 });

    // Old/editor-authored data may contain several plants. Keep the strongest
    // one and normalize the city immediately to the one-plant invariant.
    for (const entry of plantEntries) {
      if (entry.buildingId === kept) continue;
      this.removePhysicalPlant(cityId, entry.buildingId);
    }
  }

  private checkNuclearPlant(cityId: string, round: number): void {
    const state = this.states.get(cityId);
    const city = this.cityManager.getCity(cityId);
    if (!state || !city) return;
    const lifespan = getPowerPlantMetadata('nuclear_plant')!.lifespanTurns;
    const prefix = `[NuclearPlant] ${city.name} age ${state.age}/${lifespan}`;
    const maximum = state.age >= lifespan;
    if (!maximum && !nuclearPlantAtRisk(state.age, lifespan)) {
      if (nuclearPlantAtRisk(state.age + 1, lifespan)) this.log(city.ownerId, `${prefix} — entering meltdown risk next turn`);
      return;
    }
    if (!maximum) {
      const failed = nuclearPlantRoll(cityId, round) < NUCLEAR_PLANT_MELTDOWN_CHANCE;
      this.log(city.ownerId, `${prefix} — meltdown roll ${NUCLEAR_PLANT_MELTDOWN_CHANCE * 100}%: ${failed ? 'failed' : 'survived'}`);
      if (!failed) return;
    }
    const tile = this.getNuclearPlantTile(cityId);
    const removedTileCoords = this.removePhysicalPlant(cityId, state.buildingId);
    this.states.delete(cityId);
    this.lastAllocation.delete(cityId);
    this.log(city.ownerId, `[NuclearPlant] MELTDOWN at ${city.name} age ${state.age}/${lifespan} — ${maximum ? 'maximum lifespan reached' : 'random failure'}`);
    // Removal precedes the blast, preventing a second accident or maintenance reset.
    if (tile) this.meltdownEffect?.(city.ownerId, tile.x, tile.y);
    this.emit({ kind: 'expired', cityId, nationId: city.ownerId, buildingId: state.buildingId, removedTileCoords });
  }

  private removeExpiredPlants(emitEvents: boolean): void {
    for (const [cityId, state] of [...this.states.entries()]) {
      const metadata = getPowerPlantMetadata(state.buildingId);
      if (!metadata || state.buildingId === 'nuclear_plant' || state.age < metadata.lifespanTurns) continue;
      const city = this.cityManager.getCity(cityId);
      if (!city) {
        this.states.delete(cityId);
        continue;
      }
      const removedTileCoords = this.removePhysicalPlant(cityId, state.buildingId);
      this.states.delete(cityId);
      this.lastAllocation.delete(cityId);
      if (!emitEvents) continue;
      const buildingName = getBuildingById(state.buildingId)?.name ?? state.buildingId;
      this.log(city.ownerId, `[PowerPlant] ${buildingName} in ${city.name} expired after ${metadata.lifespanTurns} turns and was removed.`);
      this.emit({
        kind: 'expired',
        cityId,
        nationId: city.ownerId,
        buildingId: state.buildingId,
        removedTileCoords,
      });
    }
  }

  private removePhysicalPlant(
    cityId: string,
    buildingId: string,
    preserveCoord?: { x: number; y: number },
  ): Array<{ x: number; y: number }> {
    this.cityManager.getBuildings(cityId).remove(buildingId);
    const city = this.cityManager.getCity(cityId);
    if (!city) return [];
    const removed: Array<{ x: number; y: number }> = [];
    for (const coord of city.ownedTileCoords) {
      if (preserveCoord && coord.x === preserveCoord.x && coord.y === preserveCoord.y) continue;
      const tile = this.mapData.tiles[coord.y]?.[coord.x];
      if (tile?.buildingId !== buildingId) continue;
      tile.buildingId = undefined;
      tile.buildingBroken = undefined;
      removed.push({ ...coord });
    }
    return removed;
  }

  private getResourceName(resourceId: string): string {
    return getNaturalResourceById(resourceId)?.name ?? resourceId;
  }

  private emit(event: PowerPlantEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}

export { POWER_PLANTS, getPowerPlantMetadata, isPowerPlantBuilding };
