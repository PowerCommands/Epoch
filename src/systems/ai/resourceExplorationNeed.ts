/**
 * Pure, deterministic decision layer connecting Strategic Resource Demand to
 * exploration. It answers a single question — *does unresolved strategic-resource
 * demand justify additional exploration capacity right now, and of what kind?* —
 * and nothing else. It never moves units, never grants hidden knowledge of where
 * resources are, and never touches Settlers, expeditions, trade or diplomacy.
 *
 * The caller (AISystem) supplies live demand, a known-source predicate and the
 * nation's current explorer capacity; this module only combines them.
 */

/** Minimum aggregate demand score for a resource to be "significant" enough to drive exploration. */
export const MEANINGFUL_RESOURCE_DEMAND_SCORE = 40;

/**
 * National cap on land Scouts while resource-driven exploration is active. Set
 * one above the routine baseline ({@link AISystem.DESIRED_SCOUT_COUNT} = 2) so a
 * genuinely resource-blocked nation explores a little harder, without spamming.
 */
export const RESOURCE_EXPLORATION_LAND_SCOUT_CAP = 3;

/** National cap on sea explorers (Scout Boats / naval recon) while active. */
export const RESOURCE_EXPLORATION_SEA_SCOUT_CAP = 1;

export interface ResourceExplorationDemand {
  readonly resourceId: string;
  readonly resourceName: string;
  readonly score: number;
}

export interface ResourceExplorationNeedInput {
  /** Ranked strategic-resource demand for the nation (from StrategicResourceDemandSystem). */
  readonly demands: readonly ResourceExplorationDemand[];
  /** True when the nation already knows a plausible source of the resource. */
  readonly hasKnownSource: (resourceId: string) => boolean;
  /** Active + queued land Scouts. */
  readonly landScoutCapacity: number;
  /** Active + queued sea explorers (Scout Boats / naval recon). */
  readonly seaScoutCapacity: number;
  /** Whether the nation can currently conduct naval exploration (coastal + can build). */
  readonly canExploreSea: boolean;
}

export interface ResourceExplorationNeed {
  /** True when at least one significant demand has no known source. */
  readonly active: boolean;
  /** The significant, source-unknown demands driving the need (ranked). */
  readonly unresolved: readonly ResourceExplorationDemand[];
  /** Whether an additional land Scout is warranted under the cap. */
  readonly wantScout: boolean;
  /** Whether an additional Scout Boat is warranted under the cap. */
  readonly wantScoutBoat: boolean;
}

export function evaluateResourceExplorationNeed(
  input: ResourceExplorationNeedInput,
): ResourceExplorationNeed {
  const unresolved = input.demands.filter((demand) =>
    demand.score >= MEANINGFUL_RESOURCE_DEMAND_SCORE && !input.hasKnownSource(demand.resourceId));

  const active = unresolved.length > 0;
  return {
    active,
    unresolved,
    wantScout: active && input.landScoutCapacity < RESOURCE_EXPLORATION_LAND_SCOUT_CAP,
    wantScoutBoat: active
      && input.canExploreSea
      && input.seaScoutCapacity < RESOURCE_EXPLORATION_SEA_SCOUT_CAP,
  };
}

/** Compact reason string, e.g. `Iron 92, Coal 60`. */
export function describeUnresolvedDemand(unresolved: readonly ResourceExplorationDemand[]): string {
  return unresolved.map((demand) => `${demand.resourceName} ${demand.score}`).join(', ');
}
