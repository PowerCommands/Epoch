import { getBuildingById } from '../data/buildings';
import {
  getBuildingRequiredResourceId,
  getResourceRequiringBuildingIds,
} from '../data/buildingResourceRequirements';
import { CORPORATIONS } from '../data/corporations';
import { getManufacturedResourceById } from '../data/manufacturedResources';
import { getNaturalResourceById } from '../data/naturalResources';
import { POWER_PLANTS } from '../data/powerPlants';
import { ALL_UNIT_TYPES } from '../data/units';

/**
 * Where a unit of demand for a resource comes from. Kept coarse and stable so
 * diagnostics and future acquisition logic can reason about *why* a resource is
 * wanted without depending on the exact building/unit that generated it.
 */
export type StrategicResourceDemandSource =
  | 'production-building'
  | 'power-plant'
  | 'military-unit'
  | 'corporation';

export interface StrategicResourceDemandReason {
  readonly source: StrategicResourceDemandSource;
  readonly description: string;
  readonly score: number;
}

export interface StrategicResourceDemand {
  readonly resourceId: string;
  readonly resourceName: string;
  /** Aggregate score — the sum of every contributing reason's score. */
  readonly score: number;
  readonly reasons: readonly StrategicResourceDemandReason[];
}

/**
 * Read-only view of the game state the demand model derives from. Every method
 * is a clean, existing-rule query so the system stays a pure derivation with no
 * gameplay state of its own (the only retained state is the last-logged scores
 * used purely to detect diagnostic transitions).
 */
export interface StrategicResourceDemandContext {
  getCityIds(nationId: string): readonly string[];
  cityHasBuilding(cityId: string, buildingId: string): boolean;
  /** Canonical resource access (domestic + import + exploitation, minus boycott/embargo). */
  hasResourceAccess(nationId: string, resourceId: string): boolean;
  isBuildingUnlocked(nationId: string, buildingId: string): boolean;
  isUnitUnlocked(nationId: string, unitId: string): boolean;
  isTechResearched(nationId: string, techId: string): boolean;
  isCorporationFounded(corporationId: string): boolean;
}

/**
 * Centralized, deterministic demand weights. Kept here (not scattered as magic
 * numbers) so the balance can be tuned in one place. Workshop/Factory are the
 * dominant Production bottlenecks, so their per-city weight outranks a single
 * optional military unit by design.
 */
export const STRATEGIC_RESOURCE_DEMAND_WEIGHTS = {
  /** Per city that could build a resource-gated Production building but cannot. */
  productionBuildingPerCity: 20,
  /** Cap on cities counted for a single Production building, to bound the score. */
  productionBuildingMaxCities: 6,
  /** Per unlocked-but-unbuildable power plant type. */
  powerPlant: 30,
  /** Per distinct unlocked military unit type blocked by the missing resource. */
  militaryUnitType: 8,
  /** Cap on distinct military unit types counted per resource. */
  militaryUnitMaxTypes: 3,
  /** Per corporation / manufactured-resource opportunity blocked by the missing raw material. */
  corporationOpportunity: 15,
} as const;

const WEIGHTS = STRATEGIC_RESOURCE_DEMAND_WEIGHTS;

type Logger = (nationId: string, message: string) => void;

/**
 * Answers the single question: *what strategic resources does this nation need
 * right now?* — as a ranked, aggregated list. It never decides how aggressively
 * the nation should pursue them (that is later, leader-driven logic) and takes
 * no acquisition action: no exploration, expedition, trade or diplomacy.
 *
 * Demand is recomputed from live state on every request, so when the reason for
 * a demand disappears (resource obtained, building built, corporation founded)
 * the demand automatically shrinks or vanishes.
 */
export class StrategicResourceDemandSystem {
  /** Last scores emitted per nation/resource, used only to log transitions. */
  private readonly loggedScores = new Map<string, Map<string, number>>();

  constructor(
    private readonly context: StrategicResourceDemandContext,
    private readonly log: Logger = () => {},
  ) {}

