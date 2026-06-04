import type { MapData, Tile } from '../../types/map';
import type { GridCoord } from '../../types/grid';
import type { IGridSystem } from '../grid/IGridSystem';
import type { UnitManager } from '../UnitManager';
import type { CityManager } from '../CityManager';
import type { NationManager } from '../NationManager';
import type { MovementSystem } from '../MovementSystem';
import type { PathfindingSystem } from '../PathfindingSystem';
import type { CombatSystem } from '../CombatSystem';
import type { InfrastructureSabotageSystem } from '../InfrastructureSabotageSystem';
import type { CovertSuspicionSystem } from '../diplomacy/CovertSuspicionSystem';
import type { DiplomacyManager } from '../DiplomacyManager';
import type { Unit } from '../../entities/Unit';
import type { City } from '../../entities/City';
import type { CovertPersonality } from '../../types/covertPersonality';
import { isCovertOperative } from '../../utils/unitRoleUtils';
import { isBarbarianNation } from '../../data/barbarians';
import { PRIVATEER } from '../../data/units';

export type CovertOpsLogger = (nationId: string, message: string) => void;

/** How far a covert unit looks for targets (local search — kept small for perf). */
const COVERT_SEARCH_RADIUS = 7;
/** Radius used to gauge nearby enemy military when scoring risk. */
const RISK_SCAN_RADIUS = 2;

type RiskLevel = 0 | 1 | 2; // low / medium / high

/**
 * AICovertOperationsSystem — teaches AI nations to USE existing covert units
 * (Spies, Agents, Privateers) as strategic tools, gated by covert personality,
 * current suspicion, and local risk. It reuses existing mechanics only:
 * pathfinding + movement to approach, InfrastructureSabotageSystem to sabotage,
 * the intel/suspicion hook for espionage, and CombatSystem for privateer raids.
 *
 * Rebels/Partisans are NOT handled here — they already act autonomously through
 * InsurgentBehaviorSystem (proxy warfare / harassment), which this system leaves
 * untouched. Run once per AI nation turn, before the main military movement pass.
 *
 * Deliberately lightweight: few covert units exist, searches are local (radius),
 * and a unit that finds nothing worthwhile simply holds rather than wandering.
 */
export class AICovertOperationsSystem {
  constructor(
    private readonly mapData: MapData,
    private readonly gridSystem: IGridSystem,
    private readonly unitManager: UnitManager,
    private readonly cityManager: CityManager,
    private readonly nationManager: NationManager,
    private readonly movementSystem: MovementSystem,
    private readonly pathfindingSystem: PathfindingSystem,
    private readonly combatSystem: CombatSystem,
    private readonly sabotageSystem: InfrastructureSabotageSystem,
    private readonly covertSuspicionSystem: CovertSuspicionSystem,
    private readonly diplomacyManager: DiplomacyManager,
    private readonly log: CovertOpsLogger = () => {},
  ) {}

  runForNation(nationId: string): void {
    const nation = this.nationManager.getNation(nationId);
    if (!nation || nation.isHuman) return; // humans drive their own covert units
    if (isBarbarianNation(nationId)) return;
    const personality = this.nationManager.getCovertPersonality(nationId);

    for (const unit of this.unitManager.getUnitsByOwner(nationId)) {
      if (this.unitManager.getUnit(unit.id) === undefined) continue;
      if (unit.movementPoints <= 0) continue;
      if (isCovertOperative(unit.unitType)) {
        this.runOperative(unit, nationId, personality); // Spy / Agent
      } else if (unit.unitType.id === PRIVATEER.id) {
        this.runPrivateer(unit, nationId, personality);
      }
    }
  }

  // ── Spy / Agent ──────────────────────────────────────────────────────────

  private runOperative(unit: Unit, nationId: string, personality: CovertPersonality): void {
    // Agents prioritise sabotage; Spies prioritise intelligence, then opportunistic sabotage.
    const prefersSabotage = unit.unitType.canSabotageBuildings === true;
    const sabotage = this.findSabotageTarget(unit, nationId);
    const intel = this.findIntelTarget(unit, nationId);

    const tryS = (): boolean => sabotage !== undefined && this.pursueSabotage(unit, nationId, personality, sabotage);
    const tryI = (): boolean => intel !== undefined && this.pursueIntel(unit, nationId, personality, intel);

    if (prefersSabotage) { if (tryS()) return; tryI(); }
    else { if (tryI()) return; tryS(); }
  }

