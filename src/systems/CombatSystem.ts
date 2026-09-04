import type { Unit } from '../entities/Unit';
import type { City } from '../entities/City';
import { getAllegianceType } from '../entities/UnitType';
import { isCovertOperative } from '../utils/unitRoleUtils';
import {
  resolveCombat,
  resolveUnitVsCity,
  resolveRangedCombat,
  resolveRangedVsCity,
  type CombatResult,
  type CityCombatResult,
} from './CombatResolver';
import { captureCity } from './CityCombat';
import { CITY_BASE_DEFENSE, CITY_BASE_HEALTH } from '../data/cities';

/**
 * Percentage of a city's maximum defensive health at/below which an original
 * capital is considered to have collapsed. An attack that pushes the original
 * capital from above this line to below it makes the defender militarily defeated
 * and triggers capitulation to the responsible attacker — no capture required.
 * Scenario-configurable via ScenarioMeta.originalCapitalCollapsePercent; this is
 * the fallback. 0 disables the rule.
 */
export const DEFAULT_ORIGINAL_CAPITAL_COLLAPSE_PERCENT = 10;
/** Default collapse threshold expressed in city HP (used by the default config). */
export const ORIGINAL_CAPITAL_COLLAPSE_HEALTH =
  CITY_BASE_HEALTH * DEFAULT_ORIGINAL_CAPITAL_COLLAPSE_PERCENT / 100;

/**
 * Clamp an authored collapse percentage to a valid 0..100 integer, falling back to
 * {@link DEFAULT_ORIGINAL_CAPITAL_COLLAPSE_PERCENT} when absent or invalid.
 */
export function resolveOriginalCapitalCollapsePercent(value: number | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100) {
    return Math.floor(value);
  }
  return DEFAULT_ORIGINAL_CAPITAL_COLLAPSE_PERCENT;
}
import { isMilitaryUnitType } from '../utils/unitRoleUtils';
import {
  getCityIntegrationProgress,
  getNationCityIntegrationCounts,
  getNationOccupationGoldCost,
} from './CityIntegrationSystem';
import { UnitManager } from './UnitManager';
import { TurnManager } from './TurnManager';
import { CityManager } from './CityManager';
import { ProductionSystem } from './ProductionSystem';
import type { MapData } from '../types/map';
import type { DiplomacyManager } from './DiplomacyManager';
import type { CovertSuspicionSystem, CovertActionKind } from './diplomacy/CovertSuspicionSystem';
import type { IGridSystem } from './grid/IGridSystem';
import type { PolicySystem } from './PolicySystem';
import { isEmbarked } from './UnitMovementRules';
import type { CityDefenseSystem } from './CityDefenseSystem';
import type { NationCollapseSystem } from './NationCollapseSystem';
import type { CityIntegrationSystem } from './CityIntegrationSystem';

export interface CombatEvent {
  attacker: Unit;
  defender: Unit;
  result: CombatResult;
}

export interface CityCombatEvent {
  attacker: Unit;
  city: City;
  result: CityCombatResult;
  captured: boolean;
  previousOwnerId?: string;
  /** Capital capture was converted into vassalization and ownership restoration. */
  capitalVassalizationResolved?: boolean;
}

export interface CombatRejectedEvent {
  attacker: Unit;
  target: Unit;
  reason: string;
}

export interface WarRequiredEvent {
  attackerId: string;
  targetNationId: string;
  attacker: Unit;
  tileX: number;
  tileY: number;
  source: CombatActionSource;
}

export type CombatActionSource = 'human-ui' | 'system';

interface CombatActionOptions {
  source?: CombatActionSource;
  /**
   * Allow the attack to resolve outside the attacker's normal turn slot. Used by
   * the barbarian driver (BarbarianSystem), which acts during a controlled phase
   * rather than taking a turn in the participant turn order. Never set for
   * player/AI actions.
   */
  allowOutOfTurn?: boolean;
}

