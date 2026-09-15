/** World effects stay above city streets (14), city sprites (19.6), badges
 * (19.8), selection and range overlays; HUD cameras retain their own ordering. */
export const WORLD_EFFECT_DEPTH = {
  cityFire: 52,
  aircraftShadow: 54,
  airSmoke: 55,
  airImpact: 56,
  aircraft: 57,
  aircraftEngines: 57.1,
} as const;
