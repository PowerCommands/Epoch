import { CITY_BASE_HEALTH, CITY_DAMAGE_HEALTH_FRACTION } from '../data/cities';

export type CityFocusType =
  | 'balanced'
  | 'cultural'
  | 'military'
  | 'economic'
  | 'naval'
  | 'scientific';

/** Frozen founding blueprint. Six null requirements mean development is impossible
 * and the surrounding territory has no urban reservations. */
export interface UrbanDevelopmentLayout {
  /** Six required building IDs in canonical order, or six nulls for a blocked site. */
  requirements: Array<string | null>;
  /** Founding geography, independent of later terrain changes. */
  waterMask: number;
}

export type SettlementStage = 'Village' | 'Town' | 'City' | 'Metropolis';

export interface CityConfig {
  settlementStage?: SettlementStage;
  urbanDevelopment?: UrbanDevelopmentLayout;
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
  /** Highest achieved stage. Ownership and infrastructure loss never lower it. */
  settlementStage: SettlementStage;
  urbanDevelopment?: UrbanDevelopmentLayout;
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
  /** Elapsed owner turns in the current energy shortage; absent when supplied. */
  energyShortageTurns?: number;
  culture: number;
  culturalSphereProgress: number;
  ownedTileCoords: Array<{ x: number; y: number }>;
  workedTileCoords: Array<{ x: number; y: number }>;
  nextExpansionTileCoord: { x: number; y: number } | undefined;
  lastTurnAttacked: number | null = null;
  lastTilePurchaseTurn?: number;
  recentlyConqueredTurnsRemaining = 0;
  /** Round of the latest foreign military conquest; absent means Integrated. */
  integrationStartedRound?: number;
  /** Extra integration progress earned while an acceleration policy was active. */
  integrationBonusTurns?: number;
  integrationLastProcessedRound?: number;
  focus?: CityFocusType;
  productionRhythm: CityProductionRhythm;

  constructor(config: CityConfig) {
    this.settlementStage = config.settlementStage ?? 'Village';
    this.urbanDevelopment = config.urbanDevelopment ? { requirements: [...config.urbanDevelopment.requirements], waterMask: config.urbanDevelopment.waterMask } : undefined;
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
    this.energyShortageTurns = undefined;
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

  get isVisuallyDamaged(): boolean {
    return this.health / CITY_BASE_HEALTH < CITY_DAMAGE_HEALTH_FRACTION;
  }

  get isCapital(): boolean {
    return this.isOriginalCapital;
  }

  rename(name: string): void {
    this.name = name;
  }
}
