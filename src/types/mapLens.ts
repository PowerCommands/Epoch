/**
 * Map lens controls which world overlays are visible.
 *
 * `normal` is the default and renders the game exactly as before.
 * `culture` adds a transparent cultural-ownership overlay. `resources`
 * visually lifts fog from discovered resources and their explored context.
 * Territory, units, cities and other gameplay state are unaffected.
 */
export type MapLensMode = 'normal' | 'culture' | 'resources';

export const DEFAULT_MAP_LENS: MapLensMode = 'normal';