  /** Espionage: approach a valuable foreign city and gather intel (raises suspicion). */
  private pursueIntel(unit: Unit, nationId: string, personality: CovertPersonality, city: City): boolean {
    const victimId = city.ownerId;
    const risk = this.assessRisk({ x: city.tileX, y: city.tileY }, nationId);
    if (!this.shouldAct(personality, victimId, nationId, risk)) {
      this.log(nationId, `mission rejected (espionage vs ${this.name(victimId)}): high suspicion/risk for ${personality.name} personality.`);
      return false;
    }
    if (unit.tileX === city.tileX && unit.tileY === city.tileY) {
      this.covertSuspicionSystem.reportIncident({ attackerNationId: nationId, victimNationId: victimId, action: 'spyIntel' });
      unit.movementPoints = 0;
      this.log(nationId, `${unit.unitType.name} gathered intelligence in ${city.name} (${this.name(victimId)}); approved by ${personality.name} personality.`);
      return true;
    }
    this.log(nationId, `Spy assigned to foreign city ${city.name} (${this.name(victimId)}).`);
    return this.moveToward(unit, city.tileX, city.tileY);
  }

  /** Sabotage: approach a valuable foreign improvement/building and raze it. */
  private pursueSabotage(unit: Unit, nationId: string, personality: CovertPersonality, target: Tile): boolean {
    const victimId = target.resourceOwnerNationId ?? target.ownerId ?? '';
    const risk = this.assessRisk({ x: target.x, y: target.y }, nationId);
    if (!this.shouldAct(personality, victimId, nationId, risk)) {
      this.log(nationId, `mission rejected (sabotage at ${target.x},${target.y}): high suspicion/risk for ${personality.name} personality.`);
      return false;
    }
    if (unit.tileX === target.x && unit.tileY === target.y) {
      const razed = this.sabotageSystem.canDestroyBuilding(unit)
        ? this.sabotageSystem.destroyBuilding(unit)
        : this.sabotageSystem.destroyImprovement(unit);
      if (razed) this.log(nationId, `${unit.unitType.name} sabotaged a target at (${target.x}, ${target.y}); approved by ${personality.name} personality.`);
      return razed;
    }
    this.log(nationId, `${unit.unitType.name} selected sabotage target at (${target.x}, ${target.y}).`);
    return this.moveToward(unit, target.x, target.y);
  }

  /** Nearest foreign city, preferring capitals then larger cities. */
  private findIntelTarget(unit: Unit, nationId: string): City | undefined {
    const from: GridCoord = { x: unit.tileX, y: unit.tileY };
    let best: City | undefined;
    let bestScore = -Infinity;
    for (const city of this.cityManager.getAllCities()) {
      if (city.ownerId === nationId || isBarbarianNation(city.ownerId)) continue;
      const dist = this.gridSystem.getDistance(from, { x: city.tileX, y: city.tileY });
      if (dist > COVERT_SEARCH_RADIUS) continue;
      const value = (city.isCapital ? 100 : 0) + city.population * 5 - dist;
      if (value > bestScore) { bestScore = value; best = city; }
    }
    return best;
  }

  /** Highest-value foreign improvement/building tile within range (buildings/wonders first). */
  private findSabotageTarget(unit: Unit, nationId: string): Tile | undefined {
    const tiles = this.gridSystem.getTilesInRange({ x: unit.tileX, y: unit.tileY }, COVERT_SEARCH_RADIUS, this.mapData, { includeCenter: true });
    let best: Tile | undefined;
    let bestValue = 0;
    for (const tile of tiles) {
      const owner = tile.resourceOwnerNationId ?? tile.ownerId;
      if (!owner || owner === nationId || isBarbarianNation(owner)) continue;
      let value = 0;
      if (tile.wonderId !== undefined) value = 4;
      else if (tile.buildingId !== undefined) value = 3;
      else if (tile.improvementId !== undefined) value = tile.resourceId !== undefined ? 2 : 1; // resource improvements worth more
      if (value === 0) continue;
      value -= this.gridSystem.getDistance({ x: unit.tileX, y: unit.tileY }, { x: tile.x, y: tile.y }) * 0.05;
      if (value > bestValue) { bestValue = value; best = tile; }
    }
    return best;
  }

  // ── Privateer ──────────────────────────────────────────────────────────────