type CombatListener = (e: CombatEvent) => void;
type CityCombatListener = (e: CityCombatEvent) => void;
type CombatRejectedListener = (e: CombatRejectedEvent) => void;
type WarRequiredListener = (e: WarRequiredEvent) => void;
type UnitCombatBlocker = (unit: Unit) => boolean;
type PeacekeepingCombatAuthorizer = (attacker: Unit, target: Unit, tileOwnerId?: string) => boolean;
type CapitalCaptureResolver = (city: City, previousOwnerId: string, captorNationId: string) => boolean;

const EMBARKED_DEFENSE_MULTIPLIER = 0.5;
const FOREIGN_INSURGENT_UNIT_IDS: ReadonlySet<string> = new Set(['partisans', 'rebels']);

export function getForeignInsurgentStrengthMultiplier(
  unitTypeId: string,
  attackerNationId: string,
  territorialOwnerNationId: string | undefined,
  effectivenessPercent: number,
): number {
  if (!FOREIGN_INSURGENT_UNIT_IDS.has(unitTypeId)) return 1;
  if (!territorialOwnerNationId || territorialOwnerNationId === attackerNationId) return 1;
  return Math.max(0, 1 + (effectivenessPercent / 100));
}

/**
 * CombatSystem hanterar strid mellan enheter och mot städer.
 *
 * CombatSystem är Phaser-fritt: input-routing sker i scenen, medan detta
 * system bara validerar och applicerar stridsregler.
 */
export class CombatSystem {
  private readonly unitManager: UnitManager;
  private readonly turnManager: TurnManager;
  private readonly cityManager: CityManager;
  private readonly productionSystem: ProductionSystem;
  private readonly mapData: MapData;
  private readonly diplomacyManager: DiplomacyManager | null;
  private readonly listeners: CombatListener[] = [];
  private readonly cityCombatListeners: CityCombatListener[] = [];
  private readonly rejectedListeners: CombatRejectedListener[] = [];
  private readonly warRequiredListeners: WarRequiredListener[] = [];
  // Optional: turns covert combat (privateer/insurgent raids, caught insurgents)
  // into Suspicion. Injected after construction to avoid a constructor cycle.
  private covertSuspicionSystem: CovertSuspicionSystem | null = null;
  // Diagnostic-only: lightweight per-city siege tracking so a capture can report
  // how long the city was under sustained pressure. Never read by gameplay.
  private readonly siegeTracker = new Map<string, { firstRound: number; lastRound: number; attacks: number }>();
  private capitalCaptureResolver: CapitalCaptureResolver | null = null;
  private subjugationResolver: CapitalCaptureResolver | null = null;
  private originalCapitalCollapseResolver: CapitalCaptureResolver | null = null;
  /** Original-capital collapse threshold in city HP; scenario-configurable. */
  private originalCapitalCollapseHealth = ORIGINAL_CAPITAL_COLLAPSE_HEALTH;

  constructor(
    unitManager: UnitManager,
    turnManager: TurnManager,
    cityManager: CityManager,
    productionSystem: ProductionSystem,
    mapData: MapData,
    diplomacyManager: DiplomacyManager | undefined,
    private readonly gridSystem: IGridSystem,
    private readonly isUnitCombatBlocked: UnitCombatBlocker = () => false,
    private readonly policySystem?: PolicySystem,
    private readonly canResolvePeacekeepingCombat: PeacekeepingCombatAuthorizer = () => false,
    private readonly cityDefenseSystem?: CityDefenseSystem,
    private readonly nationCollapseSystem?: NationCollapseSystem,
    private readonly cityIntegrationSystem?: CityIntegrationSystem,
    // Diagnostic-only structured logger for city-conquest analysis. Pure
    // instrumentation: it never influences combat resolution or gameplay.
    private readonly conquestDiagnosticLog?: (nationId: string, message: string) => void,
  ) {
    this.unitManager = unitManager;
    this.turnManager = turnManager;
    this.cityManager = cityManager;
    this.productionSystem = productionSystem;
    this.mapData = mapData;
    this.diplomacyManager = diplomacyManager ?? null;
  }

