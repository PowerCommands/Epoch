import type { City } from '../entities/City';
import type { CityBuildings } from '../entities/CityBuildings';
import { getBuildingById } from '../data/buildings';
import { TileType, type MapData } from '../types/map';

/** Clockwise, starting upper-left, in Epoch's pointy-top axial (q,r) grid. */
export const URBAN_SLOTS = [
  { position: 'upper-left', buildingId: 'forge', dq: 0, dr: -1 },
  { position: 'upper-right', buildingId: 'aqueduct', dq: 1, dr: -1 },
  { position: 'right', buildingId: 'monument', dq: 1, dr: 0 },
  { position: 'lower-right', buildingId: 'water_mill', dq: 0, dr: 1 },
  { position: 'lower-left', buildingId: 'market', dq: -1, dr: 1 },
  { position: 'left', buildingId: 'sewers', dq: -1, dr: 0 },
] as const;
export const CITY_POPULATION_CAPACITY_BONUS = 5;
export type SettlementStage = 'Village' | 'City';
export const MARITIME_URBAN_BUILDINGS = ['dock', 'lighthouse', 'harbor'] as const;
export const isUrbanBuilding = (id: string): boolean => URBAN_SLOTS.some(s => s.buildingId === id) || MARITIME_URBAN_BUILDINGS.some(b => b === id);
export const isAssignedUrbanBuilding = (city: City, id: string): boolean => getUrbanSlots(city).some(s => s.buildingId === id);
/** Follow existing upgrade data to the development investment it retains. */
export function getUrbanRequirement(buildingId: string): string | undefined {
  let id: string | undefined = buildingId;
  const seen = new Set<string>();
  while (id && !seen.has(id)) {
    if (isUrbanBuilding(id)) return id;
    seen.add(id);
    id = getBuildingById(id)?.upgradesFrom;
  }
  return undefined;
}
export function getUrbanSlots(city: Pick<City, 'tileX' | 'tileY'> & Partial<Pick<City, 'urbanDevelopment'>>) {
  return URBAN_SLOTS.map((slot, i) => ({ ...slot, buildingId: city.urbanDevelopment ? city.urbanDevelopment.requirements[i] : slot.buildingId, water: !!((city.urbanDevelopment?.waterMask ?? 0) & (1 << i)), x: city.tileX + slot.dq, y: city.tileY + slot.dr }));
}

/** Reservation geometry is authoritative even before inspecting tile metadata. */
export function getUrbanSlotAt(city: Pick<City, 'tileX' | 'tileY'> & Partial<Pick<City, 'urbanDevelopment'>>, coord: { x: number; y: number }) {
  if (!canDevelopIntoCity(city)) return undefined;
  return getUrbanSlots(city).find(slot => slot.x === coord.x && slot.y === coord.y);
}

/** Physical completion counts even when damaged. Existing upgrades retain development. */
export function getSettlementStage(buildings: CityBuildings, city?: City): SettlementStage {
  if (city && !canDevelopIntoCity(city)) return 'Village';
  const completed = new Set<string>();
  for (const entry of buildings.getAllEntries()) {
    let id: string | undefined = entry.buildingId;
    while (id && !completed.has(id)) {
      completed.add(id);
      id = getBuildingById(id)?.upgradesFrom;
    }
  }
  return (city ? getUrbanSlots(city) : URBAN_SLOTS).every(s => s.buildingId !== null && completed.has(s.buildingId)) ? 'City' : 'Village';
}

export function canDevelopIntoCity(city: Pick<City, 'tileX' | 'tileY'> & Partial<Pick<City, 'urbanDevelopment'>>): boolean {
  const slots = getUrbanSlots(city);
  return slots.filter(s => s.water).length < 4 && slots.every(s => s.buildingId !== null);
}

/** Freeze the founding geography. This is never invoked by save restoration. */
export function initializeUrbanDevelopment(city: City, map: MapData): void {
  let coastCount = 0;
  let waterMask = 0;
  let mountain = false;
  const requirements = URBAN_SLOTS.map((slot, i) => {
    const terrain = map.tiles[city.tileY + slot.dr]?.[city.tileX + slot.dq]?.type;
    if (terrain === TileType.Mountain) mountain = true;
    if (terrain === TileType.Coast || terrain === TileType.Ocean) {
      waterMask |= 1 << i;
      return terrain === TileType.Coast ? MARITIME_URBAN_BUILDINGS[coastCount++] ?? null : null;
    }
    return slot.buildingId;
  });
  const blocked = mountain || requirements.some(id => id === null)
    || requirements.filter((_, i) => waterMask & (1 << i)).length >= 4;
  city.urbanDevelopment = { requirements: blocked ? requirements.map(() => null) : requirements, waterMask };
}

/** Only used for new settlements, never for loading or repairing saves. */
export function reserveUrbanSlots(city: City, map: MapData): void {
  if (!city.urbanDevelopment) initializeUrbanDevelopment(city, map);
  const slots = getUrbanSlots(city);
  const reserved = canDevelopIntoCity(city);
  for (const slot of slots) {
    const tile = map.tiles[slot.y]?.[slot.x];
    if (!tile || (tile.urbanSlot && tile.urbanSlot.cityId !== city.id)
      || (reserved && ((tile.buildingId && getUrbanRequirement(tile.buildingId) !== slot.buildingId)
      || tile.improvementId || tile.improvementConstruction || tile.wonderId || tile.wonderConstruction
      || (tile.buildingConstruction && tile.buildingConstruction.buildingId !== slot.buildingId)))) {
      throw new Error(`Settlement ${city.id} requires a complete, non-overlapping seven-hex cluster`);
    }
  }
  for (const slot of slots) {
    const tile = map.tiles[slot.y][slot.x];
    tile.urbanSlot = reserved ? { cityId: city.id, buildingId: slot.buildingId } : undefined;
    tile.ownerId = city.ownerId;
    if (!city.ownedTileCoords.some(c => c.x === slot.x && c.y === slot.y)) {
      city.ownedTileCoords.push({ x: slot.x, y: slot.y });
    }
  }
}
