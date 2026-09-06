import { CITY_BASE_HEALTH } from '../data/cities';
import { getBuildingById } from '../data/buildings';
import { getImprovementById } from '../data/improvements';
import { getResourceDisplayName } from '../data/resources';
import { getWonderById } from '../data/wonders';
import type { City } from '../entities/City';
import type { MapData } from '../types/map';
import type { CityManager } from './CityManager';
import type { IGridSystem } from './grid/IGridSystem';
import type { NationManager } from './NationManager';
import type { UnitManager } from './UnitManager';

/** A single label/value line inside an inspection section. */
export interface TileInspectionRow {
  label: string;
  value: string;
  /** Optional nation colour, drawn as a small swatch next to the value. */
  color?: number;
  /** Marks a row that reports an anomaly (e.g. an orphaned/detached claim). */
  warning?: boolean;
}

/** A titled group of rows. */
export interface TileInspectionSection {
  heading: string;
  rows: TileInspectionRow[];
}

/** Plain, presentation-ready snapshot of everything on one tile. */
export interface TileInspectionInfo {
  title: string;
  sections: TileInspectionSection[];
}

export interface TileInspectionDeps {
  mapData: MapData;
  cityManager: CityManager;
  unitManager: UnitManager;
  nationManager: NationManager;
  gridSystem: IGridSystem;
  isResourceVisible?: (resourceId: string) => boolean;
}