  setCovertSuspicionSystem(system: CovertSuspicionSystem): void {
    this.covertSuspicionSystem = system;
  }

  setCapitalCaptureResolver(resolver: CapitalCaptureResolver): void {
    this.capitalCaptureResolver = resolver;
  }

  /**
   * Last-city safeguard: invoked when a capture leaves the defeated nation with no
   * cities and the residence-capital path did not already resolve a vassalization.
   * Mirrors {@link setCapitalCaptureResolver} so a nation whose capital was lost in
   * an earlier war (and therefore carries no residence-capital flag) is still routed
   * through the vassal system before outright collapse.
   */
  setSubjugationResolver(resolver: CapitalCaptureResolver): void {
    this.subjugationResolver = resolver;
  }

  /**
   * Original-capital collapse: invoked when an attack pushes a nation's own original
   * capital from at-or-above {@link ORIGINAL_CAPITAL_COLLAPSE_HEALTH} to below it.
   * The defender capitulates to the attacker responsible for that crossing hit — no
   * capture required. Returns true when capitulation was actually applied.
   */
  setOriginalCapitalCollapseResolver(resolver: CapitalCaptureResolver): void {
    this.originalCapitalCollapseResolver = resolver;
  }

  /**
   * Configure the original-capital collapse threshold from an authored scenario
   * percentage (0..100 of maximum city health). 0 disables the rule.
   */
  setOriginalCapitalCollapsePercent(percent: number): void {
    this.originalCapitalCollapseHealth =
      CITY_BASE_HEALTH * resolveOriginalCapitalCollapsePercent(percent) / 100;
  }

  getOriginalCapitalCollapsePercent(): number {
    return this.originalCapitalCollapseHealth / CITY_BASE_HEALTH * 100;
  }

  on(callback: CombatListener): void {
    this.listeners.push(callback);
  }

  onCityCombat(callback: CityCombatListener): void {
    this.cityCombatListeners.push(callback);
  }

  onRejected(callback: CombatRejectedListener): void {
    this.rejectedListeners.push(callback);
  }

  onWarRequired(callback: WarRequiredListener): void {
    this.warRequiredListeners.push(callback);
  }

