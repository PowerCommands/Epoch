import type { WorldMarker, WorldMarkerClaimEntry, WorldMarkerDiscoveryEntry } from '../types/WorldMarker';

function cloneMarker(marker: WorldMarker): WorldMarker {
  return {
    ...marker,
    tags: marker.tags ? [...marker.tags] : undefined,
    metadata: marker.metadata ? { ...marker.metadata } : undefined,
  };
}

export class WorldMarkerSystem {
  private markers: WorldMarker[] = [];
  private markersById = new Map<string, WorldMarker>();
  private discoveredMarkerIdsByNation = new Map<string, Set<string>>();
  // Global claim registry: markerId → nationId that claimed it.
  // A claimed marker is considered consumed and hidden from discovery/rendering.
  private readonly claimedMarkerByNation = new Map<string, string>();

  constructor(markers: readonly WorldMarker[] = []) {
    this.replaceMarkers(markers);
  }

  replaceMarkers(markers: readonly WorldMarker[]): void {
    this.markers = markers.map(cloneMarker);
    this.markersById.clear();
    for (const marker of this.markers) {
      this.markersById.set(marker.id, marker);
    }

    for (const discovered of this.discoveredMarkerIdsByNation.values()) {
      for (const markerId of [...discovered]) {
        if (!this.markersById.has(markerId)) discovered.delete(markerId);
      }
    }

    // Drop claims for markers that no longer exist in the new set.
    for (const markerId of [...this.claimedMarkerByNation.keys()]) {
      if (!this.markersById.has(markerId)) this.claimedMarkerByNation.delete(markerId);
    }
  }

  // Returns only unclaimed markers — used by rendering and discovery scanning.
  getAllMarkers(): WorldMarker[] {
    return this.markers
      .filter((m) => !this.claimedMarkerByNation.has(m.id))
      .map(cloneMarker);
  }

  // Returns all markers regardless of claim state — used for save serialization.
  getAllMarkersForSave(): WorldMarker[] {
    return this.markers.map(cloneMarker);
  }

  // Returns a marker by id regardless of claim state — used internally and for debugging.
  getMarker(markerId: string): WorldMarker | undefined {
    const marker = this.markersById.get(markerId);
    return marker ? cloneMarker(marker) : undefined;
  }

  // Returns only unclaimed markers near (x,y) — used by discovery scanning.
  getMarkersNear(x: number, y: number, radius: number): WorldMarker[] {
    const queryRadius = Math.max(0, radius);
    return this.markers
      .filter((marker) => !this.claimedMarkerByNation.has(marker.id))
      .filter((marker) => {
        const markerRadius = Math.max(0, marker.radius ?? 0);
        const effectiveRadius = queryRadius + markerRadius;
        const dx = marker.x - x;
        const dy = marker.y - y;
        return dx * dx + dy * dy <= effectiveRadius * effectiveRadius;
      })
      .map(cloneMarker);
  }

  // ─── Global marker claims ─────────────────────────────────────────────────

  // Claim a marker globally for one nation. Returns false if the marker does
  // not exist or has already been claimed by any nation. Each marker can only
  // be claimed once; claims are permanent (not released on expedition cancel/complete).
  claimMarker(nationId: string, markerId: string): boolean {
    if (!this.markersById.has(markerId)) return false;
    if (this.claimedMarkerByNation.has(markerId)) return false;
    this.claimedMarkerByNation.set(markerId, nationId);
    return true;
  }

  isMarkerClaimed(markerId: string): boolean {
    return this.claimedMarkerByNation.has(markerId);
  }

  getMarkerClaimOwner(markerId: string): string | undefined {
    return this.claimedMarkerByNation.get(markerId);
  }

  getClaimEntries(): WorldMarkerClaimEntry[] {
    return [...this.claimedMarkerByNation.entries()]
      .map(([markerId, nationId]) => ({ markerId, nationId }))
      .sort((a, b) => a.markerId.localeCompare(b.markerId));
  }

  restoreClaims(entries: readonly WorldMarkerClaimEntry[]): void {
    this.claimedMarkerByNation.clear();
    for (const { markerId, nationId } of entries) {
      if (this.markersById.has(markerId)) {
        this.claimedMarkerByNation.set(markerId, nationId);
      }
    }
  }

  discoverMarker(nationId: string, markerId: string): boolean {
    if (!this.markersById.has(markerId)) return false;
    let discovered = this.discoveredMarkerIdsByNation.get(nationId);
    if (!discovered) {
      discovered = new Set<string>();
      this.discoveredMarkerIdsByNation.set(nationId, discovered);
    }
    if (discovered.has(markerId)) return false;
    discovered.add(markerId);
    return true;
  }

  hasNationDiscoveredMarker(nationId: string, markerId: string): boolean {
    return this.discoveredMarkerIdsByNation.get(nationId)?.has(markerId) ?? false;
  }

  getDiscoveredMarkersForNation(nationId: string): WorldMarker[] {
    const discovered = this.discoveredMarkerIdsByNation.get(nationId);
    if (!discovered) return [];
    return [...discovered]
      .map((markerId) => this.markersById.get(markerId))
      .filter((marker): marker is WorldMarker => marker !== undefined)
      .map(cloneMarker);
  }

  getDiscoveryEntries(): WorldMarkerDiscoveryEntry[] {
    return [...this.discoveredMarkerIdsByNation.entries()]
      .map(([nationId, markerIds]) => ({
        nationId,
        markerIds: [...markerIds].sort((a, b) => a.localeCompare(b)),
      }))
      .filter((entry) => entry.markerIds.length > 0)
      .sort((a, b) => a.nationId.localeCompare(b.nationId));
  }

  restoreDiscovery(entries: readonly WorldMarkerDiscoveryEntry[]): void {
    this.discoveredMarkerIdsByNation.clear();
    for (const entry of entries) {
      const markerIds = entry.markerIds.filter((markerId) => this.markersById.has(markerId));
      if (markerIds.length === 0) continue;
      this.discoveredMarkerIdsByNation.set(entry.nationId, new Set(markerIds));
    }
  }
}
