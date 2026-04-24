import type { UnitType } from './UnitType';

export interface UnitConfig {
  id: string;
  name: string;
  ownerId: string;
  tileX: number;
  tileY: number;
  unitType: UnitType;
  maxMovementPoints?: number;
  movementPoints?: number;
}

/**
 * Unit representerar en spelbar enhet på kartan.
 *
 * Ren data utan Phaser-beroenden. Position, movementPoints och health
 * är muterbara eftersom system uppdaterar dem under spelets gång.
 */
export class Unit {
  readonly id: string;
  readonly name: string;
  readonly ownerId: string;
  readonly unitType: UnitType;
  tileX: number;
  tileY: number;
  readonly maxMovementPoints: number;
  movementPoints: number;
  health: number;
  transportId?: string;
  isSleeping: boolean;

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
  }

  resetMovement(): void {
    this.movementPoints = this.maxMovementPoints;
  }

  isAlive(): boolean {
    return this.health > 0;
  }
}
