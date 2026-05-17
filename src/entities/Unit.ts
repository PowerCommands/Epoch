import type { UnitType } from './UnitType';

export type UnitActionStatus = 'active' | 'sleep' | 'building';

export interface UnitBuildAction {
  improvementId: string;
  tileX: number;
  tileY: number;
  progress: number;
  requiredProgress: number;
}

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
  readonly ownerId: string;
  unitType: UnitType;
  tileX: number;
  tileY: number;
  maxMovementPoints: number;
  movementPoints: number;
  health: number;
  transportId?: string;
  isSleeping: boolean;
  improvementCharges?: number;
  createdRound: number;
  expiresAtRound?: number;
  actionStatus: UnitActionStatus;
  buildAction?: UnitBuildAction;

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
    this.isSleeping = false;
    this.improvementCharges = config.improvementCharges ?? config.unitType.maxImprovementCharges;
    this.createdRound = config.createdRound ?? 1;
    this.expiresAtRound = config.expiresAtRound;
    this.actionStatus = 'active';
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
