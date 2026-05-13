import { getNaturalResourceById } from '../data/naturalResources';
import type { City } from '../entities/City';
import type { CityManager } from './CityManager';
import type { NationManager } from './NationManager';
import type { MapData, Tile } from '../types/map';

export type ResourceCitySearchResult =
  | {
    readonly kind: 'resource';
    readonly resourceId: string;
    readonly resourceName: string;
    readonly tile: Tile;
    readonly ownerNationName?: string;
  }
  | {
    readonly kind: 'city';
    readonly city: City;
    readonly ownerNationName: string;
  };

interface SearchEntry {
  readonly normalized: string;
  readonly result: ResourceCitySearchResult;
}

const DEFAULT_RESULT_LIMIT = 25;

export class ResourceCitySearchSystem {
  constructor(
    private readonly mapData: MapData,
    private readonly cityManager: CityManager,
    private readonly nationManager: NationManager,
  ) {}

  search(query: string, limit = DEFAULT_RESULT_LIMIT): ResourceCitySearchResult[] {
    const normalizedQuery = normalizeSearchText(query);
    if (normalizedQuery.length === 0) return [];

    return this.buildEntries()
      .filter((entry) => entry.normalized.includes(normalizedQuery))
      .slice(0, limit)
      .map((entry) => entry.result);
  }

  private buildEntries(): SearchEntry[] {
    return [
      ...this.buildResourceEntries(),
      ...this.buildCityEntries(),
    ];
  }

  private buildResourceEntries(): SearchEntry[] {
    const entries: SearchEntry[] = [];
    for (const row of this.mapData.tiles) {
      for (const tile of row) {
        if (!tile.resourceId) continue;
        const resource = getNaturalResourceById(tile.resourceId);
        if (!resource) continue;
        const ownerNationId = tile.resourceOwnerNationId ?? tile.ownerId;
        entries.push({
          normalized: normalizeSearchText(`${resource.name} ${resource.id}`),
          result: {
            kind: 'resource',
            resourceId: resource.id,
            resourceName: resource.name,
            tile,
            ownerNationName: ownerNationId ? this.nationManager.getNation(ownerNationId)?.name : undefined,
          },
        });
      }
    }
    return entries.sort((a, b) => sortResult(a.result, b.result));
  }

  private buildCityEntries(): SearchEntry[] {
    return this.cityManager.getAllCities()
      .map((city) => ({
        normalized: normalizeSearchText(`${city.name} ${city.id}`),
        result: {
          kind: 'city' as const,
          city,
          ownerNationName: this.nationManager.getNation(city.ownerId)?.name ?? city.ownerId,
        },
      }))
      .sort((a, b) => sortResult(a.result, b.result));
  }
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function sortResult(a: ResourceCitySearchResult, b: ResourceCitySearchResult): number {
  if (a.kind !== b.kind) return a.kind === 'city' ? -1 : 1;
  if (a.kind === 'city' && b.kind === 'city') return a.city.name.localeCompare(b.city.name);
  if (a.kind === 'resource' && b.kind === 'resource') {
    const nameCompare = a.resourceName.localeCompare(b.resourceName);
    if (nameCompare !== 0) return nameCompare;
    if (a.tile.y !== b.tile.y) return a.tile.y - b.tile.y;
    return a.tile.x - b.tile.x;
  }
  return 0;
}