  tryAttack(
    attacker: Unit,
    tileX: number,
    tileY: number,
    options: CombatActionOptions = {},
  ): boolean {
    // 1. Must be attacker's nation's turn (barbarians act out of turn via their
    // own driver, which sets allowOutOfTurn).
    if (!options.allowOutOfTurn && this.turnManager.getCurrentNation().id !== attacker.ownerId) {
      return false;
    }
    if (this.isUnitCombatBlocked(attacker)) return false;
    if (isEmbarked(attacker, this.mapData)) return false;

    // 2. Must have movement points
    if (attacker.movementPoints <= 0) {
      return false;
    }

    // 3. Must have combat strength for the chosen path
    const range = attacker.unitType.range ?? 1;
    const isRanged = range >= 2;
    const meleeStrength = attacker.unitType.baseStrength;
    const rangedStrength = attacker.unitType.rangedStrength ?? 0;
    if (isRanged ? rangedStrength <= 0 : meleeStrength <= 0) {
      return false;
    }

    // 4. Must be within active grid range
    const attackerCoord = { x: attacker.tileX, y: attacker.tileY };
    const targetCoord = { x: tileX, y: tileY };
    const dist = this.gridSystem.getDistance(attackerCoord, targetCoord);
    if (range === 1) {
      // Melee: active-grid adjacent only
      if (!this.gridSystem.isAdjacent(attackerCoord, targetCoord)) return false;
    } else {
      // Ranged: active-grid range distance
      if (dist < 1 || dist > range) return false;
    }

    // 5a. Covert operatives (Spy/Agent) only engage hostile covert operatives
    // (spy-vs-spy). They never attack cities or conventional units. Combat needs
    // no war (both sides are hidden-nation) and creates no diplomatic effects.
    if (isCovertOperative(attacker.unitType)) {
      const covertDefender = this.unitManager.getCovertOperativesAt(tileX, tileY)
        .find((other) => other.ownerId !== attacker.ownerId);
      if (covertDefender === undefined) return false;
      return this.executeUnitCombat(attacker, covertDefender, isRanged);
    }

    // 5. Find target: garrison unit first, then city
    const targetUnit = this.unitManager.getUnitAt(tileX, tileY);
    const targetCity = this.cityManager.getCityAt(tileX, tileY);

    if (targetUnit && targetUnit.ownerId !== attacker.ownerId) {
      // hiddenNation units (e.g. Privateers) perform deniable attacks: they may
      // strike enemy units without a formal war. This bypasses only the war
      // requirement for unit targets — no war is declared and no diplomatic
      // values change. Combat itself resolves through the normal pipeline.
      const isHiddenNationAttack = getAllegianceType(attacker.unitType) === 'hiddenNation';
      // A hidden-nation defender (Privateer, Spy, Agent, Rebels, Partisans) can be
      // attacked freely by anyone: no war required, declared, or triggered. This
      // makes insurgents permanently valid combatants for all nations.
      const targetIsHiddenNation = getAllegianceType(targetUnit.unitType) === 'hiddenNation';
      if (isHiddenNationAttack) {
        console.info(
          `${attacker.unitType.name} attacked ${targetUnit.ownerId}'s ${targetUnit.unitType.name} while operating under hidden allegiance.`,
        );
      } else if (targetIsHiddenNation) {
        // Deniable/insurgent target — no war check.
      } else if (
        this.diplomacyManager
        && !this.diplomacyManager.canAttack(attacker.ownerId, targetUnit.ownerId)
        && !this.canResolvePeacekeepingCombat(attacker, targetUnit, this.mapData.tiles[tileY]?.[tileX]?.ownerId)
      ) {
        this.notifyWarRequired(attacker, targetUnit.ownerId, tileX, tileY, options.source ?? 'system');
        return false;
      }
      return this.executeUnitCombat(attacker, targetUnit, isRanged);
    }

    if (targetCity && targetCity.ownerId !== attacker.ownerId) {
      if (this.diplomacyManager && !this.diplomacyManager.canAttack(attacker.ownerId, targetCity.ownerId)) {
        this.notifyWarRequired(attacker, targetCity.ownerId, tileX, tileY, options.source ?? 'system');
        return false;
      }
      return this.executeCityCombat(attacker, targetCity, isRanged);
    }

    return false;
  }

  private executeUnitCombat(attacker: Unit, target: Unit, isRanged = false): boolean {
    if (!isRanged && !attacker.unitType.isNaval && target.unitType.isNaval) {
      this.notifyRejected(attacker, target, 'Land units cannot melee attack naval units');
      return false;
    }

    const modifiers = {
      attackerStrengthBonus: this.getOwnedTerritoryCombatBonus(attacker),
      attackerStrengthMultiplier: this.getForeignInsurgentStrengthMultiplier(attacker, target.tileX, target.tileY),
      defenderStrengthBonus: this.getOwnedTerritoryCombatBonus(target),
      defenderStrengthMultiplier: isEmbarked(target, this.mapData) ? EMBARKED_DEFENSE_MULTIPLIER : 1,
    };
    const result = isRanged
      ? resolveRangedCombat(attacker, target, modifiers)
      : resolveCombat(attacker, target, modifiers);

    attacker.health = Math.max(0, attacker.health - result.attackerDamageTaken);
    target.health = Math.max(0, target.health - result.defenderDamageTaken);

    attacker.movementPoints = 0;

    this.unitManager.notifyDamaged(attacker);
    this.unitManager.notifyDamaged(target);

    if (result.attackerDied) this.unitManager.removeUnit(attacker.id);
    if (result.defenderDied) this.unitManager.removeUnit(target.id);

    this.reportCovertUnitCombat(attacker, target, result);

    for (const cb of this.listeners) cb({ attacker, defender: target, result });

    return true;
  }

