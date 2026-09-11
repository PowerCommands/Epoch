import type { GeographicMarkerCategory } from '../types/geographicMarker';
import { DEFAULT_GEOGRAPHIC_CATEGORY } from '../types/geographicMarker';

/**
 * Presentation style for a geographic (cartographic) label. Purely visual —
 * no gameplay meaning. Centralized here so rendering stays data-driven
 * (`GEOGRAPHIC_MARKER_STYLES[category]`) instead of category `if` chains, and
 * so future categories (continents, rivers, ...) are a data edit, not new code.
 */
export interface GeographicMarkerStyle {
  /** Font size as a multiple of tile size, so labels scale with the map. */
  readonly fontScale: number;
  /** Minimum / maximum rendered font size in px, clamped after scaling. */
  readonly minFontSize: number;
  readonly maxFontSize: number;
  readonly color: string;
  readonly alpha: number;
  /** Render the text in upper case (typical for oceans / seas). */
  readonly uppercase: boolean;
  /** Extra spacing between letters, in px. */
  readonly letterSpacing: number;
  readonly fontStyle: string;
  readonly fontFamily: string;
  readonly strokeColor: string;
  readonly strokeThickness: number;
}

const SERIF_STACK = 'Georgia, "Times New Roman", serif';

/**
 * Initial, deliberately simple styling per category. Improve presentation here
 * later without touching renderer or editor code.
 */
export const GEOGRAPHIC_MARKER_STYLES: Record<GeographicMarkerCategory, GeographicMarkerStyle> = {
  ocean: {
    fontScale: 1.7,
    minFontSize: 16,
    maxFontSize: 64,
    color: '#cfe8f5',
    alpha: 0.5,
    uppercase: true,
    letterSpacing: 6,
    fontStyle: 'italic',
    fontFamily: SERIF_STACK,
    strokeColor: '#0a2733',
    strokeThickness: 2,
  },
  sea: {
    fontScale: 1.1,
    minFontSize: 12,
    maxFontSize: 40,
    color: '#d4ecf7',
    alpha: 0.6,
    uppercase: true,
    letterSpacing: 3,
    fontStyle: 'italic',
    fontFamily: SERIF_STACK,
    strokeColor: '#0a2733',
    strokeThickness: 2,
  },
  region: {
    fontScale: 1.15,
    minFontSize: 12,
    maxFontSize: 40,
    color: '#f3ead3',
    alpha: 0.78,
    uppercase: false,
    letterSpacing: 2,
    fontStyle: 'bold',
    fontFamily: SERIF_STACK,
    strokeColor: '#241a0c',
    strokeThickness: 3,
  },
  desert: {
    fontScale: 1.05,
    minFontSize: 12,
    maxFontSize: 36,
    color: '#e9d3a0',
    alpha: 0.62,
    uppercase: false,
    letterSpacing: 2,
    fontStyle: 'italic',
    fontFamily: SERIF_STACK,
    strokeColor: '#2b1e08',
    strokeThickness: 2,
  },
  mountain_range: {
    fontScale: 0.9,
    minFontSize: 11,
    maxFontSize: 30,
    color: '#e6e1da',
    alpha: 0.72,
    uppercase: false,
    letterSpacing: 1,
    fontStyle: 'bold italic',
    fontFamily: SERIF_STACK,
    strokeColor: '#20242a',
    strokeThickness: 3,
  },
  other: {
    fontScale: 1.0,
    minFontSize: 12,
    maxFontSize: 36,
    color: '#ece7de',
    alpha: 0.7,
    uppercase: false,
    letterSpacing: 1,
    fontStyle: 'normal',
    fontFamily: SERIF_STACK,
    strokeColor: '#20242a',
    strokeThickness: 3,
  },
};

/** Style for a category, falling back to the `other` style when unknown. */
export function getGeographicMarkerStyle(
  category: GeographicMarkerCategory | undefined,
): GeographicMarkerStyle {
  return GEOGRAPHIC_MARKER_STYLES[category ?? DEFAULT_GEOGRAPHIC_CATEGORY]
    ?? GEOGRAPHIC_MARKER_STYLES[DEFAULT_GEOGRAPHIC_CATEGORY];
}
