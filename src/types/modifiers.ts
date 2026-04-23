export interface ModifierSet {
  foodPerTurn?: number;
  productionPerTurn?: number;
  goldPerTurn?: number;
  sciencePerTurn?: number;
  culturePerTurn?: number;
  happinessPerTurn?: number;
  foodPercent?: number;
  productionPercent?: number;
  goldPercent?: number;
  sciencePercent?: number;
  culturePercent?: number;
}

export const EMPTY_MODIFIERS: Readonly<ModifierSet> = Object.freeze({});

export function addModifiers(...modifiers: Readonly<ModifierSet>[]): ModifierSet {
  const total: ModifierSet = {};

  for (const modifier of modifiers) {
    total.foodPerTurn = (total.foodPerTurn ?? 0) + (modifier.foodPerTurn ?? 0);
    total.productionPerTurn = (total.productionPerTurn ?? 0) + (modifier.productionPerTurn ?? 0);
    total.goldPerTurn = (total.goldPerTurn ?? 0) + (modifier.goldPerTurn ?? 0);
    total.sciencePerTurn = (total.sciencePerTurn ?? 0) + (modifier.sciencePerTurn ?? 0);
    total.culturePerTurn = (total.culturePerTurn ?? 0) + (modifier.culturePerTurn ?? 0);
    total.happinessPerTurn = (total.happinessPerTurn ?? 0) + (modifier.happinessPerTurn ?? 0);
    total.foodPercent = (total.foodPercent ?? 0) + (modifier.foodPercent ?? 0);
    total.productionPercent = (total.productionPercent ?? 0) + (modifier.productionPercent ?? 0);
    total.goldPercent = (total.goldPercent ?? 0) + (modifier.goldPercent ?? 0);
    total.sciencePercent = (total.sciencePercent ?? 0) + (modifier.sciencePercent ?? 0);
    total.culturePercent = (total.culturePercent ?? 0) + (modifier.culturePercent ?? 0);
  }

  return total;
}
