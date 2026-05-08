import { CITY_BASE_HEALTH } from '../data/cities';

export type CityFocusType =
  | 'balanced'
  | 'cultural'
  | 'military'
  | 'economic'
  | 'naval'
  | 'scientific';

export interface CityConfig {
  id: string;
  name: string;
  ownerId: string; // referens till Nation.id
  tileX: number;   // grid-koordinat
  tileY: number;   // grid-koordinat
  isCapital?: boolean;
  focus?: CityFocusType;
  productionRhythm?: CityProductionRhythm;
}

export interface CityProductionRhythm {
  completedUnitsSinceInfrastructure: number;
  completedInfrastructureSinceUnit: number;
}

/**
 * City representerar en stad i spelvärlden.
 *
 * Ren data utan Phaser-beroenden. All rendering sköts av CityRenderer.
 */
export class City {
  readonly id: string;
  name: string;
  ownerId: string;
  readonly tileX: number;
  readonly tileY: number;
  readonly isCapital: boolean;
  health: number;
  population: number;
  foodStorage: number;
  culture: number;
  culturalSphereProgress: number;
  ownedTileCoords: Array<{ x: number; y: number }>;
  workedTileCoords: Array<{ x: number; y: number }>;
  nextExpansionTileCoord: { x: number; y: number } | undefined;
  lastTurnAttacked: number | null = null;
  lastTilePurchaseTurn?: number;
  focus?: CityFocusType;
  productionRhythm: CityProductionRhythm;

  constructor(config: CityConfig) {
    this.id = config.id;
    this.name = config.name;
    this.ownerId = config.ownerId;
    this.tileX = config.tileX;
    this.tileY = config.tileY;
    this.isCapital = config.isCapital ?? false;
    this.health = CITY_BASE_HEALTH;
    this.population = 1;
    this.foodStorage = 0;
    this.culture = 0;
    this.culturalSphereProgress = 0;
    this.ownedTileCoords = [];
    this.workedTileCoords = [];
    this.nextExpansionTileCoord = undefined;
    this.focus = config.focus ?? 'balanced';
    this.productionRhythm = {
      completedUnitsSinceInfrastructure: config.productionRhythm?.completedUnitsSinceInfrastructure ?? 0,
      completedInfrastructureSinceUnit: config.productionRhythm?.completedInfrastructureSinceUnit ?? 0,
    };
  }

  get isDamaged(): boolean {
    return this.health < CITY_BASE_HEALTH;
  }

  rename(name: string): void {
    this.name = name;
  }
}