  /** Economic disruption: hunt soft maritime targets (work boats, civilian vessels), avoid stronger fleets. */
  private runPrivateer(unit: Unit, nationId: string, personality: CovertPersonality): void {
    const target = this.findPrivateerTarget(unit, nationId);
    if (!target) return;
    const risk = this.assessRisk({ x: target.tileX, y: target.tileY }, nationId);
    if (!this.shouldAct(personality, target.ownerId, nationId, risk)) {
      this.log(nationId, `Privateer held back from ${this.name(target.ownerId)} target: ${personality.name} personality avoids the risk.`);
      return;
    }
    this.log(nationId, `Privateer targeting ${this.name(target.ownerId)} ${target.unitType.name}.`);
    if (this.gridSystem.isAdjacent({ x: unit.tileX, y: unit.tileY }, { x: target.tileX, y: target.tileY })) {
      this.combatSystem.tryAttack(unit, target.tileX, target.tileY);
      return;
    }
    const path = this.pathfindingSystem.findPath(unit, target.tileX, target.tileY, { respectMovementPoints: false });
    if (path && path.length > 1) this.movementSystem.moveAlongPath(unit, path);
    if (unit.movementPoints > 0 && this.gridSystem.isAdjacent({ x: unit.tileX, y: unit.tileY }, { x: target.tileX, y: target.tileY })) {
      this.combatSystem.tryAttack(unit, target.tileX, target.tileY);
    }
  }

  /** Nearest weak foreign naval target — civilian vessels first, then weaker warships. */
  private findPrivateerTarget(unit: Unit, nationId: string): Unit | undefined {
    const from: GridCoord = { x: unit.tileX, y: unit.tileY };
    let best: Unit | undefined;
    let bestScore = -Infinity;
    for (const other of this.unitManager.getAllUnits()) {
      if (other.ownerId === nationId || isBarbarianNation(other.ownerId)) continue;
      if (other.unitType.isNaval !== true) continue;
      const dist = this.gridSystem.getDistance(from, { x: other.tileX, y: other.tileY });
      if (dist > COVERT_SEARCH_RADIUS) continue;
      const isCivilian = other.unitType.category === 'civilian'; // work boats, cargo/transport ships
      const isWeakWarship = other.unitType.baseStrength > 0 && other.unitType.baseStrength < unit.unitType.baseStrength;
      if (!isCivilian && !isWeakWarship) continue; // never pick a superior war fleet
      const score = (isCivilian ? 50 : 0)
        + (other.unitType.id === 'work_boat' ? 20 : 0)
        - dist;
      if (score > bestScore) { bestScore = score; best = other; }
    }
    return best;
  }

  // ── Shared evaluation ──────────────────────────────────────────────────────

  /** Local risk: nearby foreign military raises it; capital proximity makes it high. */
  private assessRisk(target: GridCoord, nationId: string): RiskLevel {
    let nearbyMilitary = 0;
    for (const other of this.unitManager.getAllUnits()) {
      if (other.ownerId === nationId || isBarbarianNation(other.ownerId)) continue;
      if (other.unitType.baseStrength <= 0) continue;
      if (this.gridSystem.getDistance(target, { x: other.tileX, y: other.tileY }) <= RISK_SCAN_RADIUS) nearbyMilitary += 1;
    }
    for (const city of this.cityManager.getAllCities()) {
      if (city.ownerId === nationId) continue;
      if (city.isCapital && this.gridSystem.getDistance(target, { x: city.tileX, y: city.tileY }) <= RISK_SCAN_RADIUS) {
        return 2;
      }
    }
    if (nearbyMilitary >= 2) return 2;
    if (nearbyMilitary === 1) return 1;
    return 0;
  }

  /**
   * Personality + suspicion + risk gate. Risk-averse personalities refuse high
   * risk; honorable/merchant refuse once suspicion is already high; otherwise a
   * simple desire score (covertUsageBias + risk tolerance − risk) decides.
   */
  private shouldAct(personality: CovertPersonality, victimId: string, nationId: string, risk: RiskLevel): boolean {
    if (!victimId || victimId === nationId) return false;
    if (risk >= 2 && personality.riskTolerance < 1.0) return false;
    const suspicion = this.diplomacyManager.getSuspicion(nationId, victimId);
    if (suspicion >= 50 && personality.covertUsageBias < 0) return false; // honorable/merchant back off
    const desire = personality.covertUsageBias + (personality.riskTolerance - 1) - risk * 0.3;
    return desire > -0.2;
  }

  private moveToward(unit: Unit, x: number, y: number): boolean {
    if (unit.tileX === x && unit.tileY === y) return true;
    const path = this.pathfindingSystem.findPath(unit, x, y, { respectMovementPoints: false });
    if (!path || path.length <= 1) return false;
    this.movementSystem.moveAlongPath(unit, path);
    return unit.tileX === x && unit.tileY === y;
  }

  private name(nationId: string): string {
    return this.nationManager.getNation(nationId)?.name ?? nationId;
  }
}
