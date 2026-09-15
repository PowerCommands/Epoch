import { STRATEGIC_WEAPONS, NUCLEAR_DETERRENCE_STRENGTH, getStrategicWeaponProfile, MISSILE_LAUNCH_PAD_ID, PATRIOT_MISSILE_BATTERY_ID } from '../../data/strategicWeapons';
import type { Unit } from '../../entities/Unit';
import type { CityManager } from '../CityManager';
import type { UnitManager } from '../UnitManager';
import type { StrategicWeaponsSystem } from '../StrategicWeaponsSystem';
import type { MapData } from '../../types/map';
import type { IGridSystem } from '../grid/IGridSystem';
import type { MissileStorageSystem } from '../MissileStorageSystem';

/** Operational arsenal is derived from canonical units/cargo/buildings, never separately saved. */
export function getNuclearCapability(nationId: string, units: Pick<UnitManager, 'getUnitsByOwner' | 'getTransportForUnit'>, cities: Pick<CityManager, 'getCityAt' | 'getBuildings'>, storage?: Pick<MissileStorageSystem, 'getPadAt'>): { stockpile: number; ready: number; submarineWeapons: number; deterrence: number } {
  let stockpile = 0, ready = 0, submarineWeapons = 0;
  for (const weapon of units.getUnitsByOwner(nationId)) {
    const config = getStrategicWeaponProfile(weapon);
    if (!config?.nuclear || !weapon.isAlive()) continue;
    stockpile++;
    const carrier = units.getTransportForUnit(weapon);
    const city = cities.getCityAt(weapon.tileX, weapon.tileY);
    if (carrier?.isAlive() && carrier.ownerId === nationId && carrier.cargoUnitIds.includes(weapon.id) && config.carrierIds.includes(carrier.unitType.id)) {
      ready++;
      if (carrier.unitType.id === 'nuclear_submarine') submarineWeapons++;
    } else if (!weapon.carriedByUnitId && config.landLaunch === 'silo') {
      const pad = storage?.getPadAt(weapon.tileX, weapon.tileY);
      if (pad?.ownerId === nationId && pad.operational) ready++;
      else if (!storage && city?.ownerId === nationId && cities.getBuildings(city.id).hasActive(MISSILE_LAUNCH_PAD_ID)) ready++;
    }
  }
  return { stockpile, ready, submarineWeapons, deterrence: Math.min(4, ready) * NUCLEAR_DETERRENCE_STRENGTH + Math.min(2, submarineWeapons) * NUCLEAR_DETERRENCE_STRENGTH * 0.5 };
}

