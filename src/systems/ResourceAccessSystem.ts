import { getNaturalResourceById } from '../data/naturalResources';
import type { MapData } from '../types/map';
import type { TradeDeal } from '../types/tradeDeal';

export interface ResourceAccessSummary {
  owned: string[];
  imported: string[];
  available: string[];
}

export interface ImportedDealsProvider {
  getAllDeals(): readonly TradeDeal[];
}

export class ResourceAccessSystem {
  constructor(
    private readonly mapData: MapData,
    private readonly tradeDealSource: ImportedDealsProvider,
  ) {}

  hasOwnResource(nationId: string, resourceId: string): boolean {
    return this.getOwnedResourceSourceCount(nationId, resourceId) > 0;
  }

  getOwnedResourceSourceCount(nationId: string, resourceId: string): number {
    let count = 0;
    for (const row of this.mapData.tiles) {
      for (const tile of row) {
        if (tile.ownerId === nationId && tile.resourceId === resourceId) count += 1;
      }
    }
    return count;
  }

  getOwnedResources(nationId: string): string[] {
    const ids = new Set<string>();
    for (const row of this.mapData.tiles) {
      for (const tile of row) {
        if (tile.ownerId !== nationId) continue;
        if (tile.resourceId === undefined) continue;
        ids.add(tile.resourceId);
      }
    }
    return Array.from(ids);
  }

  hasImportedResource(nationId: string, resourceId: string): boolean {
    return this.getImportedResourceSourceCount(nationId, resourceId) > 0;
  }

  getImportedResourceSourceCount(nationId: string, resourceId: string): number {
    let count = 0;
    for (const deal of this.tradeDealSource.getAllDeals()) {
      if (deal.buyerNationId === nationId && deal.resourceId === resourceId) count += 1;
    }
    return count;
  }

  getExportedResourceSourceCount(nationId: string, resourceId: string): number {
    let count = 0;
    for (const deal of this.tradeDealSource.getAllDeals()) {
      if (deal.sellerNationId === nationId && deal.resourceId === resourceId) count += 1;
    }
    return count;
  }

  getResourceSourceCount(nationId: string, resourceId: string): number {
    const retainedOwnedSources = Math.max(
      0,
      this.getOwnedResourceSourceCount(nationId, resourceId) - this.getExportedResourceSourceCount(nationId, resourceId),
    );
    return retainedOwnedSources + this.getImportedResourceSourceCount(nationId, resourceId);
  }

  getImportedResources(nationId: string): string[] {
    const ids = new Set<string>();
    for (const deal of this.tradeDealSource.getAllDeals()) {
      if (deal.buyerNationId !== nationId) continue;
      ids.add(deal.resourceId);
    }
    return Array.from(ids);
  }

  hasResource(nationId: string, resourceId: string): boolean {
    return this.getResourceSourceCount(nationId, resourceId) > 0;
  }

  getAvailableResources(nationId: string): string[] {
    const ids = new Set<string>(this.getOwnedResources(nationId));
    for (const id of this.getImportedResources(nationId)) ids.add(id);
    return Array.from(ids).filter((id) => this.getResourceSourceCount(nationId, id) > 0);
  }

  getAvailableLuxuryResources(nationId: string): string[] {
    return this.getAvailableResources(nationId).filter((id) => (
      getNaturalResourceById(id)?.category === 'luxury'
    ));
  }

  canExportResource(sellerNationId: string, resourceId: string): boolean {
    return this.getOwnedResourceSourceCount(sellerNationId, resourceId)
      > this.getExportedResourceSourceCount(sellerNationId, resourceId);
  }

  getResourceAccessSummary(nationId: string): ResourceAccessSummary {
    const owned = this.getOwnedResources(nationId);
    const imported = this.getImportedResources(nationId);
    const available = this.getAvailableResources(nationId);
    return { owned, imported, available };
  }
}
