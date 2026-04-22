export interface HappinessBreakdown {
  baseHappiness: number;
  buildingHappiness: number;
  cityUnhappiness: number;
  populationUnhappiness: number;
}

export class NationHappiness {
  readonly nationId: string;
  totalHappiness: number;
  totalUnhappiness: number;
  netHappiness: number;
  breakdown: HappinessBreakdown;
  growthModifier: number;
  productionModifier: number;

  constructor(nationId: string) {
    this.nationId = nationId;
    this.totalHappiness = 0;
    this.totalUnhappiness = 0;
    this.netHappiness = 0;
    this.breakdown = {
      baseHappiness: 0,
      buildingHappiness: 0,
      cityUnhappiness: 0,
      populationUnhappiness: 0,
    };
    this.growthModifier = 1.0;
    this.productionModifier = 1.0;
  }
}
