import type { CityManager } from './CityManager';
import type { NationManager } from './NationManager';
import type { ProductionSystem } from './ProductionSystem';
import type { ResourceSystem } from './ResourceSystem';
import { isMilitaryProductionUnit } from './ProductionRules';
import type { BuildingType } from '../entities/Building';

export type ProductionPurchaseQuote =
  | { ok: true; cost: number; isMilitaryUnit: boolean }
  | { ok: false; reason: string; cost?: number };

export type ProductionPurchaseResult =
  | { ok: true; cost: number; goldBefore: number; goldAfter: number }
  | { ok: false; reason: string; cost?: number };

/**
 * Shared human/AI production purchase rules and transaction pipeline.
 *
 * The live game previously had no production-unit purchase cadence. Military
 * purchases are now limited to one per nation per round for every player.
 */
export class ProductionPurchaseSystem {
  private readonly lastMilitaryPurchaseRoundByNation = new Map<string, number>();

  constructor(
    private readonly cityManager: CityManager,
    private readonly nationManager: NationManager,
    private readonly productionSystem: ProductionSystem,
    private readonly resourceSystem: ResourceSystem,
    private readonly getCurrentRound: () => number,
  ) {}

  getQuote(cityId: string, index: number): ProductionPurchaseQuote {
    const city = this.cityManager.getCity(cityId);
    if (!city) return { ok: false, reason: 'City not found' };
    const entry = this.productionSystem.getQueue(cityId)[index];
    if (!entry) return { ok: false, reason: 'Queue entry not found' };
    const cost = this.productionSystem.getBuyCost(cityId, index);
    if (cost === null) return { ok: false, reason: 'Production cannot be purchased' };

    const isMilitaryUnit = entry.item.kind === 'unit' && isMilitaryProductionUnit(entry.item.unitType);
    if (
      isMilitaryUnit
      && this.lastMilitaryPurchaseRoundByNation.get(city.ownerId) === this.getCurrentRound()
    ) {
      return { ok: false, reason: 'Only one military unit may be purchased per nation per turn', cost };
    }
    if (this.nationManager.getResources(city.ownerId).gold < cost) {
      return { ok: false, reason: 'Insufficient gold', cost };
    }
    return { ok: true, cost, isMilitaryUnit };
  }

  purchase(cityId: string, index: number): ProductionPurchaseResult {
    const quote = this.getQuote(cityId, index);
    if (!quote.ok) return quote;
    const city = this.cityManager.getCity(cityId)!;
    const resources = this.nationManager.getResources(city.ownerId);
    const goldBefore = resources.gold;

    this.resourceSystem.addGold(city.ownerId, -quote.cost);
    const completion = this.productionSystem.completeQueueEntry(cityId, index);
    if (!completion.ok) {
      this.resourceSystem.addGold(city.ownerId, quote.cost);
      return { ok: false, reason: completion.reason, cost: quote.cost };
    }

    if (quote.isMilitaryUnit) {
      this.lastMilitaryPurchaseRoundByNation.set(city.ownerId, this.getCurrentRound());
    }
    this.resourceSystem.recalculateForNation(city.ownerId);
    return {
      ok: true,
      cost: quote.cost,
      goldBefore,
      goldAfter: this.nationManager.getResources(city.ownerId).gold,
    };
  }

  /** Exact structural Gold/turn effect used by the normal resource economy. */
  getBuildingGoldPerTurnImprovement(cityId: string, building: BuildingType): number {
    return this.resourceSystem.getBuildingGoldPerTurnImprovement(cityId, building);
  }
}
