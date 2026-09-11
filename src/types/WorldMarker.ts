import type { GeographicMarkerCategory } from './geographicMarker';

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
  // Presentation category for `geographic` markers only. Optional so older
  // scenarios and non-geographic markers remain valid without this field.
  category?: GeographicMarkerCategory;
}

export interface WorldMarkerDiscoveryEntry {
  nationId: string;
  markerIds: string[];
}

export interface WorldMarkerClaimEntry {
  markerId: string;
  nationId: string;
}
