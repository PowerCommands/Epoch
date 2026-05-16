import type { City } from '../entities/City';
import type { MapData } from '../types/map';
import type { CityManager } from './CityManager';
import { CityTerritorySystem } from './CityTerritorySystem';
import { CulturalSphereSystem } from './CulturalSphereSystem';
import type { DiplomacyManager } from './DiplomacyManager';
import type { IGridSystem } from './grid/IGridSystem';
import type { NationManager } from './NationManager';
import type { ProductionSystem } from './ProductionSystem';
import type { TradeDealSystem } from './TradeDealSystem';
import type { TurnManager } from './TurnManager';
import type { UnitManager } from './UnitManager';
import type { ExileProtectionSystem } from './ExileProtectionSystem';

export type NationCollapseReason =
  | 'leader_executed'
  | 'residence_capital_captured_leader_present'
  | 'no_valid_survival_state';

export interface CollapseNationInput {
  nationId: string;
  conquerorNationId?: string;
  reason: NationCollapseReason;
  triggerCity?: City;
}

export interface NationCollapsedEvent {
  nationId: string;
  conquerorNationId?: string;
  reason: NationCollapseReason;
  triggerCity?: City;
  unitsRemoved: number;
  citiesTransferred: number;
  tradeDealsCancelled: number;
  diplomacyRelationsRemoved: number;
  exileProtectionsCancelled: number;
  occupiedCities: City[];
  message: string;
}

type NationCollapsedListener = (event: NationCollapsedEvent) => void;

export class NationCollapseSystem {
  private readonly listeners: NationCollapsedListener[] = [];
  private readonly cityTerritorySystem = new CityTerritorySystem();
  private readonly culturalSphereSystem = new CulturalSphereSystem();

  constructor(
    private readonly cityManager: CityManager,
    private readonly unitManager: UnitManager,
    private readonly nationManager: NationManager,
    private readonly turnManager: TurnManager,
    private readonly mapData: MapData,
    private readonly productionSystem: ProductionSystem,
    private readonly diplomacyManager: DiplomacyManager,
    private readonly gridSystem: IGridSystem,
    private readonly tradeDealSystem?: TradeDealSystem,
    private readonly exileProtectionSystem?: ExileProtectionSystem,
  ) {}

  onNationCollapsed(listener: NationCollapsedListener): void {
    this.listeners.push(listener);
  }

  canCollapse(input: CollapseNationInput): boolean {
    if (!this.nationManager.getNation(input.nationId)) return false;
    if (input.conquerorNationId !== undefined && input.conquerorNationId === input.nationId) return false;
    return (
      input.reason === 'leader_executed' ||
      input.reason === 'residence_capital_captured_leader_present' ||
      input.reason === 'no_valid_survival_state'
    );
  }

  collapse(input: CollapseNationInput): NationCollapsedEvent | null {
    if (!this.canCollapse(input)) return null;

    const nationName = this.nationManager.getNation(input.nationId)?.name ?? input.nationId;
    const conquerorName = input.conquerorNationId
      ? this.nationManager.getNation(input.conquerorNationId)?.name ?? input.conquerorNationId
      : undefined;

    const occupiedCitiesById = new Map<string, City>();
    if (input.triggerCity) {
      input.triggerCity.isResidenceCapital = false;
      input.triggerCity.occupiedOriginalNationId ??= input.triggerCity.originNationId;
      occupiedCitiesById.set(input.triggerCity.id, input.triggerCity);
    }

    for (const city of this.cityManager.getAllCities()) {
      if (city.ownerId === input.nationId || city.isResidenceCapital) {
        city.isResidenceCapital = false;
      }
    }

    const unitsToRemove = this.unitManager.getUnitsByOwner(input.nationId);
    for (const unit of unitsToRemove) {
      this.unitManager.removeUnit(unit.id);
    }

    let citiesTransferred = 0;
    const citiesToTransfer = this.cityManager.getCitiesByOwner(input.nationId);
    for (const city of citiesToTransfer) {
      city.isResidenceCapital = false;
      city.occupiedOriginalNationId = city.originNationId;
      if (input.conquerorNationId !== undefined) {
        this.cityManager.transferOwnership(city.id, input.conquerorNationId, this.productionSystem);
        this.cityTerritorySystem.transferCityTerritory(city, input.conquerorNationId, this.mapData);
        this.culturalSphereSystem.claimInitialCityCulture(city, this.mapData, this.gridSystem);
        citiesTransferred++;
      }
      occupiedCitiesById.set(city.id, city);
    }

    const tradeDealsCancelled = this.tradeDealSystem?.cancelDealsForNation(input.nationId, 'nation_collapsed') ?? 0;
    const exileProtectionsCancelled = this.exileProtectionSystem?.cancelAgreementsForNation(input.nationId) ?? 0;
    const diplomacyRelationsRemoved = this.diplomacyManager.removeNationRelations(input.nationId);
    this.nationManager.removeNation(input.nationId);
    this.turnManager.removeNation(input.nationId);

    const occupiedCities = Array.from(occupiedCitiesById.values());
    const event: NationCollapsedEvent = {
      nationId: input.nationId,
      conquerorNationId: input.conquerorNationId,
      reason: input.reason,
      triggerCity: input.triggerCity,
      unitsRemoved: unitsToRemove.length,
      citiesTransferred,
      tradeDealsCancelled,
      diplomacyRelationsRemoved,
      exileProtectionsCancelled,
      occupiedCities,
      message: this.formatCollapseMessage({
        nationName,
        conquerorName,
        reason: input.reason,
        triggerCity: input.triggerCity,
        unitsRemoved: unitsToRemove.length,
        occupiedCitiesCount: occupiedCities.length,
      }),
    };

    for (const listener of this.listeners) listener(event);
    return event;
  }

  private formatCollapseMessage(input: {
    nationName: string;
    conquerorName?: string;
    reason: NationCollapseReason;
    triggerCity?: City;
    unitsRemoved: number;
    occupiedCitiesCount: number;
  }): string {
    const suffix = `${input.unitsRemoved} units removed, ${input.occupiedCitiesCount} cities occupied.`;
    if (
      input.reason === 'residence_capital_captured_leader_present' &&
      input.conquerorName &&
      input.triggerCity
    ) {
      return `${input.nationName} collapsed after ${input.conquerorName} captured its residence capital with the leader present. ${suffix}`;
    }
    if (input.reason === 'leader_executed' && input.conquerorName) {
      return `${input.nationName} collapsed after ${input.conquerorName} executed its leader. ${suffix}`;
    }
    return `${input.nationName} collapsed because no valid survival state remained. ${suffix}`;
  }
}
