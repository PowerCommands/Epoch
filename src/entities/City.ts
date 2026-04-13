export interface CityConfig {
  id: string;
  name: string;
  ownerId: string; // referens till Nation.id
  tileX: number;   // grid-koordinat
  tileY: number;   // grid-koordinat
}

/**
 * City representerar en stad i spelvärlden.
 *
 * Ren data utan Phaser-beroenden. All rendering sköts av CityRenderer.
 * Framtida egenskaper (befolkning, produktion, byggnader) läggs till här.
 */
export class City {
  readonly id: string;
  readonly name: string;
  readonly ownerId: string;
  readonly tileX: number;
  readonly tileY: number;

  constructor(config: CityConfig) {
    this.id = config.id;
    this.name = config.name;
    this.ownerId = config.ownerId;
    this.tileX = config.tileX;
    this.tileY = config.tileY;
  }
}
