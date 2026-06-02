/**
 * Axis-aligned rectangle in screen-space pixels, expressed by its center point
 * and size. Used by HUD components to report where an on-screen element sits so
 * overlays (e.g. the tutorial wizard) can anchor and point at them without
 * hardcoding coordinates.
 */
export interface ScreenRect {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}