  /**
   * Generate Suspicion from covert unit combat: a hidden-nation raider
   * (privateer / rebels / partisans) striking another nation, and a hidden-nation
   * insurgent caught and destroyed by a conventional force (conclusive exposure).
   * Spy-vs-spy duels (both covert) create no national victim and are ignored.
   */
  private reportCovertUnitCombat(attacker: Unit, target: Unit, result: CombatResult): void {
    const covert = this.covertSuspicionSystem;
    if (!covert || attacker.ownerId === target.ownerId) return;
    const attackerHidden = getAllegianceType(attacker.unitType) === 'hiddenNation';
    const targetHidden = getAllegianceType(target.unitType) === 'hiddenNation';

    if (attackerHidden && !targetHidden) {
      covert.reportIncident({
        attackerNationId: attacker.ownerId,
        victimNationId: target.ownerId,
        action: covertActionForUnit(attacker),
        valuable: result.defenderDied,
      });
    }

    // A deniable raider killed in the open by a conventional force is exposed.
    if (!attackerHidden && targetHidden && result.defenderDied && isExposableRaider(target)) {
      covert.reportIncident({
        attackerNationId: target.ownerId,
        victimNationId: attacker.ownerId,
        action: 'insurgentExposed',
      });
    }
  }

  private reportCovertCityCombat(attacker: Unit, city: City): void {
    const covert = this.covertSuspicionSystem;
    if (!covert || attacker.ownerId === city.ownerId) return;
    if (getAllegianceType(attacker.unitType) !== 'hiddenNation') return;
    covert.reportIncident({
      attackerNationId: attacker.ownerId,
      victimNationId: city.ownerId,
      action: covertActionForUnit(attacker),
    });
  }

