import type { City } from '../../entities/City';
import type { Unit } from '../../entities/Unit';
import type { UnitType } from '../../entities/UnitType';
import type { GridCoord } from '../../types/grid';
import type { Tile } from '../../types/map';

export type EmergencyCityThreatSeverity = 'threatened' | 'critical';

export interface EmergencyCityThreat {
  readonly city: City;
  readonly severity: EmergencyCityThreatSeverity;
  readonly threateningNationIds: readonly string[];
  readonly hostileUnits: readonly Unit[];
  readonly localHostileStrength: number;
  readonly nearestHostileDistance: number;
  readonly reason: string;
}

export interface EmergencyCityThreatContext {
  readonly nationId: string;
  readonly cities: readonly City[];
  readonly units: readonly Unit[];
  readonly currentRound: number;
  readonly getDistance: (a: GridCoord, b: GridCoord) => number;
  readonly isAtWar: (nationId: string, otherNationId: string) => boolean;
  readonly canThreatenCity?: (unit: Unit, city: City) => boolean;
}

export interface EmergencyDefenseAssignment {
  readonly unit: Unit;
  readonly threat: EmergencyCityThreat;
}

const TACTICAL_THREAT_RADIUS = 3;
const IMMEDIATE_THREAT_RADIUS = 1;
const REDEPLOY_RADIUS = 8;
const CREDIBLE_LOCAL_STRENGTH = 20;

function isCredibleHostileMilitary(unit: Unit): boolean {
  if (unit.unitType.baseStrength <= 0) return false;
  if (unit.unitType.category === 'recon' || unit.unitType.category === 'naval_recon') return false;
  if (unit.unitType.category === 'civilian' || unit.unitType.category === 'covert') return false;
  return true;
}

export function isSuitableEmergencyLandDefenderType(unitType: UnitType): boolean {
  if (unitType.baseStrength <= 0) return false;
  if (unitType.isNaval === true) return false;
  if (unitType.category === 'air' || unitType.category === 'civilian') return false;
  if (unitType.category === 'recon' || unitType.category === 'covert') return false;
  if (unitType.canFound === true) return false;
  return true;
}

export function isSuitableEmergencyLandDefender(unit: Unit): boolean {
  return isSuitableEmergencyLandDefenderType(unit.unitType);
}

export function detectEmergencyCityThreats(
  context: EmergencyCityThreatContext,
): EmergencyCityThreat[] {
  const threats: EmergencyCityThreat[] = [];

  for (const city of context.cities) {
    const cityPosition = { x: city.tileX, y: city.tileY };
    const nearby = context.units
      .filter((unit) => unit.ownerId !== context.nationId)
      .filter(isCredibleHostileMilitary)
      .filter((unit) => context.isAtWar(context.nationId, unit.ownerId))
      .filter((unit) => context.canThreatenCity?.(unit, city) ?? true)
      .map((unit) => ({
        unit,
        distance: context.getDistance(cityPosition, { x: unit.tileX, y: unit.tileY }),
      }))
      .filter(({ distance }) => distance <= TACTICAL_THREAT_RADIUS)
      .sort((a, b) => a.distance - b.distance || b.unit.unitType.baseStrength - a.unit.unitType.baseStrength);

    if (nearby.length === 0) continue;

    const adjacent = nearby.some(({ distance }) => distance <= IMMEDIATE_THREAT_RADIUS);
    const recentlyAttacked = city.lastTurnAttacked !== null
      && context.currentRound - city.lastTurnAttacked <= 1;
    const closeProperCombatUnit = nearby.some(({ distance }) => distance <= 2);
    const weightedStrength = nearby.reduce(
      (sum, { unit, distance }) => sum + unit.unitType.baseStrength * (distance === 1 ? 2 : distance === 2 ? 1 : 0.5),
      0,
    );
    const credible = closeProperCombatUnit || nearby.length >= 2 || weightedStrength >= CREDIBLE_LOCAL_STRENGTH;
    if (!credible) continue;

    const severity: EmergencyCityThreatSeverity = adjacent || recentlyAttacked
      ? 'critical'
      : 'threatened';
    const threateningNationIds = [...new Set(nearby.map(({ unit }) => unit.ownerId))];
    const reason = adjacent
      ? 'hostile military adjacent'
      : recentlyAttacked
        ? 'recently attacked with hostile military nearby'
        : `${nearby.length} hostile military unit(s) within ${TACTICAL_THREAT_RADIUS} tiles`;

    threats.push({
      city,
      severity,
      threateningNationIds,
      hostileUnits: nearby.map(({ unit }) => unit),
      localHostileStrength: nearby.reduce((sum, { unit }) => sum + unit.unitType.baseStrength, 0),
      nearestHostileDistance: nearby[0].distance,
      reason,
    });
  }

  return threats.sort((a, b) => {
    const severityDelta = Number(b.severity === 'critical') - Number(a.severity === 'critical');
    if (severityDelta !== 0) return severityDelta;
    const capitalDelta = Number(b.city.isResidenceCapital) - Number(a.city.isResidenceCapital);
    if (capitalDelta !== 0) return capitalDelta;
    return b.localHostileStrength - a.localHostileStrength || a.city.id.localeCompare(b.city.id);
  });
}