  /** Ranked (highest score first) strategic-resource demand for the nation. */
  getDemands(nationId: string): StrategicResourceDemand[] {
    const reasonsByResource = new Map<string, StrategicResourceDemandReason[]>();
    const add = (resourceId: string, reason: StrategicResourceDemandReason): void => {
      if (reason.score <= 0) return;
      const list = reasonsByResource.get(resourceId);
      if (list) list.push(reason);
      else reasonsByResource.set(resourceId, [reason]);
    };

    this.addProductionBuildingDemand(nationId, add);
    this.addPowerPlantDemand(nationId, add);
    this.addMilitaryUnitDemand(nationId, add);
    this.addCorporationDemand(nationId, add);

    const demands: StrategicResourceDemand[] = [];
    for (const [resourceId, reasons] of reasonsByResource) {
      const score = reasons.reduce((sum, reason) => sum + reason.score, 0);
      demands.push({
        resourceId,
        resourceName: getNaturalResourceById(resourceId)?.name ?? resourceId,
        score,
        reasons,
      });
    }
    return demands.sort((a, b) => (b.score - a.score) || a.resourceId.localeCompare(b.resourceId));
  }

  getDemand(nationId: string, resourceId: string): StrategicResourceDemand | undefined {
    return this.getDemands(nationId).find((demand) => demand.resourceId === resourceId);
  }

  // --- Contributors -------------------------------------------------------

  private addProductionBuildingDemand(
    nationId: string,
    add: (resourceId: string, reason: StrategicResourceDemandReason) => void,
  ): void {
    for (const buildingId of getResourceRequiringBuildingIds()) {
      const resourceId = getBuildingRequiredResourceId(buildingId);
      if (!resourceId) continue;
      // Only demand once the nation has actually reached this building; a Stone
      // Age nation must not demand Coal because Factory exists in the future.
      if (!this.context.isBuildingUnlocked(nationId, buildingId)) continue;
      if (this.context.hasResourceAccess(nationId, resourceId)) continue;

      const blockedCities = this.context.getCityIds(nationId)
        .filter((cityId) => !this.context.cityHasBuilding(cityId, buildingId)).length;
      if (blockedCities <= 0) continue;

      const counted = Math.min(blockedCities, WEIGHTS.productionBuildingMaxCities);
      const buildingName = getBuildingById(buildingId)?.name ?? buildingId;
      add(resourceId, {
        source: 'production-building',
        description: `${buildingName} blocked in ${blockedCities} ${blockedCities === 1 ? 'city' : 'cities'}`,
        score: counted * WEIGHTS.productionBuildingPerCity,
      });
    }
  }

  private addPowerPlantDemand(
    nationId: string,
    add: (resourceId: string, reason: StrategicResourceDemandReason) => void,
  ): void {
    for (const plant of POWER_PLANTS) {
      if (!this.context.isBuildingUnlocked(nationId, plant.buildingId)) continue;
      if (this.context.hasResourceAccess(nationId, plant.requiredResourceId)) continue;
      const buildingName = getBuildingById(plant.buildingId)?.name ?? plant.buildingId;
      add(plant.requiredResourceId, {
        source: 'power-plant',
        description: `${buildingName} unavailable`,
        score: WEIGHTS.powerPlant,
      });
    }
  }

  private addMilitaryUnitDemand(
    nationId: string,
    add: (resourceId: string, reason: StrategicResourceDemandReason) => void,
  ): void {
    const blockedTypesByResource = new Map<string, number>();
    for (const unitType of ALL_UNIT_TYPES) {
      const requirement = unitType.requiredResource;
      if (!requirement) continue;
      if (!this.context.isUnitUnlocked(nationId, unitType.id)) continue;
      if (this.context.hasResourceAccess(nationId, requirement.resourceId)) continue;
      blockedTypesByResource.set(
        requirement.resourceId,
        (blockedTypesByResource.get(requirement.resourceId) ?? 0) + 1,
      );
    }

    for (const [resourceId, count] of blockedTypesByResource) {
      const counted = Math.min(count, WEIGHTS.militaryUnitMaxTypes);
      add(resourceId, {
        source: 'military-unit',
        description: `${count} military unit ${count === 1 ? 'type' : 'types'} unavailable`,
        score: counted * WEIGHTS.militaryUnitType,
      });
    }
  }

