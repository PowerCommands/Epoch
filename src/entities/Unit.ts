import type { UnitType } from './UnitType';
import { MIN_MILITARY_QUALITY_LEVEL, type MilitaryQualityLevel } from '../data/unitQuality';

export type UnitActionStatus = 'active' | 'sleep' | 'building';

/** Persistent player-set automation. 'explore' = auto-exploration for recon units. */
export type UnitAutomation = 'explore';

export interface UnitBuildAction {
  improvementId: string;
  tileX: number;
  tileY: number;
  progress: number;
  requiredProgress: number;
}

export type AircraftBase = { kind: 'city' | 'carrier'; id: string };

export interface UnitConfig {
  id: string;
  name: string;
  ownerId: string;
  tileX: number;
  tileY: number;
  unitType: UnitType;
  maxMovementPoints?: number;
  movementPoints?: number;
  improvementCharges?: number;
  createdRound?: number;
  expiresAtRound?: number;
  airBase?: AircraftBase;
  carriedByUnitId?: string;
  cargoUnitIds?: string[];
  qualityLevel?: MilitaryQualityLevel;
}

/**
 * Unit representerar en spelbar enhet på kartan.
 *
 * Ren data utan Phaser-beroenden. Position, movementPoints och health
 * är muterbara eftersom system uppdaterar dem under spelets gång.
 */
export class Unit {
  readonly id: string;
  name: string;
  ownerId: string;
  unitType: UnitType;
  tileX: number;
  tileY: number;
  maxMovementPoints: number;
  movementPoints: number;
  health: number;
  airBase?: AircraftBase;
  carriedByUnitId?: string;
  cargoUnitIds: string[];
  isSleeping: boolean;
  improvementCharges?: number;
  createdRound: number;
  expiresAtRound?: number;
  queuedDestination?: { x: number; y: number };
  actionStatus: UnitActionStatus;
  buildAction?: UnitBuildAction;
  /** When set, the unit is under player-enabled automation (e.g. auto-explore). */
  automation?: UnitAutomation;
  /**
   * Permanent Military Unit Quality level (1–5) baked in at production time.
   * Never recalculated afterwards — it survives building loss, relocation,
   * upgrades and save/load. Non-military/civilian units keep the default
   * Level 1. See {@link ../data/unitQuality}.
   */
  qualityLevel: MilitaryQualityLevel;

  constructor(config: UnitConfig) {
    this.id = config.id;
    this.name = config.name;
    this.ownerId = config.ownerId;
    this.unitType = config.unitType;
    this.tileX = config.tileX;
    this.tileY = config.tileY;
    this.maxMovementPoints = config.maxMovementPoints ?? config.unitType.movementPoints;
    this.movementPoints = config.movementPoints ?? this.maxMovementPoints;
    this.health = config.unitType.baseHealth;
    this.airBase = config.airBase;
    this.carriedByUnitId = config.carriedByUnitId;
    this.cargoUnitIds = [...(config.cargoUnitIds ?? [])];
    this.isSleeping = false;
    this.improvementCharges = config.improvementCharges ?? config.unitType.maxImprovementCharges;
    this.createdRound = config.createdRound ?? 1;
    this.expiresAtRound = config.expiresAtRound;
    this.actionStatus = 'active';
    this.qualityLevel = config.qualityLevel ?? MIN_MILITARY_QUALITY_LEVEL;
  }

  resetMovement(): void {
    this.movementPoints = this.maxMovementPoints;
  }

  changeUnitType(unitType: UnitType, maxMovementPoints = unitType.movementPoints): void {
    this.unitType = unitType;
    this.name = unitType.name;
    this.maxMovementPoints = maxMovementPoints;
    this.health = Math.min(this.health, unitType.baseHealth);
    this.movementPoints = 0;
  }

  isAlive(): boolean {
    return this.health > 0;
  }

  isBuildingImprovement(): boolean {
    return this.actionStatus === 'building' && this.buildAction !== undefined;
  }

  setBuildingImprovement(action: UnitBuildAction): void {
    this.actionStatus = 'building';
    this.buildAction = action;
    this.isSleeping = false;
  }

  clearBuildAction(): void {
    this.buildAction = undefined;
    if (this.actionStatus === 'building') {
      this.actionStatus = 'active';
    }
  }
}
