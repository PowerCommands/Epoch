export function getUnitSpritePath(unitId: string): string {
  return `assets/sprites/units/${unitId}.png`;
}

export function getUnitActionSpritePath(unitId: string, actionId: string): string {
  return `assets/sprites/units/${unitId}_action_${actionId}.png`;
}

export function getUnitSpriteKey(unitId: string): string {
  return `unit_${unitId}`;
}

export function getUnitActionSpriteKey(unitId: string, actionId: string): string {
  return `unit_${unitId}_action_${actionId}`;
}

export function getBuildingSpritePath(buildingId: string): string {
  return `assets/sprites/buildings/${buildingId}.png`;
}

export function getBuildingSpriteKey(buildingId: string): string {
  return `building_${buildingId}`;
}

export function getWonderSpritePath(wonderId: string): string {
  return `assets/sprites/wonders/${wonderId}.png`;
}

export function getWonderSpriteKey(wonderId: string): string {
  return `wonder_${wonderId}`;
}

export function getCorporationSpritePath(corporationId: string): string {
  return `assets/sprites/corporations/${corporationId}.png`;
}

export function getCorporationSpriteKey(corporationId: string): string {
  return `corporation_${corporationId}`;
}

export function getNaturalResourceSpritePath(resourceId: string): string {
  return `assets/sprites/resources/${resourceId}.png`;
}

export function getTechnologySpriteKey(technologyId: string): string {
  return `tech_${technologyId}`;
}

export function getTechnologySpritePath(technologyId: string): string {
  return `assets/sprites/techs/${technologyId}.png`;
}

export function getCultureSpriteKey(cultureId: string): string {
  return `culture_${cultureId}`;
}

export function getCultureSpritePath(cultureId: string): string {
  return `assets/sprites/cultures/${cultureId}.png`;
}

export function getPolicySpriteKey(policyId: string): string {
  return `policy_${policyId}`;
}

export function getPolicySpritePath(policyId: string): string {
  return `assets/sprites/policies/${policyId}.png`;
}
