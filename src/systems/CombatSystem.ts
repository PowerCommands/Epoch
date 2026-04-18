import type { Unit } from '../entities/Unit';
import type { City } from '../entities/City';
import {
  resolveCombat,
  resolveUnitVsCity,
  resolveRangedCombat,
  resolveRangedVsCity,
  type CombatResult,
  type CityCombatResult,
} from './CombatResolver';
import { captureCity } from './CityCombat';
import { UnitManager } from './UnitManager';
import { TurnManager } from './TurnManager';
import { CityManager } from './CityManager';
import { ProductionSystem } from './ProductionSystem';
import type { MapData } from '../types/map';
import type { DiplomacyManager } from './DiplomacyManager';
import type { IGridSystem } from './grid/IGridSystem';

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
}

type CombatListener = (e: CombatEvent) => void;
type CityCombatListener = (e: CityCombatEvent) => void;
type CombatRejectedListener = (e: CombatRejectedEvent) => void;
type WarRequiredListener = (e: WarRequiredEvent) => void;

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

  constructor(
    unitManager: UnitManager,
    turnManager: TurnManager,
    cityManager: CityManager,
    productionSystem: ProductionSystem,
    mapData: MapData,
    diplomacyManager: DiplomacyManager | undefined,
    private readonly gridSystem: IGridSystem,
  ) {
    this.unitManager = unitManager;
    this.turnManager = turnManager;
    this.cityManager = cityManager;
    this.productionSystem = productionSystem;
    this.mapData = mapData;
    this.diplomacyManager = diplomacyManager ?? null;
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
    // 1. Must be attacker's nation's turn
    if (this.turnManager.getCurrentNation().id !== attacker.ownerId) {
      return false;
    }

    // 2. Must have movement points
    if (attacker.movementPoints <= 0) {
      return false;
    }

    // 3. Must have combat strength
    if (attacker.unitType.baseStrength <= 0) {
      return false;
    }

    // 4. Must be within active grid range
    const range = attacker.unitType.range ?? 1;
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

    const isRanged = range >= 2;

    // 5. Find target: garrison unit first, then city
    const targetUnit = this.unitManager.getUnitAt(tileX, tileY);
    const targetCity = this.cityManager.getCityAt(tileX, tileY);

    if (targetUnit && targetUnit.ownerId !== attacker.ownerId) {
      if (this.diplomacyManager && !this.diplomacyManager.canAttack(attacker.ownerId, targetUnit.ownerId)) {
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

    const result = isRanged
      ? resolveRangedCombat(attacker, target)
      : resolveCombat(attacker, target);

    attacker.health = Math.max(0, attacker.health - result.attackerDamageTaken);
    target.health = Math.max(0, target.health - result.defenderDamageTaken);

    attacker.movementPoints = 0;

    this.unitManager.notifyDamaged(attacker);
    this.unitManager.notifyDamaged(target);

    if (result.attackerDied) this.unitManager.removeUnit(attacker.id);
    if (result.defenderDied) this.unitManager.removeUnit(target.id);

    for (const cb of this.listeners) cb({ attacker, defender: target, result });

    return true;
  }

  private executeCityCombat(attacker: Unit, city: City, isRanged = false): boolean {
    const result = isRanged
      ? resolveRangedVsCity(attacker, city)
      : resolveUnitVsCity(attacker, city);

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

    let captured = false;
    if (!isRanged && result.cityFell && !result.attackerDied) {
      captureCity(city, attacker, this.cityManager, this.mapData, this.productionSystem, this.unitManager);
      captured = true;
    }

    for (const cb of this.cityCombatListeners) {
      cb({ attacker, city, result, captured });
    }

    return true;
  }

  private notifyRejected(attacker: Unit, target: Unit, reason: string): void {
    for (const cb of this.rejectedListeners) cb({ attacker, target, reason });
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
