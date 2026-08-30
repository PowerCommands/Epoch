/**
 * Buildings that require valid access to a strategic natural resource before a
 * nation may begin constructing them. This is the single source of truth for
 * both the construction-eligibility gate (see
 * {@link ../systems/BuildingResourceRequirementSystem}) and the AI's Strategic
 * Resource Demand model (see
 * {@link ../systems/StrategicResourceDemandSystem}).
 *
 * The requirement is *access*, not consumption: it controls whether
 * construction may start, never removes an already-completed building, and
 * never introduces a resource stockpile. Access is evaluated through the
 * canonical {@link ../systems/ResourceAccessSystem} so it respects domestic
 * sources, imports, Foreign Resource Exploitation, boycott and embargo exactly
 * like every other resource-dependent system.
 *
 * Power plants keep their own resource requirement in
 * {@link ./powerPlants} / {@link ../systems/PowerPlantSystem}; they are not
 * duplicated here.
 */
export const BUILDING_RESOURCE_REQUIREMENTS: Readonly<Record<string, string>> = {
  // Iron unlocks the pre-industrial Production step.
  workshop: 'iron',
  // Coal unlocks the industrial Production step.
  factory: 'coal',
};

export function getBuildingRequiredResourceId(buildingId: string): string | undefined {
  return BUILDING_RESOURCE_REQUIREMENTS[buildingId];
}

/** Building ids that carry a strategic-resource construction requirement. */
export function getResourceRequiringBuildingIds(): readonly string[] {
  return Object.keys(BUILDING_RESOURCE_REQUIREMENTS);
}
