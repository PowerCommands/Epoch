import type { AircraftBase, Unit } from '../entities/Unit';
import type { City } from '../entities/City';
import type { GridCoord } from '../types/grid';
import { TileType, type MapData } from '../types/map';
import type { UnitManager } from './UnitManager';
import type { CityManager } from './CityManager';
import type { IGridSystem } from './grid/IGridSystem';
import type { DiplomacyManager } from './DiplomacyManager';
import { getBuildingById } from '../data/buildings';
import { airMissionRoll, interceptionProfile } from '../data/airOperations';
import { resolveRangedCombat } from './CombatResolver';

export interface AirBaseSite extends GridCoord { base: AircraftBase; ownerId: string; name: string; capacity: number }
export interface AirFlightEvent {
  aircraft: Unit; origin: GridCoord; destination: GridCoord; kind: 'strike' | 'intercepted' | 'rebase';
  destroyed: boolean; interceptor?: Unit; interceptorOrigin?: GridCoord;
}
const position = (unit: { tileX: number; tileY: number }): GridCoord => ({ x: unit.tileX, y: unit.tileY });
const sameBase = (a: AircraftBase | undefined, b: AircraftBase) => a?.kind === b.kind && a.id === b.id;

/** Authoritative basing and atomic missions; presentation consumes immutable route snapshots. */
export class AirOperationsSystem {
  private reconciling = false;
  private log: (ownerId: string, message: string) => void = (_owner,message) => console.info(message);
  setLogger(logger: (ownerId: string, message: string) => void): void { this.log = logger; }
  private readonly listeners: ((event: AirFlightEvent) => void)[] = [];
  constructor(
    private readonly units: UnitManager, private readonly cities: CityManager,
    private readonly map: MapData, private readonly grid: IGridSystem,
    private readonly diplomacy: DiplomacyManager | undefined,
    private readonly round: () => number,
    private readonly currentOwner: () => string,
    private readonly strike: (unit: Unit, x: number, y: number) => boolean,
    private readonly missionAllowed: (unit: Unit, x: number, y: number) => boolean = () => true,
  ) {
    units.airOperations = this;
    units.onUnitChanged(event => {
      if ((event.unit.unitType.aircraftRole && (event.reason === 'created' || event.reason === 'upgraded'))
        || event.unit.unitType.aircraftCapacity) this.reconcile();
    });
    cities.onCityChanged(event => { if (event.reason === 'buildingsChanged' || event.reason === 'removed' || event.reason === 'ownershipTransferred') this.reconcile(); });
  }
  onFlight(listener: (event: AirFlightEvent) => void): void { this.listeners.push(listener); }
  cityCapacity(city: City): number {
    return Math.max(0, ...this.cities.getBuildings(city.id).getAll().map(id => getBuildingById(id)?.aircraftCapacity ?? 0));
  }
  sites(ownerId: string): AirBaseSite[] {
    return [
      ...this.cities.getCitiesByOwner(ownerId).flatMap(city => {
        const tile = city.ownedTileCoords.map(coord => this.map.tiles[coord.y]?.[coord.x])
          .find(tile => tile?.buildingId && !tile.buildingBroken && getBuildingById(tile.buildingId)?.aircraftCapacity
            && this.cities.getBuildings(city.id).hasActive(tile.buildingId));
        return tile ? [{ x: tile.x, y: tile.y, base: { kind: 'city' as const, id: city.id }, ownerId,
          name: `${getBuildingById(tile.buildingId!)!.name} — ${city.name}`, capacity: this.cityCapacity(city) }] : [];
      }),
      ...this.units.getUnitsByOwner(ownerId).filter(unit => unit.isAlive() && unit.unitType.aircraftCapacity).map(unit => ({ ...position(unit), base: { kind: 'carrier' as const, id: unit.id }, ownerId, name: unit.name, capacity: unit.unitType.aircraftCapacity! })),
    ].filter(site => site.capacity > 0);
  }
  /** Aircraft currently stationed at a base, stable id order (authoritative occupancy). */
  aircraftAt(base: AircraftBase): Unit[] {
    return this.units.getAllUnits().filter(unit => unit.unitType.aircraftRole && sameBase(unit.airBase, base)).sort((a,b) => a.id.localeCompare(b.id));
  }
  usage(base: AircraftBase): number { return this.aircraftAt(base).length; }
  /** Every air-capable base across all owners; presentation reads occupancy via usage/aircraftAt. */
  allSites(): AirBaseSite[] {
    const owners = new Set<string>();
    for (const city of this.cities.getAllCities()) owners.add(city.ownerId);
    for (const unit of this.units.getAllUnits()) if (unit.unitType.aircraftCapacity) owners.add(unit.ownerId);
    return [...owners].flatMap(owner => this.sites(owner));
  }
  productionDestinations(city: City): AirBaseSite[] {
    return this.sites(city.ownerId).filter(site => this.usage(site.base) < site.capacity)
      .sort((a,b) => this.grid.getDistance(position(city),a)-this.grid.getDistance(position(city),b) || a.base.id.localeCompare(b.base.id));
  }
  productionDestinationLabel(ownerId: string, base?: AircraftBase): string {
    return base ? this.sites(ownerId).find(site => sameBase(base,site.base))?.name ?? 'Unavailable base' : 'Automatic base';
  }
  productionDestination(city: City, base?: AircraftBase): AirBaseSite | undefined {
    return this.productionDestinations(city).find(site => !base || sameBase(base,site.base));
  }
  productionBlockReason(city: City, base?: AircraftBase): string | undefined {
    return this.productionDestination(city, base) ? undefined : base
      ? 'Selected aircraft base is unavailable or has no free slot'
      : 'Requires an available Airfield / Air Base / Carrier aircraft slot';
  }
  baseFor(unit: Unit): AirBaseSite | undefined { return this.sites(unit.ownerId).find(site => sameBase(unit.airBase, site.base)); }
  private assign(unit: Unit, site: AirBaseSite): void {
    const oldTransport = this.units.getTransportForUnit(unit);
    if (oldTransport) oldTransport.cargoUnitIds = oldTransport.cargoUnitIds.filter(id => id !== unit.id);
    unit.airBase = { ...site.base };
    unit.carriedByUnitId = site.base.kind === 'carrier' ? site.base.id : undefined;
    const transport = this.units.getTransportForUnit(unit);
    if (transport && !transport.cargoUnitIds.includes(unit.id)) transport.cargoUnitIds.push(unit.id);
    unit.queuedDestination = undefined;
    this.units.refreshAircraftPosition(unit, site.x, site.y);
  }
  /** Legacy aircraft and overflow divert within normal range, nearest first then stable base id. */
  reconcile(excluded?: AircraftBase): void {
    if (this.reconciling) return;
    this.reconciling = true;
    try {
      const aircraft = this.units.getAllUnits().filter(unit => unit.unitType.aircraftRole).sort((a,b) => a.id.localeCompare(b.id));
      const occupied = new Map<string, number>();
      const displaced: Unit[] = [];
      for (const unit of aircraft) {
        // Legacy carrier cargo is migrated to the explicit base metadata.
        if (!unit.airBase && unit.carriedByUnitId) unit.airBase = { kind: 'carrier', id: unit.carriedByUnitId };
        const site = this.baseFor(unit);
        const key = site ? `${site.base.kind}:${site.base.id}` : '';
        if (site && !sameBase(excluded, site.base) && (occupied.get(key) ?? 0) < site.capacity) {
          occupied.set(key, (occupied.get(key) ?? 0) + 1);
          if (unit.tileX !== site.x || unit.tileY !== site.y || (site.base.kind === 'carrier' ? unit.carriedByUnitId !== site.base.id : unit.carriedByUnitId !== undefined)) this.assign(unit, site);
        } else displaced.push(unit);
      }
      for (const unit of displaced) unit.airBase = undefined;
      for (const unit of displaced) {
        const site = this.sites(unit.ownerId).filter(site => !sameBase(excluded, site.base)
          && this.usage(site.base) < site.capacity && this.grid.getDistance(position(unit), site) <= (unit.unitType.range ?? 0))
          .sort((a,b) => this.grid.getDistance(position(unit),a) - this.grid.getDistance(position(unit),b) || a.base.id.localeCompare(b.base.id))[0];
        if (site) {
          this.assign(unit, site);
          this.log(unit.ownerId, `[Air] ${unit.name} based at ${site.name}.`);
        } else {
          this.log(unit.ownerId, `[Air] ${unit.name} lost: no friendly base with capacity in range.`);
          this.units.removeUnit(unit.id);
        }
      }
    } finally { this.reconciling = false; }
  }
  evacuateCarrier(unit: Unit): void { if (unit.unitType.aircraftCapacity) this.reconcile({ kind: 'carrier', id: unit.id }); }
  private ready(unit: Unit): boolean {
    return !!unit.unitType.aircraftRole && this.units.getUnit(unit.id) === unit && unit.isAlive()
      && unit.ownerId === this.currentOwner() && unit.movementPoints > 0 && !!this.baseFor(unit);
  }
  canTarget(unit: Unit, target: GridCoord): boolean {
    const base = this.baseFor(unit);
    if (!base || !this.map.tiles[target.y]?.[target.x] || this.grid.getDistance(base, target) > (unit.unitType.range ?? 0)) return false;
    const defender = this.units.getUnitAt(target.x,target.y) ?? this.cities.getCityAt(target.x,target.y);
    return !!defender && defender.ownerId !== unit.ownerId && (this.diplomacy?.canAttack(unit.ownerId,defender.ownerId) ?? true);
  }
  rebaseDestinations(unit: Unit): AirBaseSite[] {
    if (!this.ready(unit)) return [];
    const origin = this.baseFor(unit)!;
    return this.sites(unit.ownerId).filter(site => !sameBase(unit.airBase, site.base)
      && this.usage(site.base) < site.capacity
      && this.grid.getDistance(origin, site) <= (unit.unitType.range ?? 0));
  }
  rebase(unit: Unit, destination: AircraftBase): boolean {
    this.reconcile();
    if (!this.ready(unit)) return false;
    const origin = this.baseFor(unit)!;
    const site = this.rebaseDestinations(unit).find(site => sameBase(destination,site.base));
    if (!site) return false;
    this.assign(unit,site); this.units.consumeAllMovement(unit.id);
    this.emit({ aircraft: unit, origin, destination: site, kind: 'rebase', destroyed: false });
    return true;
  }
  /** One best defender across the entire outbound path, one roll per mission. */
  mission(unit: Unit, x: number, y: number): boolean {
    this.reconcile();
    const target = { x,y };
    if (!this.ready(unit) || !this.canTarget(unit,target) || !this.missionAllowed(unit,x,y)) return false;
    const origin = this.baseFor(unit)!;
    const path = this.flightPath(origin,target);
    const candidates = this.units.getAllUnits().filter(defender => defender.ownerId !== unit.ownerId && defender.isAlive()
      && (defender.unitType.aircraftRole === 'fighter' || (defender.unitType.airDefense && !defender.carriedByUnitId))
      && (this.diplomacy?.canAttack(defender.ownerId,unit.ownerId) ?? true)).flatMap(defender => {
        const fighter = defender.unitType.aircraftRole === 'fighter';
        const source = fighter ? this.baseFor(defender) : position(defender);
        if (!source) return [];
        const profile = interceptionProfile(defender.qualityLevel,fighter);
        const meeting = path.find(point => this.grid.getDistance(source,point) <= profile.radius);
        return meeting ? [{ defender, source, profile, meeting, distance: this.grid.getDistance(source,meeting) }] : [];
      }).sort((a,b) => b.profile.chance-a.profile.chance || a.distance-b.distance || a.defender.id.localeCompare(b.defender.id));
    const chosen = candidates[0];
    if (chosen && airMissionRoll(`${this.round()}:${unit.id}:${chosen.defender.id}`) < chosen.profile.chance) {
      const damage = resolveRangedCombat(chosen.defender,unit).defenderDamageTaken;
      unit.health = Math.max(0,unit.health-damage);
      this.units.consumeAllMovement(unit.id); this.units.notifyDamaged(unit);
      if (!unit.isAlive()) this.units.removeUnit(unit.id);
      this.log(unit.ownerId, `[Air] ${chosen.defender.name} intercepted ${unit.name}: mission aborted${unit.isAlive() ? ', aircraft returning to base' : ', aircraft destroyed'}.`);
      this.emit({ aircraft: unit, origin, destination: chosen.meeting, kind: 'intercepted', destroyed: !unit.isAlive(), interceptor: chosen.defender, interceptorOrigin: chosen.source });
      return true;
    }
    const success = this.strike(unit,x,y);
    if (success) this.emit({ aircraft: unit, origin, destination: target, kind: 'strike', destroyed: !unit.isAlive() });
    return success;
  }
  /** Ground defenses protect cities exposed to known enemy aircraft. */
  defensePost(unit: Unit, known: (x: number,y: number) => boolean = () => true): GridCoord | undefined {
    if (!unit.unitType.airDefense) return undefined;
    const threats = this.units.getAllUnits().filter(enemy => enemy.unitType.aircraftRole
      && enemy.ownerId !== unit.ownerId && known(enemy.tileX,enemy.tileY)
      && (this.diplomacy?.canAttack(unit.ownerId,enemy.ownerId) ?? true));
    const city = this.cities.getCitiesByOwner(unit.ownerId).filter(city => threats.some(enemy =>
      this.grid.getDistance(position(city),position(enemy)) <= (enemy.unitType.range ?? 0)))
      .sort((a,b) => this.grid.getDistance(position(unit),position(a))-this.grid.getDistance(position(unit),position(b)) || a.id.localeCompare(b.id))[0];
    if (!city) return undefined;
    if (this.grid.getDistance(position(unit),position(city)) <= 1) return position(unit);
    return this.grid.getTilesInRange(position(city),1,this.map,{includeCenter:true})
      .filter(tile => tile.type !== TileType.Ocean && tile.type !== TileType.Coast && !this.units.getUnitAt(tile.x,tile.y))
      .sort((a,b) => this.grid.getDistance(position(unit),a)-this.grid.getDistance(position(unit),b) || a.x-b.x || a.y-b.y)[0];
  }
  /** Pragmatic front selection: attack valuable visible targets, otherwise transfer closer. */
  runAI(ownerId: string, known: (x: number,y: number) => boolean = () => true): void {
    this.reconcile();
    const targets = [
      ...this.units.getAllUnits().filter(u => !u.unitType.aircraftRole && !u.carriedByUnitId && u.ownerId !== ownerId).map(u => ({ ...position(u), ownerId: u.ownerId, score: 50 + (u.unitType.airDefense ? 40 : 0) + (u.unitType.baseHealth-u.health) })),
      ...this.cities.getAllCities().filter(c => c.ownerId !== ownerId).map(c => ({ ...position(c), ownerId: c.ownerId, score: 80 })),
    ].filter(t => known(t.x,t.y) && (this.diplomacy?.canAttack(ownerId,t.ownerId) ?? true)).sort((a,b) => b.score-a.score || a.x-b.x || a.y-b.y);
    for (const unit of this.units.getUnitsByOwner(ownerId).filter(u => u.unitType.aircraftRole)) {
      if (!this.ready(unit)) continue;
      const target = targets.find(t => this.canTarget(unit,t));
      if (target && this.mission(unit,target.x,target.y)) continue;
      if (!targets.length) continue;
      const origin = this.baseFor(unit)!;
      const distance = (site: GridCoord) => Math.min(...targets.map(t => this.grid.getDistance(site,t)));
      const next = this.sites(ownerId).filter(site => !sameBase(unit.airBase,site.base) && this.usage(site.base) < site.capacity
        && this.grid.getDistance(origin,site) <= (unit.unitType.range ?? 0) && distance(site) < distance(origin))
        .sort((a,b) => distance(a)-distance(b) || a.base.id.localeCompare(b.base.id))[0];
      if (next) this.rebase(unit,next.base);
    }
  }
  private flightPath(origin: GridCoord, target: GridCoord): GridCoord[] {
    const path = [{ x: origin.x,y: origin.y }];
    while (this.grid.getDistance(path[path.length-1],target) > 0) {
      const next = this.grid.getAdjacentCoords(path[path.length-1]).sort((a,b) => this.grid.getDistance(a,target)-this.grid.getDistance(b,target) || a.x-b.x || a.y-b.y)[0];
      path.push(next);
    }
    return path;
  }
  private emit(event: AirFlightEvent): void { for (const listener of this.listeners) listener(event); }
}
