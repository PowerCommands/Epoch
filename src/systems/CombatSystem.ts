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

type CombatListener = (e: CombatEvent) => void;
type CityCombatListener = (e: CityCombatEvent) => void;
type CombatRejectedListener = (e: CombatRejectedEvent) => void;

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
  private readonly listeners: CombatListener[] = [];
  private readonly cityCombatListeners: CityCombatListener[] = [];
  private readonly rejectedListeners: CombatRejectedListener[] = [];

  constructor(
    unitManager: UnitManager,
    turnManager: TurnManager,
    cityManager: CityManager,
    productionSystem: ProductionSystem,
    mapData: MapData,
  ) {
    this.unitManager = unitManager;
    this.turnManager = turnManager;
    this.cityManager = cityManager;
    this.productionSystem = productionSystem;
    this.mapData = mapData;
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

  tryAttack(attacker: Unit, tileX: number, tileY: number): boolean {
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

    // 4. Must be within range (Chebyshev distance)
    const range = attacker.unitType.range ?? 1;
    const dist = this.chebyshevDistance(attacker.tileX, attacker.tileY, tileX, tileY);
    if (range === 1) {
      // Melee: Manhattan adjacent only
      if (!this.isAdjacent(attacker.tileX, attacker.tileY, tileX, tileY)) return false;
    } else {
      // Ranged: Chebyshev distance within range
      if (dist < 1 || dist > range) return false;
    }

    const isRanged = range >= 2;

    // 5. Find target: garrison unit first, then city
    const targetUnit = this.unitManager.getUnitAt(tileX, tileY);
    const targetCity = this.cityManager.getCityAt(tileX, tileY);

    if (targetUnit && targetUnit.ownerId !== attacker.ownerId) {
      return this.executeUnitCombat(attacker, targetUnit, isRanged);
    }

    if (targetCity && targetCity.ownerId !== attacker.ownerId) {
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
      captureCity(city, attacker, this.cityManager, this.mapData, this.productionSystem);
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

  private isAdjacent(x1: number, y1: number, x2: number, y2: number): boolean {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2) === 1;
  }

  private chebyshevDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
  }
}
