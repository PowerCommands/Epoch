import type { WorldMarker, WorldMarkerDiscoveryEntry } from '../types/WorldMarker';

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
  }

  getAllMarkers(): WorldMarker[] {
    return this.markers.map(cloneMarker);
  }

  getMarker(markerId: string): WorldMarker | undefined {
    const marker = this.markersById.get(markerId);
    return marker ? cloneMarker(marker) : undefined;
  }

  getMarkersNear(x: number, y: number, radius: number): WorldMarker[] {
    const queryRadius = Math.max(0, radius);
    return this.markers
      .filter((marker) => {
        const markerRadius = Math.max(0, marker.radius ?? 0);
        const effectiveRadius = queryRadius + markerRadius;
        const dx = marker.x - x;
        const dy = marker.y - y;
        return dx * dx + dy * dy <= effectiveRadius * effectiveRadius;
      })
      .map(cloneMarker);
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
