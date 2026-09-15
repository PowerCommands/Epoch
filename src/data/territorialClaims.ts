/** Initial balance for the single-use early territorial specialist. */
export const TERRITORIAL_CLAIM_RULES = {
  productionCost: 100,
  goldCost: 200,
  maxCityDistance: 10,
  incident: { trust: -10, hostility: 10, suspicion: 5 },
} as const;
