export interface WorldMarker {
  id: string;
  type: string;
  x: number;
  y: number;
  radius?: number;
  name?: string;
  description?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface WorldMarkerDiscoveryEntry {
  nationId: string;
  markerIds: string[];
}