export function allocateEmergencyCityDefenders(input: {
  readonly nationId: string;
  readonly threats: readonly EmergencyCityThreat[];
  readonly friendlyUnits: readonly Unit[];
  readonly getDistance: (a: GridCoord, b: GridCoord) => number;
  readonly canReachCity: (unit: Unit, city: City) => boolean;
  readonly hasFriendlyMilitaryOnCity: (city: City) => boolean;
}): EmergencyDefenseAssignment[] {
  const assignedUnitIds = new Set<string>();
  const assignments: EmergencyDefenseAssignment[] = [];

  for (const threat of input.threats) {
    if (input.hasFriendlyMilitaryOnCity(threat.city)) continue;
    const cityPosition = { x: threat.city.tileX, y: threat.city.tileY };
    const candidate = input.friendlyUnits
      .filter((unit) => unit.ownerId === input.nationId)
      .filter(isSuitableEmergencyLandDefender)
      .filter((unit) => unit.movementPoints > 0 && !assignedUnitIds.has(unit.id))
      .map((unit) => ({
        unit,
        distance: input.getDistance({ x: unit.tileX, y: unit.tileY }, cityPosition),
      }))
      .filter(({ unit, distance }) => distance <= REDEPLOY_RADIUS && input.canReachCity(unit, threat.city))
      .sort((a, b) => a.distance - b.distance
        || b.unit.unitType.baseStrength - a.unit.unitType.baseStrength
        || a.unit.id.localeCompare(b.unit.id))[0];
    if (!candidate) continue;

    assignedUnitIds.add(candidate.unit.id);
    assignments.push({ unit: candidate.unit, threat });
  }

  return assignments;
}

export function executeEmergencyDefenseAssignment(input: {
  readonly assignment: EmergencyDefenseAssignment;
  readonly findPath: (unit: Unit, city: City) => Tile[] | null;
  readonly moveAlongPath: (unit: Unit, path: Tile[]) => void;
  readonly onOccupied?: (assignment: EmergencyDefenseAssignment) => void;
}): boolean {
  const path = input.findPath(input.assignment.unit, input.assignment.threat.city);
  if (!path) return false;
  input.moveAlongPath(input.assignment.unit, path);
  const occupied = input.assignment.unit.tileX === input.assignment.threat.city.tileX
    && input.assignment.unit.tileY === input.assignment.threat.city.tileY;
  if (occupied) input.onOccupied?.(input.assignment);
  return true;
}

/**
 * True for units that can provide meaningful naval fire support: military naval
 * units with a real ranged attack. Uses actual unit properties (naval, combat
 * strength, ranged strength, range) rather than hardcoded ship names, so any
 * current or future ranged warship qualifies automatically. Melee-only ships,
 * civilian sea units (Work Boat), naval recon (Scout Boat) and land units are
 * excluded.
 */
export function isSuitableNavalFireSupportUnitType(unitType: UnitType): boolean {
  if (unitType.isNaval !== true) return false;
  if (unitType.baseStrength <= 0) return false; // military naval only (excludes Work/Scout Boat)
  // Mirror the combat system's ranged-attack gate exactly (range >= 2 and a
  // positive ranged strength) so this matches what a ship can actually do —
  // category-independent, so any current/future ranged warship qualifies.
  if ((unitType.range ?? 1) < 2) return false;
  if ((unitType.rangedStrength ?? 0) <= 0) return false;
  return true;
}

export function isSuitableNavalFireSupportUnit(unit: Unit): boolean {
  return isSuitableNavalFireSupportUnitType(unit.unitType);
}

export interface NavalFireSupportAssignment {
  readonly unit: Unit;
  readonly threat: EmergencyCityThreat;
}

