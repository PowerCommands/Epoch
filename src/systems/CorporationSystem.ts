import {
  CORPORATIONS,
  getCorporationById,
  validateCorporationDefinitions,
  type CorporationDefinition,
} from '../data/corporations';
import { getManufacturedResourceById } from '../data/manufacturedResources';
import type { City } from '../entities/City';
import type { Corporation } from '../entities/Corporation';
import type { CityManager } from './CityManager';
import type { EventLogSystem } from './EventLogSystem';
import type { NationManager } from './NationManager';
import type { ResearchSystem } from './ResearchSystem';
import type { ResourceAccessSystem } from './ResourceAccessSystem';

export interface ManufacturedResourceQuantity {
  readonly resourceId: string;
  readonly quantity: number;
}

export interface CorporationFoundResult {
  readonly founded: Corporation;
  readonly definition: CorporationDefinition;
}

export interface CorporationFoundContext {
  readonly researchSystem: ResearchSystem;
  readonly resourceAccessSystem: ResourceAccessSystem;
  readonly eventLog?: EventLogSystem;
  readonly getCurrentTurn?: () => number;
  readonly grantCultureBurst?: (nationId: string, amount: number) => void;
  readonly recalculateHappiness?: (nationId: string) => void;
}

type FoundedListener = (result: CorporationFoundResult) => void;

export class CorporationSystem {
  private readonly founded = new Map<string, Corporation>();
  private readonly foundedListeners: FoundedListener[] = [];

  constructor(
    private readonly nationManager: NationManager,
    private readonly cityManager: CityManager,
    private readonly context: CorporationFoundContext,
    private readonly definitions: readonly CorporationDefinition[] = CORPORATIONS,
  ) {
    for (const error of validateCorporationDefinitions(definitions)) {
      console.warn(`[CorporationSystem] ${error}`);
    }
  }

  isFounded(corporationId: string): boolean {
    return this.founded.has(corporationId);
  }

  canFoundCorporation(nationId: string, corporationId: string): boolean {
    return this.getFoundingBlockers(nationId, corporationId).length === 0;
  }

  getFoundingBlockers(nationId: string, corporationId: string): string[] {
    const nation = this.nationManager.getNation(nationId);
    const corporation = this.getDefinition(corporationId);
    if (!nation) return [`unknown nation: ${nationId}`];
    if (!corporation) return [`unknown corporation: ${corporationId}`];
    if (this.isFounded(corporation.id)) return ['already founded'];

    const missing: string[] = [];
    for (const techId of corporation.requiredTechIds) {
      if (!this.context.researchSystem.isResearched(nationId, techId)) {
        missing.push(`missing technology: ${techId}`);
      }
    }
    for (const resourceId of corporation.requiredResourceIds ?? []) {
      if (!this.context.resourceAccessSystem.hasResource(nationId, resourceId)) {
        missing.push(`missing resource: ${resourceId}`);
      }
    }
    for (const buildingId of corporation.requiredBuildingIds ?? []) {
      if (!this.hasNationBuilding(nationId, buildingId)) {
        missing.push(`missing building: ${buildingId}`);
      }
    }

    return missing;
  }

  getMissingRequirements(nationId: string, corporationId: string): string[] {
    return this.getFoundingBlockers(nationId, corporationId);
  }

  canCityProduceCorporation(city: City, corporationId: string): boolean {
    return this.getCityCorporationBlockers(city, corporationId).length === 0;
  }

  getCityCorporationBlockers(city: City, corporationId: string): string[] {
    const blockers = [...this.getFoundingBlockers(city.ownerId, corporationId)];
    const corporation = this.getDefinition(corporationId);
    if (!corporation) return blockers;

    const cityBuildings = this.cityManager.getBuildings(city.id);
    if (!cityBuildings.has(corporation.productionBuildingId)) {
      blockers.push(`city missing production building: ${corporation.productionBuildingId}`);
    }

    return blockers;
  }

  foundCorporation(nationId: string, corporationId: string, cityId?: string): boolean {
    if (!this.canFoundCorporation(nationId, corporationId)) return false;

    const corporation = this.getDefinition(corporationId);
    if (!corporation) return false;

    const founded: Corporation = {
      corporationId: corporation.id,
      founderNationId: nationId,
      cityId,
      foundedTurn: this.context.getCurrentTurn?.() ?? 0,
    };
    this.founded.set(corporation.id, founded);

    this.context.grantCultureBurst?.(nationId, corporation.cultureBurst);
    this.context.recalculateHappiness?.(nationId);
    this.logFounded(nationId, corporation);
    this.notifyFounded({ founded, definition: corporation });

    return true;
  }

