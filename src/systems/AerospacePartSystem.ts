import {
  AEROSPACE_INDUSTRIES_ID,
  AEROSPACE_INDUSTRIES_PART_PRODUCTION_BONUS_PERCENT,
  AEROSPACE_PART_BASE_PRODUCTION_COST,
  AEROSPACE_PART_COST_GROWTH_RATE,
  AEROSPACE_PART_PRODUCTION,
  AEROSPACE_PARTS_ID,
  calculateAerospacePartProductionCost,
} from '../data/scienceVictory';
import type { City } from '../entities/City';
import type { CityManager } from './CityManager';
import type { CorporationSystem } from './CorporationSystem';
import type { ResearchSystem } from './ResearchSystem';
import type { ResourceAccessSystem } from './ResourceAccessSystem';
import type { ProductionSystem } from './ProductionSystem';

export interface SavedAerospacePartProgress {
  readonly nationId: string;
  readonly quantity: number;
}

export interface AerospacePartProductionCostDetails {
  readonly completedParts: number;
  readonly inFlightParts: number;
  readonly partNumber: number;
  readonly baseProductionCost: number;
  readonly growthRate: number;
  readonly productionCost: number;
}

/** Owns deliberately manufactured, persistent Aerospace Part progress. */
export class AerospacePartSystem {
  private readonly quantities = new Map<string, number>();

  constructor(
    private readonly cityManager: CityManager,
    private readonly researchSystem: ResearchSystem,
    private readonly resourceAccessSystem: ResourceAccessSystem,
    private readonly corporationSystem: CorporationSystem,
    private readonly productionSystem: Pick<ProductionSystem, 'countQueuedItems'>,
  ) {}

  isGloballyUnlocked(): boolean {
    return this.corporationSystem.isFounded(AEROSPACE_INDUSTRIES_ID);
  }

  getUnlockingNationId(): string | undefined {
    return this.corporationSystem.getFoundedCorporation(AEROSPACE_INDUSTRIES_ID)?.founderNationId;
  }

  getCityProductionBlockers(city: City): string[] {
    const blockers: string[] = [];
    if (!this.isGloballyUnlocked()) blockers.push('AeroSpace Industries has not been founded');
    for (const techId of AEROSPACE_PART_PRODUCTION.requiredTechIds) {
      if (!this.researchSystem.isResearched(city.ownerId, techId)) {
        blockers.push(`missing technology: ${techId}`);
      }
    }
    for (const resourceId of AEROSPACE_PART_PRODUCTION.requiredResourceIds) {
      if (!this.resourceAccessSystem.hasResource(city.ownerId, resourceId)) {
        blockers.push(`missing resource: ${resourceId}`);
      }
    }
    if (!this.cityManager.getBuildings(city.id).hasActive(AEROSPACE_PART_PRODUCTION.requiredBuildingId)) {
      blockers.push(`city missing active building: ${AEROSPACE_PART_PRODUCTION.requiredBuildingId}`);
    }
    return blockers;
  }

  canCityProduce(city: City): boolean {
    return this.getCityProductionBlockers(city).length === 0;
  }

  completeProduction(city: City): number | null {
    if (!this.canCityProduce(city)) return null;
    const quantity = this.getQuantity(city.ownerId) + 1;
    this.quantities.set(city.ownerId, quantity);
    return quantity;
  }

  getQuantity(nationId: string): number {
    return this.quantities.get(nationId) ?? 0;
  }

  getProductionCostDetails(nationId: string): AerospacePartProductionCostDetails {
    const completedParts = this.getQuantity(nationId);
    const inFlightParts = this.getInFlightQuantity(nationId);
    const precedingParts = completedParts + inFlightParts;
    return {
      completedParts,
      inFlightParts,
      partNumber: precedingParts + 1,
      baseProductionCost: AEROSPACE_PART_BASE_PRODUCTION_COST,
      growthRate: AEROSPACE_PART_COST_GROWTH_RATE,
      productionCost: calculateAerospacePartProductionCost(precedingParts),
    };
  }

  getProductionCost(nationId: string): number {
    return this.getProductionCostDetails(nationId).productionCost;
  }

  getInFlightQuantity(nationId: string): number {
    const cityIds = this.cityManager.getCitiesByOwner(nationId).map((city) => city.id);
    return this.productionSystem.countQueuedItems(cityIds, (item) => (
      item.kind === 'manufacturedResource' && item.productionType.id === AEROSPACE_PARTS_ID
    ));
  }

  getManufacturedResources(nationId: string): ReadonlyMap<string, number> {
    const quantity = this.getQuantity(nationId);
    return quantity > 0 ? new Map([[AEROSPACE_PARTS_ID, quantity]]) : new Map();
  }

  getProductionBonusPercent(nationId: string): number {
    return this.getUnlockingNationId() === nationId
      ? AEROSPACE_INDUSTRIES_PART_PRODUCTION_BONUS_PERCENT
      : 0;
  }

  getProgressForSave(): SavedAerospacePartProgress[] {
    return [...this.quantities.entries()]
      .filter(([, quantity]) => quantity > 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([nationId, quantity]) => ({ nationId, quantity }));
  }

  restoreProgress(progress: readonly SavedAerospacePartProgress[]): void {
    this.quantities.clear();
    for (const entry of progress) {
      const quantity = Math.max(0, Math.floor(entry.quantity));
      if (quantity > 0) this.quantities.set(entry.nationId, quantity);
    }
  }
}
