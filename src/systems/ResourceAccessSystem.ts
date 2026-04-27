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
    for (const row of this.mapData.tiles) {
      for (const tile of row) {
        if (tile.ownerId === nationId && tile.resourceId === resourceId) return true;
      }
    }
    return false;
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
    for (const deal of this.tradeDealSource.getAllDeals()) {
      if (deal.buyerNationId === nationId && deal.resourceId === resourceId) return true;
    }
    return false;
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
    return this.hasOwnResource(nationId, resourceId) || this.hasImportedResource(nationId, resourceId);
  }

  getAvailableResources(nationId: string): string[] {
    const ids = new Set<string>(this.getOwnedResources(nationId));
    for (const id of this.getImportedResources(nationId)) ids.add(id);
    return Array.from(ids);
  }

  canExportResource(sellerNationId: string, resourceId: string): boolean {
    return this.hasOwnResource(sellerNationId, resourceId);
  }

  getResourceAccessSummary(nationId: string): ResourceAccessSummary {
    const owned = this.getOwnedResources(nationId);
    const imported = this.getImportedResources(nationId);
    const available = Array.from(new Set<string>([...owned, ...imported]));
    return { owned, imported, available };
  }
}