  private addCorporationDemand(
    nationId: string,
    add: (resourceId: string, reason: StrategicResourceDemandReason) => void,
  ): void {
    for (const corporation of CORPORATIONS) {
      const requiredResourceIds = corporation.requiredResourceIds ?? [];
      if (requiredResourceIds.length === 0) continue;
      if (this.context.isCorporationFounded(corporation.id)) continue;
      // Relevant only once the nation has researched everything the corporation
      // needs — otherwise the opportunity is future tech, not a resource block.
      if (!corporation.requiredTechIds.every((techId) => this.context.isTechResearched(nationId, techId))) continue;

      for (const resourceId of requiredResourceIds) {
        // Raw materials only; a manufactured input is a different (upstream) chain.
        if (getManufacturedResourceById(resourceId)) continue;
        if (this.context.hasResourceAccess(nationId, resourceId)) continue;
        const productName = getManufacturedResourceById(corporation.manufacturedResourceId)?.name
          ?? corporation.name;
        add(resourceId, {
          source: 'corporation',
          description: `${productName} opportunity unavailable`,
          score: WEIGHTS.corporationOpportunity,
        });
      }
    }
  }

  // --- Diagnostics --------------------------------------------------------

  /** Compact one-line field, e.g. `Iron=94, Coal=48`; empty when no demand. */
  getDemandSummaryText(nationId: string): string {
    return this.getDemands(nationId)
      .map((demand) => `${demand.resourceName}=${demand.score}`)
      .join(', ');
  }

  /** Multi-line, grep-friendly detail block for periodic autorun diagnostics. */
  formatDemandDiagnostics(nationId: string, nationName: string): string[] {
    const demands = this.getDemands(nationId);
    if (demands.length === 0) return [];
    const lines = [`[Strategic Resource Demand] ${nationName}:`];
    for (const demand of demands) {
      const reasons = demand.reasons.map((reason) => reason.description).join(', ');
      lines.push(`${demand.resourceName} ${demand.score} — ${reasons}`);
    }
    return lines;
  }

  /**
   * Emit event-driven transition lines (created / increased / decreased /
   * resolved) since the last call for this nation. Intended to run once per
   * round per nation to avoid per-turn spam.
   */
  logTransitions(nationId: string, nationName: string): void {
    const current = new Map<string, StrategicResourceDemand>();
    for (const demand of this.getDemands(nationId)) current.set(demand.resourceId, demand);

    const previous = this.loggedScores.get(nationId) ?? new Map<string, number>();
    const next = new Map<string, number>();

    for (const [resourceId, demand] of current) {
      const before = previous.get(resourceId) ?? 0;
      if (before === 0) {
        this.log(nationId, `${nationName} strategic demand created: ${demand.resourceName}=${demand.score}`
          + ` (${demand.reasons[0]?.description ?? 'resource blocked'})`);
      } else if (demand.score > before) {
        this.log(nationId, `${nationName} strategic demand increased: ${demand.resourceName} ${before} → ${demand.score}`);
      } else if (demand.score < before) {
        this.log(nationId, `${nationName} strategic demand decreased: ${demand.resourceName} ${before} → ${demand.score}`);
      }
      next.set(resourceId, demand.score);
    }

    for (const [resourceId, before] of previous) {
      if (before > 0 && !current.has(resourceId)) {
        const resourceName = getNaturalResourceById(resourceId)?.name ?? resourceId;
        this.log(nationId, `${nationName} strategic demand resolved: ${resourceName} (Reason: resource obtained or opportunity taken)`);
      }
    }

    this.loggedScores.set(nationId, next);
  }
}
