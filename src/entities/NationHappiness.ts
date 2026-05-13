export type HappinessState =
  | 'golden_age'
  | 'prosperous'
  | 'happy'
  | 'stable'
  | 'unhappy'
  | 'very_unhappy'
  | 'unrest'
  | 'crisis';

export interface LuxuryResourceEntry {
  readonly resourceId: string;
  readonly quantity: number;
}

export class NationHappiness {
  readonly nationId: string;
  totalHappiness: number;
  totalUnhappiness: number;
  netHappiness: number;

  happinessFromBase: number;
  happinessFromBuildings: number;
  happinessFromWonders: number;
  happinessFromLuxuryResources: number;
  happinessFromFoodSurplus: number;
  happinessFromPolicies: number;
  happinessFromCultureEffects: number;
  happinessFromCorporations: number;
  availableLuxuryResourceIds: string[];
  availableLuxuryResourceQuantities: LuxuryResourceEntry[];
  unhappinessFromCities: number;
  unhappinessFromPopulation: number;
  unhappinessFromPolicyCityModifiers: number;
  unhappinessFromPolicyPopulationModifiers: number;

  state: HappinessState;
  growthModifier: number;
  productionModifier: number;
  cultureModifier: number;
  goldModifier: number;

  constructor(nationId: string) {
    this.nationId = nationId;
    this.totalHappiness = 0;
    this.totalUnhappiness = 0;
    this.netHappiness = 0;
    this.happinessFromBase = 0;
    this.happinessFromBuildings = 0;
    this.happinessFromWonders = 0;
    this.happinessFromLuxuryResources = 0;
    this.happinessFromFoodSurplus = 0;
    this.happinessFromPolicies = 0;
    this.happinessFromCultureEffects = 0;
    this.happinessFromCorporations = 0;
    this.availableLuxuryResourceIds = [];
    this.availableLuxuryResourceQuantities = [];
    this.unhappinessFromCities = 0;
    this.unhappinessFromPopulation = 0;
    this.unhappinessFromPolicyCityModifiers = 0;
    this.unhappinessFromPolicyPopulationModifiers = 0;
    this.state = 'stable';
    this.growthModifier = 1.0;
    this.productionModifier = 1.0;
    this.cultureModifier = 1.0;
    this.goldModifier = 1.0;
  }
}
