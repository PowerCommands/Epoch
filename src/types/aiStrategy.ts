/**
 * AIStrategy describes the data-driven configuration used by AISystem.
 *
 * Strategies are pure data (no Phaser, no behavior code) and are intentionally
 * decoupled from any single Nation so they can be swapped at runtime later.
 */
export interface AIStrategy {
  readonly id: string;
  readonly name: string;

  readonly military: {
    readonly maxUnits: number;
    readonly minAttackHealthRatio: number;
    readonly engageDistance: number;
    readonly preferReachableTargets: boolean;
    readonly randomnessFactor: number;
    /** 0.5 (defensive) → 2.0 (aggressive). 1.0 is neutral. */
    readonly aggression: number;
  };

  readonly expansion: {
    readonly desiredCityCount: number;
    readonly settlerMinCityDistance: number;
    readonly settlerInterval?: number;
  };

  readonly production: {
    readonly lowNetFoodThreshold: number;
    readonly lowProductionThreshold: number;
    readonly settlerWeight: number;
    readonly militaryWeight: number;
    readonly foodBuildingWeight: number;
    readonly productionBuildingWeight: number;
    readonly goldBuildingWeight: number;
    readonly cultureBuildingWeight?: number;
    readonly wonderWeight?: number;
  };
}
