/**
 * Map lens controls which world overlays are visible.
 *
 * `normal` is the default and renders the game exactly as before.
 * `culture` adds a transparent cultural-ownership overlay; territory
 * borders, units, cities and other gameplay state are unaffected.
 */
export type MapLensMode = 'normal' | 'culture';

export const DEFAULT_MAP_LENS: MapLensMode = 'normal';