  foundAvailableCorporationsForNation(nationId: string): Corporation[] {
    const founded: Corporation[] = [];
    for (const corporation of this.definitions) {
      if (!this.foundCorporation(nationId, corporation.id)) continue;
      const state = this.getFoundedCorporation(corporation.id);
      if (state) founded.push(state);
    }
    return founded;
  }

  getFoundedCorporations(): readonly Corporation[] {
    return [...this.founded.values()].map((corporation) => ({ ...corporation }));
  }

  getFoundedCorporation(corporationId: string): Corporation | undefined {
    const corporation = this.founded.get(corporationId);
    return corporation ? { ...corporation } : undefined;
  }

  getFoundedCorporationsForNation(nationId: string): Corporation[] {
    return this.getFoundedCorporations().filter((corporation) => corporation.founderNationId === nationId);
  }

  getCorporationsForNation(nationId: string): readonly Corporation[] {
    return this.getFoundedCorporationsForNation(nationId);
  }

  getNationHappinessBonus(nationId: string): number {
    return this.getFoundedCorporationsForNation(nationId).reduce((sum, founded) => {
      const definition = this.getDefinition(founded.corporationId);
      return sum + (definition?.happinessBonus ?? 0);
    }, 0);
  }

  getNationManufacturedResources(nationId: string): ReadonlyMap<string, number> {
    const quantities = new Map<string, number>();
    const eligibleCorporationIds = new Set<string>();
    const foundedCorporations = [...this.founded.values()]
      .filter((founded) => founded.founderNationId === nationId);

    let changed = true;
    while (changed) {
      changed = false;
      for (const founded of foundedCorporations) {
        if (eligibleCorporationIds.has(founded.corporationId)) continue;
        const corporation = this.getDefinition(founded.corporationId);
        if (!corporation) continue;
        if (!this.hasRequiredResourcesForProduction(nationId, corporation, quantities)) continue;
        const produced = this.getManufacturedQuantityFromCorporation(nationId, corporation);
        if (produced <= 0) continue;

        eligibleCorporationIds.add(corporation.id);
        quantities.set(
          corporation.manufacturedResourceId,
          (quantities.get(corporation.manufacturedResourceId) ?? 0) + produced,
        );
        changed = true;
      }
    }

    return new Map([...quantities.entries()].sort(([a], [b]) => a.localeCompare(b)));
  }

  private getManufacturedQuantityFromCorporation(
    nationId: string,
    corporation: CorporationDefinition,
  ): number {
    const producingCityCount = this.cityManager.getCitiesByOwner(nationId).filter((city) =>
      this.cityManager.getBuildings(city.id).has(corporation.productionBuildingId),
    ).length;
    return producingCityCount * corporation.resourcePerBuilding;
  }

  private hasRequiredResourcesForProduction(
    nationId: string,
    corporation: CorporationDefinition,
    manufacturedQuantities: ReadonlyMap<string, number>,
  ): boolean {
    return (corporation.requiredResourceIds ?? []).every((resourceId) => {
      if (getManufacturedResourceById(resourceId)) {
        return (manufacturedQuantities.get(resourceId) ?? 0) > 0
          || this.context.resourceAccessSystem.getImportedResourceSourceCount(nationId, resourceId) > 0;
      }
      return this.context.resourceAccessSystem.getMapOrImportedResourceSourceCount(nationId, resourceId) > 0;
    });
  }

  restoreFoundedCorporation(corporation: Corporation): void {
    if (!this.getDefinition(corporation.corporationId)) {
      console.warn(`[CorporationSystem] Unknown corporation id during restore: ${corporation.corporationId}`);
      return;
    }
    if (!this.nationManager.getNation(corporation.founderNationId)) {
      console.warn(`[CorporationSystem] Unknown founder nation during restore: ${corporation.founderNationId}`);
      return;
    }
    this.founded.set(corporation.corporationId, { ...corporation });
  }

  clearAll(): void {
    this.founded.clear();
  }

  onCorporationFounded(listener: FoundedListener): void {
    this.foundedListeners.push(listener);
  }

  private getDefinition(corporationId: string): CorporationDefinition | undefined {
    return this.definitions.find((definition) => definition.id === corporationId)
      ?? getCorporationById(corporationId);
  }

  private hasNationBuilding(nationId: string, buildingId: string): boolean {
    return this.cityManager.getCitiesByOwner(nationId).some((city) =>
      this.cityManager.getBuildings(city.id).has(buildingId),
    );
  }

  private logFounded(nationId: string, corporation: CorporationDefinition): void {
    const nation = this.nationManager.getNation(nationId);
    if (!nation || !this.context.eventLog) return;

    this.context.eventLog.log(
      `${nation.name} founded ${corporation.name}.`,
      [nation.id],
      this.context.getCurrentTurn?.() ?? 0,
    );
  }

  private notifyFounded(result: CorporationFoundResult): void {
    for (const listener of this.foundedListeners) listener(result);
  }
}
