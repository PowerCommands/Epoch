import type { UnitType } from './UnitType';

export interface UnitConfig {
  id: string;
  name: string;
  ownerId: string;
  tileX: number;
  tileY: number;
  unitType: UnitType;
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

  constructor(config: UnitConfig) {
    this.id = config.id;
    this.name = config.name;
    this.ownerId = config.ownerId;
    this.unitType = config.unitType;
    this.tileX = config.tileX;
    this.tileY = config.tileY;
    this.maxMovementPoints = config.unitType.movementPoints;
    this.movementPoints = config.movementPoints ?? config.unitType.movementPoints;
    this.health = config.unitType.baseHealth;
  }

  resetMovement(): void {
    this.movementPoints = this.maxMovementPoints;
  }

  isAlive(): boolean {
    return this.health > 0;
  }
}
