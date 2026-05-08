import type { City } from '../entities/City';
import type { MapData, Tile } from '../types/map';
import type { IGridSystem } from './grid/IGridSystem';

export interface CulturalClaimResult {
  claimedTiles: number;
  convertedTiles: number;
}

export interface CulturalBurstOptions {
  radius: number;
  maxTiles?: number;
  allowOverwrite: boolean;
}

// Burst sizes are starting values — tune later as the culture layer matures.
export const CULTURAL_BUILDING_BURST_RADIUS = 3;
export const CULTURAL_BUILDING_BURST_MAX_TILES = 8;

export const CULTURAL_PERCENT_BUILDING_BURST_RADIUS = 3;
export const CULTURAL_PERCENT_BUILDING_BURST_MAX_TILES = 12;

export const WORLD_WONDER_CULTURAL_BURST_RADIUS = 4;
export const WORLD_WONDER_CULTURAL_BURST_MAX_TILES = 18;

/**
 * CulturalSphereSystem maintains a culture-ownership layer that is
 * independent from normal territory ownership.
 *
 * Culture is stored on tiles via `cultureOwnerId` and `cultureSourceCityId`
 * and is intentionally decoupled from working, movement, combat, diplomacy,
 * loyalty and city flipping. This is the foundation for later cultural
 * pressure / loyalty / flipping systems.
 */
export class CulturalSphereSystem {
  /**
   * Claim the same initial 7-tile pattern as city founding territory:
   * city center + 6 hex neighbors. Culture may overwrite an existing
   * cultureOwnerId belonging to another nation; tiles already held by the
   * same nation are refreshed (source city only) but not counted.
   */
  claimInitialCityCulture(
    city: City,
    mapData: MapData,
    gridSystem: IGridSystem,
  ): CulturalClaimResult {
    const tiles = gridSystem.getTilesInRange(
      { x: city.tileX, y: city.tileY },
      1,
      mapData,
      { includeCenter: true },
    );

    return this.applyCultureClaim(city, tiles);
  }

  /**
   * Expand cultural ownership outward from a city in ring order.
   *
   * Walks ring 0, 1, 2 ... up to `options.radius` and claims/flips the
   * first valid tiles it finds. v1 picks "first valid" deterministically
   * with no scoring. Same-owner tiles are skipped and not counted.
   */
  triggerCulturalBurst(
    city: City,
    mapData: MapData,
    gridSystem: IGridSystem,
    options: CulturalBurstOptions,
  ): CulturalClaimResult {
    const result: CulturalClaimResult = { claimedTiles: 0, convertedTiles: 0 };
    if (options.radius <= 0) return result;

    const center = { x: city.tileX, y: city.tileY };
    const tiles = gridSystem.getTilesInRange(
      center,
      options.radius,
      mapData,
      { includeCenter: true },
    );

    const sorted = tiles
      .map((tile) => ({ tile, ring: gridSystem.getDistance(center, { x: tile.x, y: tile.y }) }))
      .sort((a, b) => {
        if (a.ring !== b.ring) return a.ring - b.ring;
        if (a.tile.y !== b.tile.y) return a.tile.y - b.tile.y;
        return a.tile.x - b.tile.x;
      });

    for (const { tile } of sorted) {
      if (options.maxTiles !== undefined
        && result.claimedTiles + result.convertedTiles >= options.maxTiles) {
        break;
      }

      const previousOwner = tile.cultureOwnerId;

      if (previousOwner === undefined) {
        tile.cultureOwnerId = city.ownerId;
        tile.cultureSourceCityId = city.id;
        result.claimedTiles++;
        continue;
      }

      if (previousOwner === city.ownerId) {
        continue;
      }

      if (!options.allowOverwrite) continue;

      tile.cultureOwnerId = city.ownerId;
      tile.cultureSourceCityId = city.id;
      result.convertedTiles++;
    }

    return result;
  }

  private applyCultureClaim(city: City, tiles: Tile[]): CulturalClaimResult {
    let claimedTiles = 0;
    let convertedTiles = 0;

    for (const tile of tiles) {
      const previousOwner = tile.cultureOwnerId;

      if (previousOwner === undefined) {
        tile.cultureOwnerId = city.ownerId;
        tile.cultureSourceCityId = city.id;
        claimedTiles++;
        continue;
      }

      if (previousOwner !== city.ownerId) {
        tile.cultureOwnerId = city.ownerId;
        tile.cultureSourceCityId = city.id;
        convertedTiles++;
        continue;
      }

      tile.cultureSourceCityId = city.id;
    }

    return { claimedTiles, convertedTiles };
  }
}