/**
 * Assigns a bounded number of suitable ranged warships to genuinely threatened
 * coastal cities. EmergencyCityDefense stays the sole threat authority; this
 * only maps existing threats to nearby ships so the naval AI can move them into
 * firing position. Movement and combat remain the naval AI's responsibility.
 *
 * Selection order per threat (critical cities first, as pre-sorted by
 * {@link detectEmergencyCityThreats}):
 *   1. ships already able to fire on the threat (so they are kept, not pulled)
 *   2. ships already assigned to this city last turn (hysteresis — avoids
 *      pathological oscillation between two equidistant threatened cities)
 *   3. closest ships
 * Ships beyond `reachRadius` are never recruited, so a minor local threat does
 * not drag distant fleets across the map. Each ship serves at most one city.
 */
export function allocateNavalFireSupport(input: {
  readonly nationId: string;
  readonly threats: readonly EmergencyCityThreat[];
  readonly friendlyUnits: readonly Unit[];
  readonly isCoastalCity: (city: City) => boolean;
  readonly getDistance: (a: GridCoord, b: GridCoord) => number;
  readonly isInFiringRange: (unit: Unit, threat: EmergencyCityThreat) => boolean;
  readonly reachRadius: number;
  readonly maxShipsPerThreat: number;
  readonly previousCityByUnit?: ReadonlyMap<string, string>;
}): NavalFireSupportAssignment[] {
  const suitable = input.friendlyUnits
    .filter((unit) => unit.ownerId === input.nationId)
    .filter(isSuitableNavalFireSupportUnit);
  if (suitable.length === 0) return [];

  const coastalThreats = input.threats.filter((threat) => input.isCoastalCity(threat.city));
  if (coastalThreats.length === 0) return [];

  const assignedUnitIds = new Set<string>();
  const assignments: NavalFireSupportAssignment[] = [];
  const remainingByCity = new Map<string, number>();
  for (const threat of coastalThreats) {
    remainingByCity.set(
      threat.city.id,
      Math.max(1, Math.min(threat.hostileUnits.length, input.maxShipsPerThreat)),
    );
  }

  const withinReach = (unit: Unit, threat: EmergencyCityThreat): boolean =>
    input.getDistance({ x: unit.tileX, y: unit.tileY }, { x: threat.city.tileX, y: threat.city.tileY })
      <= input.reachRadius;

  // Retention pass: keep a ship on the city it defended last turn (if that city
  // is still a genuine coastal threat within reach and has capacity). This gives
  // hysteresis so ships don't oscillate between equidistant threatened cities.
  if (input.previousCityByUnit) {
    const threatByCity = new Map(coastalThreats.map((threat) => [threat.city.id, threat]));
    for (const unit of [...suitable].sort((a, b) => a.id.localeCompare(b.id))) {
      const previousCityId = input.previousCityByUnit.get(unit.id);
      if (previousCityId === undefined) continue;
      const threat = threatByCity.get(previousCityId);
      if (!threat || !withinReach(unit, threat)) continue;
      const remaining = remainingByCity.get(previousCityId) ?? 0;
      if (remaining <= 0) continue;
      assignedUnitIds.add(unit.id);
      assignments.push({ unit, threat });
      remainingByCity.set(previousCityId, remaining - 1);
    }
  }

  // Greedy fill: assign remaining capacity per threat (critical cities first, as
  // pre-sorted by detectEmergencyCityThreats), preferring ships already able to
  // fire, then closest. Each ship serves at most one city.
  for (const threat of coastalThreats) {
    const remaining = remainingByCity.get(threat.city.id) ?? 0;
    if (remaining <= 0) continue;
    const cityPosition = { x: threat.city.tileX, y: threat.city.tileY };
    const candidates = suitable
      .filter((unit) => !assignedUnitIds.has(unit.id))
      .map((unit) => ({
        unit,
        distance: input.getDistance({ x: unit.tileX, y: unit.tileY }, cityPosition),
        inRange: input.isInFiringRange(unit, threat),
      }))
      .filter(({ distance }) => distance <= input.reachRadius)
      .sort((a, b) => Number(b.inRange) - Number(a.inRange)
        || a.distance - b.distance
        || a.unit.id.localeCompare(b.unit.id));
    for (const candidate of candidates.slice(0, remaining)) {
      assignedUnitIds.add(candidate.unit.id);
      assignments.push({ unit: candidate.unit, threat });
    }
  }

  return assignments;
}

export function getEmergencyProductionThreats(
  threats: readonly EmergencyCityThreat[],
  hasAdequateLocalDefense: (threat: EmergencyCityThreat) => boolean,
): EmergencyCityThreat[] {
  return threats.filter((threat) => !hasAdequateLocalDefense(threat));
}

export function getEmergencyPurchaseThreats(
  threats: readonly EmergencyCityThreat[],
  hasFriendlyMilitaryOnCity: (city: City) => boolean,
): EmergencyCityThreat[] {
  return threats.filter((threat) => !hasFriendlyMilitaryOnCity(threat.city));
}
