import type { City } from '../entities/City';
import type { DiplomacyManager, PeaceProposal } from './DiplomacyManager';
import type { CityManager } from './CityManager';
import type { NationManager } from './NationManager';
import type { ResourceSystem } from './ResourceSystem';
import type { MapData } from '../types/map';
import type { IGridSystem } from './grid/IGridSystem';
import type { ProductionSystem } from './ProductionSystem';
import type { AIMilitaryEvaluationSystem } from './ai/AIMilitaryEvaluationSystem';
import type { AIMilitaryThreatEvaluationSystem } from './ai/AIMilitaryThreatEvaluationSystem';
import type { DiplomaticEvaluationSystem } from './diplomacy/DiplomaticEvaluationSystem';
import { CityTerritorySystem } from './CityTerritorySystem';
import { CulturalSphereSystem } from './CulturalSphereSystem';
import { getLeaderPersonalityByNationId } from '../data/leaders';

export const MAX_REPARATIONS_GOLD = 10_000;
export const REPARATIONS_FRACTION = 0.5;

export class PeaceTreatySystem {
  constructor(
    private readonly cityManager: CityManager,
    private readonly nationManager: NationManager,
    private readonly resourceSystem: ResourceSystem,
    private readonly diplomacyManager: DiplomacyManager,
    private readonly mapData: MapData,
    private readonly gridSystem: IGridSystem,
    private readonly productionSystem: ProductionSystem,
    private readonly militaryEvaluationSystem?: AIMilitaryEvaluationSystem,
    private readonly threatEvaluationSystem?: AIMilitaryThreatEvaluationSystem,
    private readonly diplomaticEvaluationSystem?: DiplomaticEvaluationSystem,
  ) {}

  selectPeaceOfferCity(nationId: string): City | null {
    const cities = this.cityManager.getCitiesByOwner(nationId);
    const nonCapitals = cities.filter((c) => !c.isCapital);
    if (nonCapitals.length === 0) return null;
    // Prefer smallest population; use name as tiebreaker for determinism.
    const sorted = [...nonCapitals].sort((a, b) => {
      if (a.population !== b.population) return a.population - b.population;
      return a.name.localeCompare(b.name);
    });
    return sorted[0];
  }

  calculateReparations(nationId: string): number {
    const resources = this.nationManager.getResources(nationId);
    return Math.min(Math.floor(resources.gold * REPARATIONS_FRACTION), MAX_REPARATIONS_GOLD);
  }

  buildAIPeaceTreaty(
    proposerNationId: string,
    receiverNationId: string,
  ): { offeredCityId: string; goldReparations?: number } | null {
    const city = this.selectPeaceOfferCity(proposerNationId);
    if (!city) return null;

    const aggressorId = this.diplomacyManager.getAggressorNationId(proposerNationId, receiverNationId);
    const isAggressor = aggressorId === proposerNationId;

    return {
      offeredCityId: city.id,
      goldReparations: isAggressor ? this.calculateReparations(proposerNationId) : undefined,
    };
  }

  executeTreaty(proposal: PeaceProposal): void {
    if (proposal.offeredCityId) {
      const city = this.cityManager.getCity(proposal.offeredCityId);
      if (city) {
        city.occupiedOriginalNationId = city.originNationId !== proposal.toNationId
          ? city.originNationId
          : undefined;
        this.cityManager.transferOwnership(proposal.offeredCityId, proposal.toNationId, this.productionSystem);
        new CityTerritorySystem().transferCityTerritory(city, proposal.toNationId, this.mapData);
        new CulturalSphereSystem().claimInitialCityCulture(city, this.mapData, this.gridSystem);
      }
    }
    if (proposal.goldReparations && proposal.goldReparations > 0) {
      this.resourceSystem.addGold(proposal.fromNationId, -proposal.goldReparations);
      this.resourceSystem.addGold(proposal.toNationId, proposal.goldReparations);
    }
  }

  aiShouldAcceptTreaty(proposal: PeaceProposal, receiverNationId: string): boolean {
    if (proposal.offeredCityId) return true;

    let score = 0;

    // Long wars favor acceptance regardless of other factors.
    score += proposal.warDuration / 2;

    // Reparations add proportional value.
    if (proposal.goldReparations && proposal.goldReparations > 0) {
      score += proposal.goldReparations / 100;
    }

    // If the receiver holds a decisive military advantage they can keep fighting.
    const comparison = this.militaryEvaluationSystem?.compareMilitaryStrength(
      receiverNationId, proposal.fromNationId,
    );
    if (comparison === 'stronger') score -= 50;

    const threat = this.threatEvaluationSystem?.getThreatLevel(
      receiverNationId, proposal.fromNationId,
    );
    if (threat === 'high') score += 30;

    const evaluation = this.diplomaticEvaluationSystem?.evaluateRelation(
      receiverNationId, proposal.fromNationId,
    );
    if (evaluation?.attitude === 'afraid') score += 30;
    if (evaluation?.attitude === 'hostile') score -= 20;

    const resources = this.nationManager.getResources(receiverNationId);
    if (resources.gold < 0) score += 20;

    const personality = getLeaderPersonalityByNationId(receiverNationId);
    score += (personality.peacePreference - 50) / 2;

    return score > 0;
  }
}
