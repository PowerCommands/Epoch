import { getNaturalResourceById } from '../data/naturalResources';
import { getManufacturedResourceById } from '../data/manufacturedResources';
import type { MapData, Tile } from '../types/map';
import type { TradeDeal } from '../types/tradeDeal';
import { getTileResourceQuantity, isTileImprovedForResource } from './resource/ResourceQuantity';

export interface ResourceAccessSummary {
  owned: string[];
  imported: string[];
  manufactured: string[];
  available: string[];
}

export interface ImportedDealsProvider {
  getAllDeals(): readonly TradeDeal[];
}

export type ResourceUsabilityPredicate = (nationId: string, resourceId: string) => boolean;
export type ManufacturedResourceProvider = (nationId: string) => ReadonlyMap<string, number>;

/**
 * Owns the rules for who has access to which natural resources, taking into
 * account map ownership, active trade deals, and (via an injected predicate)
 * technology gating. Hidden strategic resources can still exist on tiles —
 * they simply do not count as accessible until the predicate allows it.
 */
export class ResourceAccessSystem {
  private canUseResource: ResourceUsabilityPredicate = () => true;
  private getManufacturedResourceQuantities: ManufacturedResourceProvider = () => new Map();
  private resourceTileIndex: Map<string, Tile[]> | null = null;

  constructor(
    private readonly mapData: MapData,
    private readonly tradeDealSource: ImportedDealsProvider,
  ) {}

  setResourceUsabilityPredicate(predicate: ResourceUsabilityPredicate): void {
    this.canUseResource = predicate;
  }

  setManufacturedResourceProvider(provider: ManufacturedResourceProvider): void {
    this.getManufacturedResourceQuantities = provider;
  }

  invalidateResourceIndex(): void {
    this.resourceTileIndex = null;
  }

  hasOwnResource(nationId: string, resourceId: string): boolean {
    return this.getOwnedResourceSourceCount(nationId, resourceId) > 0;
  }

  getOwnedResourceSourceCount(nationId: string, resourceId: string): number {
    const manufacturedQuantity = this.getManufacturedResourceSourceCount(nationId, resourceId);
    if (manufacturedQuantity > 0) return manufacturedQuantity;
    if (getManufacturedResourceById(resourceId)) return 0;
    if (!this.canUseResource(nationId, resourceId)) return 0;
    return this.countOwnedTiles(nationId, resourceId);
  }

  getOwnedResources(nationId: string): string[] {
    const ids = new Set<string>(this.getOwnedNaturalResources(nationId));
    for (const id of this.getProducedManufacturedResources(nationId)) ids.add(id);
    return Array.from(ids);
  }

  getOwnedNaturalResources(nationId: string): string[] {
    const owned: Array<{ resourceId: string; firstTileIndex: number }> = [];
    for (const [resourceId, tiles] of this.getResourceTileIndex()) {
      if (!this.canUseResource(nationId, resourceId)) continue;
      for (const tile of tiles) {
        if (tile.resourceId !== resourceId) continue;
        if (!this.tileProvidesOwnResource(tile, nationId, resourceId)) continue;
        owned.push({
          resourceId,
          firstTileIndex: tile.y * this.mapData.width + tile.x,
        });
        break;
      }
    }
    owned.sort((a, b) => a.firstTileIndex - b.firstTileIndex);
    return owned.map((entry) => entry.resourceId);
  }

  hasImportedResource(nationId: string, resourceId: string): boolean {
    return this.getImportedResourceSourceCount(nationId, resourceId) > 0;
  }

  getImportedResourceSourceCount(nationId: string, resourceId: string): number {
    if (!getManufacturedResourceById(resourceId) && !this.canUseResource(nationId, resourceId)) return 0;
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
    const manufacturedProduced = this.getManufacturedResourceSourceCount(nationId, resourceId);
    if (manufacturedProduced > 0 || getManufacturedResourceById(resourceId)) {
      // Export does not reduce the seller's own access; just add imports on top.
      return manufacturedProduced + this.getRawImportedResourceSourceCount(nationId, resourceId);
    }
    return this.getMapOrImportedResourceSourceCount(nationId, resourceId);
  }

  getMapOrImportedResourceSourceCount(nationId: string, resourceId: string): number {
    if (!this.canUseResource(nationId, resourceId)) return 0;
    // Export does not reduce the seller's own tile access; imports add on top.
    return this.countOwnedTiles(nationId, resourceId) + this.getRawImportedResourceSourceCount(nationId, resourceId);
  }