export interface StrategicAIContext {
  nationId: string;
  units: UnitManager;
  cities: CityManager;
  map: MapData;
  grid: IGridSystem;
  weapons: StrategicWeaponsSystem;
  atWar(other: string): boolean;
  known(x: number, y: number): boolean;
  interventionRisk?(victim: string): number;
  aggression: number;
  warTolerance: number;
  relation(other: string): { hostility: number; trust: number; fear: number };
  move(unit: Unit, x: number, y: number): void;
  log(message: string): void;
  round: number;
}
/** Deterministic, conservative targeting: conventional value first, nuclear use only under severe pressure. */
export function runStrategicWeaponsAI(c: StrategicAIContext): void {
  const owned = c.units.getUnitsByOwner(c.nationId);
  const storage = c.weapons.storage;
  // Keep a small deterrent. Conventional delivery remains useful even after nuclear research.
  let armedICBMs = owned.filter(u => u.unitType.id === 'icbm' && u.nuclearArmed).length;
  for (const missile of owned.filter(u => u.unitType.id === 'icbm' && !u.nuclearArmed)) {
    if (armedICBMs >= (c.aggression >= 0.65 ? 2 : 1)) break;
    if (missile.missileLaunchPad && storage.armMissile(missile)) armedICBMs++;
  }
  const arsenal = getNuclearCapability(c.nationId, c.units, c.cities, storage);
  if (arsenal.stockpile && c.round % 20 === 0) c.log(`[Strategic] arsenal ${JSON.stringify(arsenal)}; nuclear deterrence retained`);
  const enemies = c.units.getAllUnits().filter(u => c.atWar(u.ownerId) && !u.missileLaunchPad);
  const ownPower = owned.reduce((n, u) => n + Math.max(u.unitType.baseStrength, u.unitType.rangedStrength ?? 0), 0);
  const enemyPower = enemies.reduce((n, u) => n + Math.max(u.unitType.baseStrength, u.unitType.rangedStrength ?? 0), 0);
  for (const weapon of owned.filter(u => STRATEGIC_WEAPONS[u.unitType.id])) {
    if (!c.units.getUnit(weapon.id) || weapon.movementPoints <= 0) continue;
    const config = getStrategicWeaponProfile(weapon)!;
    const delivery = STRATEGIC_WEAPONS[weapon.unitType.id];
    if (!weapon.carriedByUnitId && !weapon.missileLaunchPad) {
      const carriers = owned.filter(u => delivery.carrierIds.includes(u.unitType.id) && c.units.canBoardUnit(weapon, u));
      carriers.sort((a, b) => c.grid.getDistance({ x: weapon.tileX, y: weapon.tileY }, { x: a.tileX, y: a.tileY }) - c.grid.getDistance({ x: weapon.tileX, y: weapon.tileY }, { x: b.tileX, y: b.tileY }) || a.id.localeCompare(b.id));
      const carrier = carriers[0];
      if (carrier && c.grid.getDistance({ x: weapon.tileX, y: weapon.tileY }, { x: carrier.tileX, y: carrier.tileY }) <= 1) c.units.boardUnit(weapon.id, carrier.id);
      else if (config.landLaunch === 'none' && carrier) c.move(carrier, weapon.tileX, weapon.tileY);
      else if (config.landLaunch === 'silo') {
        const pad = storage.findAvailablePad(c.nationId);
        if (pad) storage.storeMissile(weapon, pad);
        else if (carrier) c.move(weapon, carrier.tileX, carrier.tileY);
      }
    }
    const carrier = c.units.getTransportForUnit(weapon);
    const origin = carrier ?? weapon;
    const range = weapon.unitType.id === 'atomic_bomb' ? carrier?.unitType.range ?? 0 : weapon.unitType.range ?? 0;
    let best: { x: number; y: number; score: number } | undefined;
    // Global weapons examine strategically useful known targets, avoiding a full-world scan per missile.
    const globalTargets = delivery.globalRange ? getGlobalStrategicTargets(c, enemies) : [];
    for (const tile of delivery.globalRange ? globalTargets : c.grid.getTilesInRange({ x: origin.tileX, y: origin.tileY }, range, c.map, { includeCenter: false })) {
      if (!c.known(tile.x, tile.y) || c.weapons.getLaunchFailure(weapon, tile.x, tile.y)) continue;
      const blast = c.grid.getTilesInRange(tile, config.radius, c.map, { includeCenter: true });
      const keys = new Set(blast.map(t => `${t.x},${t.y}`));
      // Do not sacrifice domestic land, troops or cities to pad target value.
      if (blast.some(t => t.ownerId === c.nationId) || owned.some(u => u.id !== weapon.id && keys.has(`${u.tileX},${u.tileY}`))) continue;
      const hitUnits = enemies.filter(u => c.known(u.tileX, u.tileY) && keys.has(`${u.tileX},${u.tileY}`));
      const hitCities = c.cities.getAllCities().filter(city => c.atWar(city.ownerId) && c.known(city.tileX, city.tileY) && keys.has(`${city.tileX},${city.tileY}`));
      let score = hitUnits.reduce((n, u) => n + Math.min(config.unitDamage, u.health), 0) + hitCities.length * 100;
      // Visible installations have strategic value; never inspect hidden enemy magazine contents.
      score += blast.reduce((value, t) => value + (t.ownerId && c.atWar(t.ownerId) && c.known(t.x, t.y)
        ? t.buildingId === MISSILE_LAUNCH_PAD_ID ? 200 : t.buildingId === PATRIOT_MISSILE_BATTERY_ID && !t.buildingBroken ? 90 : 0 : 0), 0);
      if (config.nuclear) {
        const target = hitCities[0]?.ownerId ?? hitUnits[0]?.ownerId;
        if (!target) continue;
        const relation = c.relation(target);
        const retaliation = getNuclearCapability(target, c.units, c.cities, storage).ready > 0;
        const threatenedCity = c.cities.getCitiesByOwner(c.nationId).some(city => city.health < 60 && enemies.some(u => c.grid.getDistance({ x: u.tileX, y: u.tileY }, { x: city.tileX, y: city.tileY }) <= 3));
        if (!threatenedCity && !(enemyPower > ownPower * 1.8 && relation.hostility > 60 && c.aggression > 0.6)) continue;
        // Collective intervention and retaliation make nuclear use much costlier than a precision strike.
        score -= 230 + (c.interventionRisk?.(target) ?? 0) + (retaliation ? 200 : 0) + relation.fear + Math.max(0, relation.trust) + Math.max(0, 1 - c.warTolerance) * 100;
      }
      if (score >= (config.nuclear ? 180 : 60) && (!best || score > best.score)) best = { x: tile.x, y: tile.y, score };
    }
    if (best && c.weapons.launch(weapon, best.x, best.y)) c.log(`[Strategic] launched ${weapon.unitType.id} from ${carrier?.unitType.id ?? 'land'} at ${best.x},${best.y}; value=${best.score.toFixed(0)}`);
    else if ((carrier || config.landLaunch === 'any') && enemies.length) {
      const carrier = origin;
      // Standoff positioning: retain survivable range instead of sailing into the target city.
      const target = c.cities.getAllCities().find(city => c.atWar(city.ownerId) && c.known(city.tileX, city.tileY));
      if (target && c.grid.getDistance({ x: carrier.tileX, y: carrier.tileY }, { x: target.tileX, y: target.tileY }) > range) {
        const stations = c.grid.getTilesInRange({ x: target.tileX, y: target.tileY }, Math.max(1, range - 1), c.map)
          .filter(t => c.grid.getDistance(t, { x: target.tileX, y: target.tileY }) > config.radius + 1)
          .sort((a, b) => c.grid.getDistance(a, { x: carrier.tileX, y: carrier.tileY }) - c.grid.getDistance(b, { x: carrier.tileX, y: carrier.tileY }));
        for (const station of stations) { const before = carrier.movementPoints; c.move(carrier, station.x, station.y); if (carrier.movementPoints < before) break; }
      }
    }
  }
}

function getGlobalStrategicTargets(c: StrategicAIContext, enemies: readonly Unit[]) {
  const centers = [
    ...enemies.filter(u => c.known(u.tileX, u.tileY)).map(u => ({ x: u.tileX, y: u.tileY })),
    ...c.cities.getAllCities().filter(city => c.atWar(city.ownerId) && c.known(city.tileX, city.tileY)).map(city => ({ x: city.tileX, y: city.tileY })),
    ...c.map.tiles.flat().filter(tile => tile.ownerId && c.atWar(tile.ownerId) && c.known(tile.x, tile.y)
      && (tile.buildingId === MISSILE_LAUNCH_PAD_ID || tile.buildingId === PATRIOT_MISSILE_BATTERY_ID)),
  ];
  const targets = new Map<string, MapData['tiles'][number][number]>();
  for (const center of centers) for (const tile of c.grid.getTilesInRange(center, 1, c.map, { includeCenter: true })) {
    if (c.known(tile.x, tile.y)) targets.set(`${tile.x},${tile.y}`, tile);
  }
  return [...targets.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}