function terrainLabel(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function nationName(nationManager: NationManager, nationId: string | undefined): string | undefined {
  if (nationId === undefined) return undefined;
  return nationManager.getNation(nationId)?.name ?? nationId;
}

/** Find the city whose territory (`ownedTileCoords`) contains the given tile. */
function findOwningCity(
  cityManager: CityManager,
  x: number,
  y: number,
): City | undefined {
  return cityManager
    .getAllCities()
    .find((city) => city.ownedTileCoords.some((coord) => coord.x === x && coord.y === y));
}

/**
 * Gather a read-only description of a single tile: terrain, territory ownership
 * (including which city's territory the tile belongs to), any units, buildings,
 * improvements, wonders, and a city center. Pure inspection — no gameplay state
 * is mutated. Intended to feed {@link TileInspectorDialog}.
 */
export function buildTileInspection(
  coord: { x: number; y: number },
  deps: TileInspectionDeps,
): TileInspectionInfo | null {
  const { mapData, cityManager, unitManager, nationManager, gridSystem } = deps;
  const { x, y } = coord;
  if (y < 0 || y >= mapData.height || x < 0 || x >= mapData.width) return null;
  const tile = mapData.tiles[y][x];
  if (!tile) return null;

  const sections: TileInspectionSection[] = [];

  // ── Tile ──────────────────────────────────────────────────────────────────
  const tileRows: TileInspectionRow[] = [{ label: 'Terrain', value: terrainLabel(tile.type) }];
  if (
    tile.resourceId !== undefined
    && (deps.isResourceVisible?.(tile.resourceId) ?? true)
  ) {
    tileRows.push({ label: 'Resource', value: getResourceDisplayName(tile.resourceId) });
  }
  sections.push({ heading: 'Tile', rows: tileRows });

  // ── Territory ───────────────────────────────────────────────────────────────
  const territoryRows: TileInspectionRow[] = [];
  const ownerName = nationName(nationManager, tile.ownerId);
  if (ownerName === undefined) {
    territoryRows.push({ label: 'Owner', value: 'Unclaimed' });
  } else {
    const nation = tile.ownerId ? nationManager.getNation(tile.ownerId) : undefined;
    territoryRows.push({ label: 'Owner', value: ownerName, color: nation?.color });

    const owningCity = findOwningCity(cityManager, x, y);
    if (owningCity === undefined) {
      // Territory is claimed by a nation but no city lists this tile — an
      // orphaned claim, exactly the kind of anomaly behind "loose islands".
      territoryRows.push({
        label: 'City',
        value: 'none — orphaned claim',
        warning: true,
      });
    } else {
      territoryRows.push({ label: 'City', value: owningCity.name });
      const isCenter = owningCity.tileX === x && owningCity.tileY === y;
      const distance = gridSystem.getDistance(
        { x: owningCity.tileX, y: owningCity.tileY },
        { x, y },
      );
      territoryRows.push({ label: 'Distance from center', value: `${distance}` });

      // A loose island is territory not touching any other tile of the same
      // city. Flag it so the anomaly is obvious from the dialog.
      const touchesOwnCity =
        isCenter ||
        gridSystem
          .getAdjacentCoords({ x, y })
          .some((n) =>
            owningCity.ownedTileCoords.some((c) => c.x === n.x && c.y === n.y),
          );
      territoryRows.push({
        label: 'Contiguous with city',
        value: touchesOwnCity ? 'Yes' : 'No — detached island',
        warning: !touchesOwnCity,
      });

      const isWorked = owningCity.workedTileCoords.some((c) => c.x === x && c.y === y);
      territoryRows.push({ label: 'Worked', value: isWorked ? 'Yes' : 'No' });
    }
  }

  const cultureOwner = nationName(nationManager, tile.cultureOwnerId);
  if (cultureOwner !== undefined && tile.cultureOwnerId !== tile.ownerId) {
    territoryRows.push({ label: 'Culture owner', value: cultureOwner });
  }
  const resourceClaimOwner = nationName(nationManager, tile.resourceOwnerNationId);
  if (resourceClaimOwner !== undefined) {
    territoryRows.push({ label: 'Resource claim', value: resourceClaimOwner });
  }
  sections.push({ heading: 'Territory', rows: territoryRows });

  // ── Units ─────────────────────────────────────────────────────────────────
  const units = unitManager.getUnitsAt(x, y);
  if (units.length > 0) {
    const unitRows: TileInspectionRow[] = [];
    for (const unit of units) {
      const owner = nationName(nationManager, unit.ownerId) ?? unit.ownerId;
      const nation = nationManager.getNation(unit.ownerId);
      unitRows.push({ label: 'Type', value: unit.unitType.name });
      unitRows.push({
        label: 'Health',
        value: `${unit.health} / ${unit.unitType.baseHealth}`,
      });
      unitRows.push({ label: 'Owner', value: owner, color: nation?.color });
      unitRows.push({
        label: 'Movement',
        value: `${unit.movementPoints} / ${unit.maxMovementPoints}`,
      });
      unitRows.push({ label: 'Status', value: unit.actionStatus });
    }
    sections.push({ heading: units.length > 1 ? `Units (${units.length})` : 'Unit', rows: unitRows });
  }

  // ── Buildings / improvements / wonders ──────────────────────────────────────
  const structureRows: TileInspectionRow[] = [];
  if (tile.buildingId !== undefined) {
    const name = getBuildingById(tile.buildingId)?.name ?? tile.buildingId;
    structureRows.push({
      label: 'Building',
      value: tile.buildingBroken ? `${name} (broken)` : `${name} (complete)`,
      warning: tile.buildingBroken === true,
    });
  }
  if (tile.buildingConstruction !== undefined) {
    const name =
      getBuildingById(tile.buildingConstruction.buildingId)?.name ??
      tile.buildingConstruction.buildingId;
    const city = cityManager.getCity(tile.buildingConstruction.cityId);
    structureRows.push({
      label: 'Building site',
      value: `${name} — building${city ? ` (${city.name})` : ''}`,
    });
  }
  if (tile.improvementId !== undefined) {
    const name = getImprovementById(tile.improvementId)?.name ?? tile.improvementId;
    structureRows.push({ label: 'Improvement', value: `${name} (complete)` });
  }
  if (tile.improvementConstruction !== undefined) {
    const ic = tile.improvementConstruction;
    const name = getImprovementById(ic.improvementId)?.name ?? ic.improvementId;
    const done = Math.max(0, ic.totalTurns - ic.remainingTurns);
    structureRows.push({
      label: 'Improvement site',
      value: `${name} — ${done}/${ic.totalTurns} turns`,
    });
  }
  if (tile.wonderId !== undefined) {
    const name = getWonderById(tile.wonderId)?.name ?? tile.wonderId;
    structureRows.push({ label: 'Wonder', value: `${name} (complete)` });
  }
  if (tile.wonderConstruction !== undefined) {
    const name =
      getWonderById(tile.wonderConstruction.wonderId)?.name ?? tile.wonderConstruction.wonderId;
    const city = cityManager.getCity(tile.wonderConstruction.cityId);
    structureRows.push({
      label: 'Wonder site',
      value: `${name} — building${city ? ` (${city.name})` : ''}`,
    });
  }
  if (structureRows.length > 0) {
    sections.push({ heading: 'Structures', rows: structureRows });
  }

  // ── City center ─────────────────────────────────────────────────────────────
  const city = cityManager.getCityAt(x, y);
  if (city !== undefined) {
    const owner = nationName(nationManager, city.ownerId) ?? city.ownerId;
    const nation = nationManager.getNation(city.ownerId);
    const cityRows: TileInspectionRow[] = [
      { label: 'Name', value: city.name },
      { label: 'Owner', value: owner, color: nation?.color },
      { label: 'Population', value: `${city.population}` },
      { label: 'Health', value: `${city.health} / ${CITY_BASE_HEALTH}` },
    ];
    if (city.isCapital) cityRows.push({ label: 'Capital', value: 'Yes' });
    cityRows.push({ label: 'Owned tiles', value: `${city.ownedTileCoords.length}` });
    sections.push({ heading: 'City', rows: cityRows });
  }

  return { title: `Tile (${x}, ${y})`, sections };
}
