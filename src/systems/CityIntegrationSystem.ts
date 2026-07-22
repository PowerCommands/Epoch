import type { City } from '../entities/City';
import type { CityManager } from './CityManager';
import type { TurnManager } from './TurnManager';

export const CITY_OCCUPIED_TURNS = 25;
export const CITY_RECOVERING_TURNS = 25;
export const CITY_OCCUPATION_GOLD_COST_PER_TURN = 100;
export const CITY_OCCUPIED_OUTPUT_MULTIPLIER = 0;
export const CITY_RECOVERING_OUTPUT_MULTIPLIER = 0.5;
export const CITY_INTEGRATED_OUTPUT_MULTIPLIER = 1;

export type CityIntegrationState = 'occupied' | 'recovering' | 'integrated';

export interface CityIntegrationProgress {
  readonly state: CityIntegrationState;
  readonly turnsInState: number;
  readonly phaseTurns: number;
  readonly totalElapsedTurns: number;
  readonly outputMultiplier: number;
  readonly occupationGoldCostPerTurn: number;
}

export interface CityIntegrationCounts {
  occupied: number;
  recovering: number;
  integrated: number;
}

type CityIntegrationLogger = (nationId: string, message: string) => void;
type CityIntegrationChanged = (city: City) => void;

/** Pure, authoritative integration-state derivation used by gameplay and UI. */
export function getCityIntegrationProgress(city: City, currentRound: number): CityIntegrationProgress {
  if (city.integrationStartedRound === undefined) {
    return {
      state: 'integrated',
      turnsInState: 0,
      phaseTurns: 0,
      totalElapsedTurns: 0,
      outputMultiplier: CITY_INTEGRATED_OUTPUT_MULTIPLIER,
      occupationGoldCostPerTurn: 0,
    };
  }

  const elapsed = Math.max(0, Math.floor(currentRound) - city.integrationStartedRound);
  if (elapsed < CITY_OCCUPIED_TURNS) {
    return {
      state: 'occupied',
      turnsInState: elapsed,
      phaseTurns: CITY_OCCUPIED_TURNS,
      totalElapsedTurns: elapsed,
      outputMultiplier: CITY_OCCUPIED_OUTPUT_MULTIPLIER,
      occupationGoldCostPerTurn: CITY_OCCUPATION_GOLD_COST_PER_TURN,
    };
  }
  if (elapsed < CITY_OCCUPIED_TURNS + CITY_RECOVERING_TURNS) {
    return {
      state: 'recovering',
      turnsInState: elapsed - CITY_OCCUPIED_TURNS,
      phaseTurns: CITY_RECOVERING_TURNS,
      totalElapsedTurns: elapsed,
      outputMultiplier: CITY_RECOVERING_OUTPUT_MULTIPLIER,
      occupationGoldCostPerTurn: 0,
    };
  }
  return {
    state: 'integrated',
    turnsInState: 0,
    phaseTurns: 0,
    totalElapsedTurns: elapsed,
    outputMultiplier: CITY_INTEGRATED_OUTPUT_MULTIPLIER,
    occupationGoldCostPerTurn: 0,
  };
}

export function getCityIntegrationOutputMultiplier(city: City, currentRound: number): number {
  return getCityIntegrationProgress(city, currentRound).outputMultiplier;
}

export function applyCityIntegrationOutput(value: number, city: City, currentRound: number): number {
  return Math.round(value * getCityIntegrationOutputMultiplier(city, currentRound));
}

export function getNationOccupationGoldCost(
  nationId: string,
  cityManager: CityManager,
  currentRound: number,
): number {
  return cityManager.getCitiesByOwner(nationId).reduce((total, city) => (
    total + getCityIntegrationProgress(city, currentRound).occupationGoldCostPerTurn
  ), 0);
}

export function getNationCityIntegrationCounts(
  nationId: string,
  cityManager: CityManager,
  currentRound: number,
): CityIntegrationCounts {
  const counts: CityIntegrationCounts = { occupied: 0, recovering: 0, integrated: 0 };
  for (const city of cityManager.getCitiesByOwner(nationId)) {
    counts[getCityIntegrationProgress(city, currentRound).state] += 1;
  }
  return counts;
}

/** Handles military-conquest initialization and transition-only diagnostics. */
export class CityIntegrationSystem {
  constructor(
    private readonly cityManager: CityManager,
    private readonly turnManager: TurnManager,
    private readonly log?: CityIntegrationLogger,
    private readonly onChanged?: CityIntegrationChanged,
  ) {
    turnManager.on('roundStart', ({ round }) => this.handleRoundStart(round));
  }

  handleConquest(city: City, previousOwnerId: string, newOwnerId: string): CityIntegrationState {
    if (newOwnerId === city.originNationId) {
      city.integrationStartedRound = undefined;
      this.log?.(
        newOwnerId,
        `[CityOccupation] ${city.name} liberated by original nation ${newOwnerId}; state=Integrated immediately.`,
      );
      this.onChanged?.(city);
      return 'integrated';
    }

    city.integrationStartedRound = this.turnManager.getCurrentRound();
    const reset = previousOwnerId !== city.originNationId;
    this.log?.(
      newOwnerId,
      `[CityOccupation] ${city.name} conquered by ${newOwnerId}; originalNation=${city.originNationId} state=Occupied outputMultiplier=${CITY_OCCUPIED_OUTPUT_MULTIPLIER * 100}% occupationCost=${CITY_OCCUPATION_GOLD_COST_PER_TURN} gold/turn${reset ? ` occupation reset ${previousOwnerId}→${newOwnerId} integrationProgress=0` : ''}.`,
    );
    this.onChanged?.(city);
    return 'occupied';
  }

  handleRoundStart(round: number): void {
    for (const city of this.cityManager.getAllCities()) {
      if (city.integrationStartedRound === undefined) continue;
      const elapsed = Math.max(0, round - city.integrationStartedRound);
      if (elapsed === CITY_OCCUPIED_TURNS) {
        this.log?.(
          city.ownerId,
          `[CityOccupation] ${city.name} entered Recovering after ${CITY_OCCUPIED_TURNS} turns under ${city.ownerId}; outputMultiplier=${CITY_RECOVERING_OUTPUT_MULTIPLIER * 100}%.`,
        );
        this.onChanged?.(city);
      } else if (elapsed >= CITY_OCCUPIED_TURNS + CITY_RECOVERING_TURNS) {
        city.integrationStartedRound = undefined;
        this.log?.(
          city.ownerId,
          `[CityOccupation] ${city.name} integrated into ${city.ownerId} after ${CITY_OCCUPIED_TURNS + CITY_RECOVERING_TURNS} turns.`,
        );
        this.onChanged?.(city);
      }
    }
  }
}