  getImportedResources(nationId: string): string[] {
    const ids = new Set<string>();
    for (const deal of this.tradeDealSource.getAllDeals()) {
      if (deal.buyerNationId !== nationId) continue;
      if (!getManufacturedResourceById(deal.resourceId) && !this.canUseResource(nationId, deal.resourceId)) continue;
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
    for (const id of this.getProducedManufacturedResources(nationId)) ids.add(id);
    return Array.from(ids).filter((id) => this.getResourceSourceCount(nationId, id) > 0);
  }

  getManufacturedResourceSourceCount(nationId: string, resourceId: string): number {
    return Math.max(0, this.getManufacturedResourceQuantities(nationId).get(resourceId) ?? 0);
  }

  getManufacturedResources(nationId: string): string[] {
    return this.getAvailableManufacturedResourceQuantities(nationId)
      .map((entry) => entry.resourceId);
  }

  getProducedManufacturedResources(nationId: string): string[] {
    return this.getProducedManufacturedResourceQuantities(nationId)
      .map((entry) => entry.resourceId);
  }

  getProducedManufacturedResourceQuantities(nationId: string): ReadonlyArray<{
    readonly resourceId: string;
    readonly quantity: number;
  }> {
    return [...this.getManufacturedResourceQuantities(nationId).entries()]
      .filter(([resourceId, quantity]) => quantity > 0 && getManufacturedResourceById(resourceId) !== undefined)
      .map(([resourceId, quantity]) => ({ resourceId, quantity }))
      .sort((a, b) => a.resourceId.localeCompare(b.resourceId));
  }

  getAvailableManufacturedResourceQuantities(nationId: string): ReadonlyArray<{
    readonly resourceId: string;
    readonly quantity: number;
  }> {
    const ids = new Set<string>();
    for (const { resourceId } of this.getProducedManufacturedResourceQuantities(nationId)) {
      ids.add(resourceId);
    }
    for (const resourceId of this.getImportedResources(nationId)) {
      if (getManufacturedResourceById(resourceId)) ids.add(resourceId);
    }

    return [...ids]
      .map((resourceId) => ({
        resourceId,
        quantity: this.getResourceSourceCount(nationId, resourceId),
      }))
      .filter((entry) => entry.quantity > 0)
      .sort((a, b) => a.resourceId.localeCompare(b.resourceId));
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
    // A nation can never export more of a resource than it owns: each active
    // export deal consumes one unit of the owned quantity. Exporting does not
    // reduce the seller's own *internal* access — the owned quantity is still
    // fully usable at home; it only caps how many export deals can exist at
    // once. So 2 owned Rice supports at most 2 simultaneous Rice exports.
    return this.getOwnedResourceSourceCount(sellerNationId, resourceId)
      > this.getExportedResourceSourceCount(sellerNationId, resourceId);
  }

  getExportableResourceQuantities(nationId: string): ReadonlyArray<{
    readonly resourceId: string;
    readonly quantity: number;
  }> {
    const ids = new Set<string>(this.getOwnedResources(nationId));
    const entries: { resourceId: string; quantity: number }[] = [];

    for (const resourceId of ids) {
      const available = this.getOwnedResourceSourceCount(nationId, resourceId);
      if (available <= 0) continue;
      entries.push({ resourceId, quantity: available });
    }

    return entries.sort((a, b) => a.resourceId.localeCompare(b.resourceId));
  }

  getResourceAccessSummary(nationId: string): ResourceAccessSummary {
    const owned = this.getOwnedResources(nationId);
    const imported = this.getImportedResources(nationId);
    const manufactured = this.getManufacturedResources(nationId);
    const available = this.getAvailableResources(nationId);
    return { owned, imported, manufactured, available };
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
    for (const tile of this.getResourceTileIndex().get(resourceId) ?? []) {
      // Resource placement is static during gameplay. Retaining this check also
      // makes removal visible until a save-load invalidation rebuilds the index.
      if (tile.resourceId !== resourceId) continue;
      if (!this.tileProvidesOwnResource(tile, nationId, resourceId)) continue;
      count += getTileResourceQuantity(tile, getNaturalResourceById);
    }
    return count;
  }

  private getResourceTileIndex(): Map<string, Tile[]> {
    if (this.resourceTileIndex) return this.resourceTileIndex;

    const index = new Map<string, Tile[]>();
    for (const row of this.mapData.tiles) {
      for (const tile of row) {
        if (tile.resourceId === undefined) continue;
        const tiles = index.get(tile.resourceId);
        if (tiles) tiles.push(tile);
        else index.set(tile.resourceId, [tile]);
      }
    }
    this.resourceTileIndex = index;
    return index;
  }

  private tileProvidesOwnResource(tile: Tile, nationId: string, resourceId: string): boolean {
    if (tile.ownerId === nationId) return true;
    if (tile.resourceOwnerNationId !== nationId) return false;

    const resource = getNaturalResourceById(resourceId);
    return resource !== undefined && isTileImprovedForResource(tile, resource);
  }

  private getRawImportedResourceSourceCount(nationId: string, resourceId: string): number {
    let count = 0;
    for (const deal of this.tradeDealSource.getAllDeals()) {
      if (deal.buyerNationId === nationId && deal.resourceId === resourceId) count += 1;
    }
    return count;
  }
}
