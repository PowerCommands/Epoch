import type { City } from '../entities/City';
import type { MapData } from '../types/map';
import type { CityTerritorySystem } from './CityTerritorySystem';
import type { IGridSystem } from './grid/IGridSystem';

export type TerritoryExpansionBonusSource = 'wonder' | 'culture' | 'purchase' | 'event';

export interface TerritoryExpansionBonusRequest {
  city: City;
  ownerId: string;
  origin: { x: number; y: number };
  radius: number;
  source: TerritoryExpansionBonusSource;
  reason?: string;
}

export type TerritoryExpansionSkipReason =
  | 'already_owned'
  | 'invalid_tile'
  | 'out_of_bounds'
  | 'not_claimable';

export interface TerritoryExpansionBonusSkip {
  x: number;
  y: number;
  reason: TerritoryExpansionSkipReason;
}

export interface TerritoryExpansionBonusResult {
  claimedCoords: Array<{ x: number; y: number }>;
  skippedCoords: TerritoryExpansionBonusSkip[];
}

/**
 * Generic, reusable territory expansion bonus.
 *
 * Given an origin tile and a radius, claims every unowned tile in range for
 * the supplied city via {@link CityTerritorySystem.claimTileForCity}. Already-
 * owned tiles, out-of-bounds tiles, and tiles that the territory system rejects
 * are reported back in `skippedCoords` so callers can log or display them.
 *
 * The system is intentionally event-source-agnostic — it can back wonder
 * completion bonuses, culture events, leader abilities, or scripted quests.
 */
export class TerritoryExpansionBonusSystem {
  constructor(
    private readonly gridSystem: IGridSystem,
    private readonly cityTerritorySystem: CityTerritorySystem,
  ) {}

  apply(request: TerritoryExpansionBonusRequest, mapData: MapData): TerritoryExpansionBonusResult {
    const { city, origin, radius } = request;
    const claimedCoords: Array<{ x: number; y: number }> = [];
    const skippedCoords: TerritoryExpansionBonusSkip[] = [];

    if (radius < 0) return { claimedCoords, skippedCoords };

    const tiles = this.gridSystem.getTilesInRange(
      origin,
      radius,
      mapData,
      { includeCenter: true },
    );

    for (const tile of tiles) {
      const coord = { x: tile.x, y: tile.y };
      if (tile.ownerId !== undefined) {
        skippedCoords.push({ ...coord, reason: 'already_owned' });
        continue;
      }
      const claimed = this.cityTerritorySystem.claimTileForCity(city, coord, mapData);
      if (claimed) {
        claimedCoords.push(coord);
      } else {
        skippedCoords.push({ ...coord, reason: 'not_claimable' });
      }
    }

    return { claimedCoords, skippedCoords };
  }
}
