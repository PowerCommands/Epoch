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

export function getWonderSpritePath(wonderId: string): string {
  return `assets/sprites/wonders/${wonderId}.png`;
}
