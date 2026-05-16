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
  originNationId?: string;
  isOriginalCapital?: boolean;
  isResidenceCapital?: boolean;
  occupiedOriginalNationId?: string;
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
  readonly originNationId: string;
  readonly tileX: number;
  readonly tileY: number;
  readonly isOriginalCapital: boolean;
  isResidenceCapital: boolean;
  occupiedOriginalNationId?: string;
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
    this.originNationId = config.originNationId ?? config.ownerId;
    this.tileX = config.tileX;
    this.tileY = config.tileY;
    this.isOriginalCapital = config.isOriginalCapital ?? config.isCapital ?? false;
    this.isResidenceCapital = config.isResidenceCapital ?? config.isCapital ?? false;
    this.occupiedOriginalNationId = config.occupiedOriginalNationId;
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

  get isCapital(): boolean {
    return this.isOriginalCapital;
  }

  rename(name: string): void {
    this.name = name;
  }
}
