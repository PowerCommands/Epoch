export interface UnitConfig {
  id: string;
  name: string;
  ownerId: string;
  tileX: number;
  tileY: number;
  maxMovementPoints: number;
  movementPoints?: number;
}

/**
 * Unit representerar en spelbar enhet på kartan.
 *
 * Ren data utan Phaser-beroenden. Position och movementPoints är muterbara
 * eftersom movement-systemet uppdaterar dem under spelets gång.
 */
export class Unit {
  readonly id: string;
  readonly name: string;
  readonly ownerId: string;
  tileX: number;
  tileY: number;
  readonly maxMovementPoints: number;
  movementPoints: number;

  constructor(config: UnitConfig) {
    this.id = config.id;
    this.name = config.name;
    this.ownerId = config.ownerId;
    this.tileX = config.tileX;
    this.tileY = config.tileY;
    this.maxMovementPoints = config.maxMovementPoints;
    this.movementPoints = config.movementPoints ?? config.maxMovementPoints;
  }

  resetMovement(): void {
    this.movementPoints = this.maxMovementPoints;
  }
}
