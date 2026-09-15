import { TERRITORIAL_CLAIM_RULES } from '../data/territorialClaims';
import type { Unit } from '../entities/Unit';
import type { City } from '../entities/City';
import { TileType, type MapData, type Tile } from '../types/map';
import type { IGridSystem } from './grid/IGridSystem';

export function getPoliticalOwnerId(tile: Tile): string | undefined {
  return tile.ownerId ?? tile.territorialClaimNationId;
}

export function canFoundOnTerritorialClaim(tile: Tile, nationId: string): boolean {
  return tile.territorialClaimNationId === undefined || tile.territorialClaimNationId === nationId;
}

export interface ClaimAbsorbedEvent {
  claimantId: string;
  acquiringNationId: string;
  x: number;
  y: number;
}
// All existing city acquisition paths share a map-scoped event sink, including
// ResourceSystem's organic growth and founding. No claim state lives here.
const absorptionListeners = new WeakMap<MapData, (event: ClaimAbsorbedEvent) => void>();
export function onTerritorialClaimAbsorbed(map: MapData, listener: (event: ClaimAbsorbedEvent) => void): void {
  absorptionListeners.set(map, listener);
}

/** Called only when a city actually acquires a tile, never on radius changes. */
export function absorbTerritorialClaim(map: MapData, tile: Tile, acquiringNationId: string): void {
  const claimantId = tile.territorialClaimNationId;
  delete tile.territorialClaimNationId;
  if (claimantId !== undefined && claimantId !== acquiringNationId) {
    absorptionListeners.get(map)?.({ claimantId, acquiringNationId, x: tile.x, y: tile.y });
  }
}

export function getTerritorialClaimTint(primaryColor: number): number {
  const lighten = (channel: number) => Math.round(channel + (255 - channel) * 0.6);
  return (lighten((primaryColor >> 16) & 255) << 16)
    | (lighten((primaryColor >> 8) & 255) << 8) | lighten(primaryColor & 255);
}

export function isClaimableNeutralLand(tile: Tile): boolean {
  return getPoliticalOwnerId(tile) === undefined
    && tile.type !== TileType.Ocean && tile.type !== TileType.Coast
    && tile.type !== TileType.Ice && tile.type !== TileType.NuclearWaste
    && !tile.urbanSlot && !tile.buildingId && !tile.buildingConstruction
    && !tile.wonderId && !tile.wonderConstruction
    && !tile.improvementId && !tile.improvementConstruction
    && !tile.resourceOwnerNationId;
}

export interface TerritorialClaimContext {
  mapData: MapData;
  gridSystem: IGridSystem;
  getCities(nationId: string): readonly City[];
  getGold(nationId: string): number;
  addGold(nationId: string, amount: number): void;
  getUnit(id: string): Unit | undefined;
  removeUnit(id: string): void;
  getActiveNationId(): string;
  isHumanNation(nationId: string): boolean;
  onChanged(): void;
}

export class TerritorialClaimSystem {
  constructor(private readonly context: TerritorialClaimContext) {}

  getClaimPreview(unit: Unit): { canClaim: boolean; reason?: string } {
    const ctx = this.context;
    const fail = (reason: string) => ({ canClaim: false, reason });
    if (unit.unitType.id !== 'surveyor' || ctx.getUnit(unit.id) !== unit) return fail('Requires a Surveyor.');
    if (!ctx.isHumanNation(unit.ownerId)) return fail('Only human players can establish Territorial Claims.');
    if (unit.ownerId !== ctx.getActiveNationId()) return fail('Wait for your turn.');
    if (unit.carriedByUnitId) return fail('Disembark before claiming territory.');
    const tile = ctx.mapData.tiles[unit.tileY]?.[unit.tileX];
    if (!tile || !isClaimableNeutralLand(tile)) return fail('Requires neutral, unclaimed land without structures.');
    if (!ctx.getCities(unit.ownerId).some(city => ctx.gridSystem.getDistance(
      { x: city.tileX, y: city.tileY }, tile,
    ) <= TERRITORIAL_CLAIM_RULES.maxCityDistance)) return fail(`Must be within ${TERRITORIAL_CLAIM_RULES.maxCityDistance} hexes of an owned city.`);
    if (ctx.getGold(unit.ownerId) < TERRITORIAL_CLAIM_RULES.goldCost) return fail(`Requires ${TERRITORIAL_CLAIM_RULES.goldCost} Gold.`);
    return { canClaim: true };
  }

  claimTerritory(unit: Unit): boolean {
    if (!this.getClaimPreview(unit).canClaim) return false;
    const ctx = this.context;
    ctx.addGold(unit.ownerId, -TERRITORIAL_CLAIM_RULES.goldCost);
    ctx.mapData.tiles[unit.tileY][unit.tileX].territorialClaimNationId = unit.ownerId;
    ctx.removeUnit(unit.id);
    ctx.onChanged();
    return true;
  }
}
