import type { WorldMarker } from './WorldMarker';

/**
 * World Marker `type` value for purely cartographic geographic labels
 * (oceans, seas, regions, deserts, mountain ranges, ...).
 *
 * Geographic markers are scenario-authored presentation metadata only. They
 * reuse the WorldMarker persistence/authoring architecture but must have no
 * gameplay effect: they are never discovered, claimed, owned, or fed into AI,
 * combat, resources, victory, or any gameplay update loop.
 */
export const GEOGRAPHIC_MARKER_TYPE = 'geographic';

/**
 * Presentation category for a geographic marker. Currently affects rendering
 * only — no gameplay rules, terrain validation, bonuses, ownership, discovery,
 * movement, or AI behavior are attached to these ids. The list is intended to
 * be easy to extend with more geographic styles later.
 */
export type GeographicMarkerCategory =
  | 'ocean'
  | 'sea'
  | 'region'
  | 'desert'
  | 'mountain_range'
  | 'other';

/** Fallback category for unknown / missing values (keeps old scenarios valid). */
export const DEFAULT_GEOGRAPHIC_CATEGORY: GeographicMarkerCategory = 'other';

/** All geographic categories in author-facing display order. */
export const GEOGRAPHIC_MARKER_CATEGORY_IDS: readonly GeographicMarkerCategory[] = [
  'ocean',
  'sea',
  'region',
  'desert',
  'mountain_range',
  'other',
];

/** Human-readable labels for the editor category dropdown. */
export const GEOGRAPHIC_MARKER_CATEGORY_LABELS: Record<GeographicMarkerCategory, string> = {
  ocean: 'Ocean',
  sea: 'Sea',
  region: 'Region',
  desert: 'Desert',
  mountain_range: 'Mountain Range',
  other: 'Other',
};

/** True when a marker is a geographic (cartographic label) marker. */
export function isGeographicMarker(marker: Pick<WorldMarker, 'type'>): boolean {
  return marker.type === GEOGRAPHIC_MARKER_TYPE;
}

/** Coerce an arbitrary value to a valid category, falling back to `other`. */
export function normalizeGeographicCategory(value: unknown): GeographicMarkerCategory {
  return GEOGRAPHIC_MARKER_CATEGORY_IDS.includes(value as GeographicMarkerCategory)
    ? (value as GeographicMarkerCategory)
    : DEFAULT_GEOGRAPHIC_CATEGORY;
}