  private executeCityCombat(attacker: Unit, city: City, isRanged = false): boolean {
    const cityDefenseMultiplier = this.cityDefenseSystem?.getDefenseMultiplier(city) ?? 1;
    const modifiers = {
      attackerStrengthBonus: this.getOwnedTerritoryCombatBonus(attacker),
      attackerStrengthMultiplier: this.getForeignInsurgentStrengthMultiplier(attacker, city.tileX, city.tileY),
      cityDefenseBonus: this.policySystem?.getFlatModifierTotal(city.ownerId, 'cityDefenseFlat') ?? 0,
      cityDefenseMultiplier,
      cityDamageTakenMultiplier: this.cityDefenseSystem?.getDamageTakenMultiplier(city) ?? 1,
    };
    const result = isRanged
      ? resolveRangedVsCity(attacker, city, modifiers)
      : resolveUnitVsCity(attacker, city, modifiers);

    // Diagnostic snapshot (pure instrumentation): capture the pre-attack state
    // before any mutation so a resulting capture can be reconstructed.
    const diagRound = this.turnManager.getCurrentRound();
    const effectiveCityDefense = Math.max(
      1,
      Math.floor((CITY_BASE_DEFENSE + (modifiers.cityDefenseBonus ?? 0)) * (modifiers.cityDefenseMultiplier ?? 1)),
    );
    const preAttack = {
      round: diagRound,
      cityHealth: city.health,
      cityPopulation: city.population,
      cityOriginNationId: city.originNationId,
      previousOwnerId: city.ownerId,
      preIntegrationState: getCityIntegrationProgress(city, diagRound).state,
      garrisonAtTile: this.unitManager.getUnitAt(city.tileX, city.tileY) !== null,
      effectiveCityDefense,
    };
    this.recordSiegeAttack(city, diagRound);

    attacker.health = Math.max(0, attacker.health - result.attackerDamageTaken);
    // Ranged cannot capture: city stays at 1 HP minimum
    city.health = isRanged
      ? Math.max(1, city.health - result.cityDamageTaken)
      : Math.max(0, city.health - result.cityDamageTaken);

    city.lastTurnAttacked = this.turnManager.getCurrentRound();

    attacker.movementPoints = 0;

    this.unitManager.notifyDamaged(attacker);

    if (result.attackerDied) {
      this.unitManager.removeUnit(attacker.id);
    }

    // Original-capital collapse capitulation: an attack that pushes a nation's own
    // original capital from at-or-above the defensive collapse threshold to below it
    // makes the defender militarily defeated, and it capitulates to the attacker
    // responsible for that crossing hit — no capture required. Attribution keys on
    // the crossing (was >= threshold, now < threshold) so credit is unambiguous in a
    // coalition war, and a capital already below the line never re-triggers.
    let capitulationResolved = false;
    if (city.isOriginalCapital
      && city.ownerId === city.originNationId
      && this.originalCapitalCollapseResolver
      && this.originalCapitalCollapseHealth > 0
      && preAttack.cityHealth >= this.originalCapitalCollapseHealth
      && city.health < this.originalCapitalCollapseHealth) {
      capitulationResolved = this.originalCapitalCollapseResolver(city, city.ownerId, attacker.ownerId);
      // The capital collapsed defensively but was not razed: keep it standing as the
      // new vassal's city rather than leaving an uncaptured 0-HP city behind.
      if (capitulationResolved) city.health = Math.max(city.health, 1);
    }

    let captured = false;
    let previousOwnerId: string | undefined;
    let capitalVassalizationResolved = false;
    // A resolved capitulation ends the war and vassalizes the defender, so this same
    // attack must not go on to capture the city or collapse the nation.
    if (!isRanged && result.cityFell && !result.attackerDied && !capitulationResolved) {
      previousOwnerId = city.ownerId;
      captureCity(
        city,
        attacker,
        this.cityManager,
        this.mapData,
        this.productionSystem,
        this.unitManager,
        this.gridSystem,
        this.cityIntegrationSystem,
      );
      captured = true;
      if (city.isResidenceCapital && this.capitalCaptureResolver) {
        capitalVassalizationResolved = this.capitalCaptureResolver(city, previousOwnerId, attacker.ownerId);
      }
      // Final-city safeguard: if this capture wiped out the defeated nation's last
      // city and the residence-capital path did not fire (e.g. the capital was lost
      // in a prior war, so no city carried the flag), still try to vassalize before
      // collapse. The resolver restores this city to the defeated nation.
      if (!capitalVassalizationResolved
        && this.subjugationResolver
        && this.cityManager.getCitiesByOwner(previousOwnerId).length === 0) {
        capitalVassalizationResolved = this.subjugationResolver(city, previousOwnerId, attacker.ownerId);
      }
      if (!capitalVassalizationResolved) {
        this.collapsePreviousOwnerWithoutCities(previousOwnerId, attacker.ownerId, city);
      }
      this.emitConquestDiagnostic(attacker, city, result, preAttack);
    }

    this.reportCovertCityCombat(attacker, city);

    for (const cb of this.cityCombatListeners) {
      cb({ attacker, city, result, captured, previousOwnerId, capitalVassalizationResolved });
    }

    return true;
  }

  private collapsePreviousOwnerWithoutCities(previousOwnerId: string, conquerorNationId: string, capturedCity: City): void {
    if (!this.nationCollapseSystem) return;
    if (this.cityManager.getCitiesByOwner(previousOwnerId).length > 0) return;
    this.nationCollapseSystem.collapse({
      nationId: previousOwnerId,
      conquerorNationId,
      triggerCity: capturedCity,
      reason: 'no_valid_survival_state',
    });
  }

  private notifyRejected(attacker: Unit, target: Unit, reason: string): void {
    for (const cb of this.rejectedListeners) cb({ attacker, target, reason });
  }

  /**
   * Diagnostic-only siege tracking. Records each attack (ranged or melee) on a
   * city so a resulting capture can report how long the city was under sustained
   * pressure. A gap of more than 4 rounds since the last attack starts a fresh
   * siege window. Never read by gameplay.
   */
  private recordSiegeAttack(city: City, round: number): void {
    const prior = this.siegeTracker.get(city.id);
    if (prior === undefined || round - prior.lastRound > 4) {
      this.siegeTracker.set(city.id, { firstRound: round, lastRound: round, attacks: 1 });
      return;
    }
    prior.lastRound = round;
    prior.attacks += 1;
  }

