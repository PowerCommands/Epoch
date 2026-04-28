import { getNaturalResourceById } from '../data/naturalResources';
import type { MapData } from '../types/map';
import type { TradeDeal } from '../types/tradeDeal';
import { getTileResourceQuantity } from './resource/ResourceQuantity';

export interface ResourceAccessSummary {
  owned: string[];
  imported: string[];
  available: string[];
}

export interface ImportedDealsProvider {
  getAllDeals(): readonly TradeDeal[];
}

export type ResourceUsabilityPredicate = (nationId: string, resourceId: string) => boolean;

/**
 * Owns the rules for who has access to which natural resources, taking into
 * account map ownership, active trade deals, and (via an injected predicate)
 * technology gating. Hidden strategic resources can still exist on tiles —
 * they simply do not count as accessible until the predicate allows it.
 */
export class ResourceAccessSystem {
  private canUseResource: ResourceUsabilityPredicate = () => true;

  constructor(
    private readonly mapData: MapData,
    private readonly tradeDealSource: ImportedDealsProvider,
  ) {}

  setResourceUsabilityPredicate(predicate: ResourceUsabilityPredicate): void {
    this.canUseResource = predicate;
  }

  hasOwnResource(nationId: string, resourceId: string): boolean {
    return this.getOwnedResourceSourceCount(nationId, resourceId) > 0;
  }

  getOwnedResourceSourceCount(nationId: string, resourceId: string): number {
    if (!this.canUseResource(nationId, resourceId)) return 0;
    return this.countOwnedTiles(nationId, resourceId);
  }

  getOwnedResources(nationId: string): string[] {
    const ids = new Set<string>();
    for (const row of this.mapData.tiles) {
      for (const tile of row) {
        if (tile.ownerId !== nationId) continue;
        if (tile.resourceId === undefined) continue;
        if (!this.canUseResource(nationId, tile.resourceId)) continue;
        ids.add(tile.resourceId);
      }
    }
    return Array.from(ids);
  }

  hasImportedResource(nationId: string, resourceId: string): boolean {
    return this.getImportedResourceSourceCount(nationId, resourceId) > 0;
  }

  getImportedResourceSourceCount(nationId: string, resourceId: string): number {
    if (!this.canUseResource(nationId, resourceId)) return 0;
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
    if (!this.canUseResource(nationId, resourceId)) return 0;
    const ownedRaw = this.countOwnedTiles(nationId, resourceId);
    const retainedOwnedSources = Math.max(
      0,
      ownedRaw - this.getExportedResourceSourceCount(nationId, resourceId),
    );
    return retainedOwnedSources + this.getRawImportedResourceSourceCount(nationId, resourceId);
  }

  getImportedResources(nationId: string): string[] {
    const ids = new Set<string>();
    for (const deal of this.tradeDealSource.getAllDeals()) {
      if (deal.buyerNationId !== nationId) continue;
      if (!this.canUseResource(nationId, deal.resourceId)) continue;
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

  /**
   * Per-resource usable quantity for every luxury the nation can access.
   * Quantity is the same metric `getResourceSourceCount` exposes: owned-tile
   * quantity (with improvement bonus) net of exports, plus imported deals,
   * subject to the usability predicate. Each entry has quantity > 0.
   */
  getAvailableLuxuryResourceQuantities(nationId: string): ReadonlyArray<{
    readonly resourceId: string;
    readonly quantity: number;
  }> {
    const entries: { resourceId: string; quantity: number }[] = [];
    for (const id of this.getAvailableLuxuryResources(nationId)) {
      const quantity = this.getResourceSourceCount(nationId, id);
      if (quantity <= 0) continue;
      entries.push({ resourceId: id, quantity });
    }
    return entries;
  }

  canExportResource(sellerNationId: string, resourceId: string): boolean {
    if (!this.canUseResource(sellerNationId, resourceId)) return false;
    return this.countOwnedTiles(sellerNationId, resourceId)
      > this.getExportedResourceSourceCount(sellerNationId, resourceId);
  }

  getResourceAccessSummary(nationId: string): ResourceAccessSummary {
    const owned = this.getOwnedResources(nationId);
    const imported = this.getImportedResources(nationId);
    const available = this.getAvailableResources(nationId);
    return { owned, imported, available };
  }

  /**
   * Sum the per-tile resource quantity across all tiles this nation owns
   * that match `resourceId`. A bare resource tile contributes 1; a tile
   * with the matching improvement contributes 2 (see ResourceQuantity).
   * Callers are responsible for the upstream usability check; this
   * helper only deals with ownership and quantity.
   */
  private countOwnedTiles(nationId: string, resourceId: string): number {
    let count = 0;
    for (const row of this.mapData.tiles) {
      for (const tile of row) {
        if (tile.ownerId !== nationId) continue;
        if (tile.resourceId !== resourceId) continue;
        count += getTileResourceQuantity(tile, getNaturalResourceById);
      }
    }
    return count;
  }

  private getRawImportedResourceSourceCount(nationId: string, resourceId: string): number {
    let count = 0;
    for (const deal of this.tradeDealSource.getAllDeals()) {
      if (deal.buyerNationId === nationId && deal.resourceId === resourceId) count += 1;
    }
    return count;
  }
}