  /**
   * Emit one structured, greppable line describing a city capture. Pure
   * instrumentation for the conquest diagnostic run — reads existing game state
   * and existing combat values only; introduces no second combat model.
   */
  private emitConquestDiagnostic(
    attacker: Unit,
    city: City,
    result: CityCombatResult,
    preAttack: {
      round: number;
      cityHealth: number;
      cityPopulation: number;
      cityOriginNationId: string;
      previousOwnerId: string;
      preIntegrationState: string;
      garrisonAtTile: boolean;
      effectiveCityDefense: number;
    },
  ): void {
    if (!this.conquestDiagnosticLog) return;
    const log = this.conquestDiagnosticLog;

    const round = preAttack.round;
    const newOwnerId = attacker.ownerId;
    const defenderId = preAttack.previousOwnerId;

    const captureType = newOwnerId === preAttack.cityOriginNationId
      ? 'liberation'
      : preAttack.previousOwnerId !== preAttack.cityOriginNationId
        ? 'reconquest'
        : 'original';
    const resultingState = captureType === 'liberation' ? 'integrated' : 'occupied';

    // Local tactical snapshot around the city, using Manhattan distance to match
    // the game's orthogonal movement. R=3 "local", R=6 "reinforce" radius.
    const cx = city.tileX;
    const cy = city.tileY;
    const dist = (u: Unit): number => Math.abs(u.tileX - cx) + Math.abs(u.tileY - cy);
    let localAtk = 0; let localAtkStr = 0;
    let localDef = 0; let localDefStr = 0;
    let reinforceDef = 0; let nearestDefDist = -1;
    for (const u of this.unitManager.getAllUnits()) {
      if (!isMilitaryUnitType(u.unitType)) continue;
      const d = dist(u);
      if (u.ownerId === newOwnerId) {
        if (d <= 3) { localAtk += 1; localAtkStr += u.unitType.baseStrength; }
      } else if (u.ownerId === defenderId) {
        if (d <= 3) { localDef += 1; localDefStr += u.unitType.baseStrength; }
        if (d <= 6 && (u.tileX !== cx || u.tileY !== cy)) reinforceDef += 1;
        if (d > 0 && (nearestDefDist < 0 || d < nearestDefDist)) nearestDefDist = d;
      }
    }

    // Nation-wide strength (sum of existing baseStrength over military units).
    const milStrength = (ownerId: string): number => this.unitManager
      .getUnitsByOwner(ownerId)
      .reduce((sum, u) => sum + (isMilitaryUnitType(u.unitType) ? u.unitType.baseStrength : 0), 0);
    const attackerCities = this.cityManager.getCitiesByOwner(newOwnerId).length;
    const defenderCities = this.cityManager.getCitiesByOwner(defenderId).length;

    // War context from the existing diplomacy relation (A/B follow alphabetical
    // pairKey ordering, documented on DiplomacyRelation).
    let warStart = -1; let aggressor = 'n/a'; let defenderCitiesLostThisWar = -1;
    if (this.diplomacyManager) {
      const rel = this.diplomacyManager.getRelation(newOwnerId, defenderId);
      warStart = rel.lastWarDeclarationTurn ?? -1;
      aggressor = rel.aggressorNationId ?? 'n/a';
      const defenderIsA = [newOwnerId, defenderId].sort()[0] === defenderId;
      defenderCitiesLostThisWar = defenderIsA ? rel.citiesLostA : rel.citiesLostB;
    }
    const warDuration = warStart >= 0 ? round - warStart : -1;

    // Occupation burden (existing integration helpers).
    const atkCounts = getNationCityIntegrationCounts(newOwnerId, this.cityManager, round);
    const defCounts = getNationCityIntegrationCounts(defenderId, this.cityManager, round);
    const atkOccCost = getNationOccupationGoldCost(newOwnerId, this.cityManager, round);

    const siege = this.siegeTracker.get(city.id);
    const siegeStart = siege?.firstRound ?? round;
    const siegeTurns = round - siegeStart;
    const siegeAttacks = siege?.attacks ?? 1;
    this.siegeTracker.delete(city.id);

    const parts = [
      `[ConquestDiag] capture ${city.name}`,
      `type=${captureType}`,
      `resultState=${resultingState}`,
      `from=${defenderId}`,
      `to=${newOwnerId}`,
      `origin=${preAttack.cityOriginNationId}`,
      `pop=${preAttack.cityPopulation}`,
      `cityDefense=${preAttack.effectiveCityDefense}`,
      `cityHpBeforeFinalHit=${preAttack.cityHealth}`,
      `finalHit=${result.cityDamageTaken}`,
      `preState=${preAttack.preIntegrationState}`,
      `garrisonOnTile=${preAttack.garrisonAtTile ? 1 : 0}`,
      `attacker=${attacker.unitType.name}`,
      `attackerStr=${attacker.unitType.baseStrength}`,
      `attackerHpPct=${Math.round((attacker.health / attacker.unitType.baseHealth) * 100)}`,
      `localAtk=${localAtk}`,
      `localAtkStr=${localAtkStr}`,
      `localDef=${localDef}`,
      `localDefStr=${localDefStr}`,
      `reinforceDefR6=${reinforceDef}`,
      `nearestDefDist=${nearestDefDist}`,
      `siegeTurns=${siegeTurns}`,
      `siegeAttacks=${siegeAttacks}`,
      `warStart=${warStart}`,
      `warDuration=${warDuration}`,
      `aggressor=${aggressor}`,
      `defCitiesLostThisWar=${defenderCitiesLostThisWar}`,
      `atkCities=${attackerCities}`,
      `defCities=${defenderCities}`,
      `atkMilStr=${milStrength(newOwnerId)}`,
      `defMilStr=${milStrength(defenderId)}`,
      `atkOcc=${atkCounts.occupied}`,
      `atkRec=${atkCounts.recovering}`,
      `atkOccCost=${atkOccCost}`,
      `defOcc=${defCounts.occupied}`,
      `defRec=${defCounts.recovering}`,
    ];
    log(newOwnerId, parts.join(' '));
  }

  private getOwnedTerritoryCombatBonus(unit: Unit): number {
    const tile = this.mapData.tiles[unit.tileY]?.[unit.tileX];
    if (tile?.ownerId !== unit.ownerId) return 0;
    return this.policySystem?.getFlatModifierTotal(unit.ownerId, 'ownedTerritoryCombatFlat') ?? 0;
  }

  private getForeignInsurgentStrengthMultiplier(attacker: Unit, tileX: number, tileY: number): number {
    const territorialOwnerId = this.mapData.tiles[tileY]?.[tileX]?.ownerId;
    const percent = this.policySystem?.getPercentModifierTotal(
      attacker.ownerId,
      'foreignInsurgentEffectivenessPercent',
    ) ?? 0;
    return getForeignInsurgentStrengthMultiplier(
      attacker.unitType.id,
      attacker.ownerId,
      territorialOwnerId,
      percent,
    );
  }

  private notifyWarRequired(
    attacker: Unit,
    targetNationId: string,
    tileX: number,
    tileY: number,
    source: CombatActionSource,
  ): void {
    for (const cb of this.warRequiredListeners) {
      cb({ attackerId: attacker.ownerId, targetNationId, attacker, tileX, tileY, source });
    }
  }
}

/** Map a hidden-nation raider to the covert action kind it represents. */
function covertActionForUnit(unit: Unit): CovertActionKind {
  if (unit.unitType.isInsurgentForce === true) {
    return unit.unitType.id === 'partisans' ? 'partisanRaid' : 'rebelActivity';
  }
  return 'privateerRaid';
}

/** A deniable raider whose destruction conclusively exposes its backer. */
function isExposableRaider(unit: Unit): boolean {
  return unit.unitType.isInsurgentForce === true || unit.unitType.id === 'privateer';
}
