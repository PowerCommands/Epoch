import { MUSEUM } from '../data/buildings';
import {
  getNaturalResourceById,
  getNaturalResourceImprovementIdForTile,
} from '../data/naturalResources';
import type { Nation } from '../entities/Nation';
import type { Unit } from '../entities/Unit';
import { ARCHAEOLOGIST } from '../data/units';
import type { MapData, Tile } from '../types/map';
import { ArchaeologicalCultureSystem } from './ArchaeologicalCultureSystem';
import type { CityManager } from './CityManager';
import { getImprovementOwnerId } from './ImprovementOwnership';

export interface NationArchaeologyDiagnostic {
  nationId: string;
  nationName: string;
  /** Currently existing Archaeologist units. */
  archaeologists: number;
  /** Archaeological resource tiles inside this nation's control (dug or not). */
  sitesControlled: number;
  /** Controlled sites with their completed excavation improvement. */
  sitesExcavated: number;
  /** Excavated Shipwreck sites controlled by this nation. */
  shipwrecksExcavated: number;
  /** Enabled archaeological Culture per turn (0 without a functioning Museum). */
  culturePerTurn: number;
  hasFunctioningMuseum: boolean;
  museumCount: number;
}

export interface WorldArchaeologyDiagnostic {
  totalResources: number;
  totalExcavated: number;
  totalShipwrecks: number;
  excavatedShipwrecks: number;
}

export interface ArchaeologyDiagnostics {
  nations: NationArchaeologyDiagnostic[];
  world: WorldArchaeologyDiagnostic;
}

interface ArchaeologicalTileState {
  tile: Tile;
  isShipwreck: boolean;
  isExcavated: boolean;
  /** Nation that controls the site (economic owner if dug, else the tile owner). */
  ownerNationId?: string;
}

function readArchaeologicalTile(tile: Tile): ArchaeologicalTileState | undefined {
  if (tile.resourceId === undefined) return undefined;
  const resource = getNaturalResourceById(tile.resourceId);
  if (resource?.archaeological !== true) return undefined;
  const requiredImprovementId = getNaturalResourceImprovementIdForTile(resource, tile.type);
  const isExcavated = requiredImprovementId !== undefined && tile.improvementId === requiredImprovementId;
  const ownerNationId = isExcavated ? getImprovementOwnerId(tile) : tile.ownerId;
  return {
    tile,
    isShipwreck: resource.id === 'shipwreck',
    isExcavated,
    ownerNationId,
  };
}

/**
 * Read-only autorun snapshot verifying the archaeology system is alive and sane
 * across a long game. Everything derives from live map/city/unit state and the
 * step-3 {@link ArchaeologicalCultureSystem} (so Museum-gated Culture is reported
 * exactly as the game applies it); it introduces no new persisted state.
 */
export function buildArchaeologyDiagnostics(
  nations: readonly Nation[],
  getUnitsByOwner: (nationId: string) => readonly Unit[],
  cityManager: CityManager,
  mapData: MapData,
  getCurrentRound: () => number = () => 0,
): ArchaeologyDiagnostics {
  const cultureSystem = new ArchaeologicalCultureSystem(mapData, cityManager, getCurrentRound);

  const world: WorldArchaeologyDiagnostic = {
    totalResources: 0,
    totalExcavated: 0,
    totalShipwrecks: 0,
    excavatedShipwrecks: 0,
  };
  const controlledByNation = new Map<string, number>();
  const excavatedByNation = new Map<string, number>();
  const excavatedShipwrecksByNation = new Map<string, number>();
  const bump = (map: Map<string, number>, key: string | undefined): void => {
    if (key === undefined) return;
    map.set(key, (map.get(key) ?? 0) + 1);
  };

  for (const row of mapData.tiles) {
    for (const tile of row) {
      const state = readArchaeologicalTile(tile);
      if (!state) continue;
      world.totalResources += 1;
      if (state.isShipwreck) world.totalShipwrecks += 1;
      if (state.isExcavated) {
        world.totalExcavated += 1;
        if (state.isShipwreck) world.excavatedShipwrecks += 1;
      }
      bump(controlledByNation, state.ownerNationId);
      if (state.isExcavated) {
        bump(excavatedByNation, state.ownerNationId);
        if (state.isShipwreck) bump(excavatedShipwrecksByNation, state.ownerNationId);
      }
    }
  }

  const nationDiagnostics = nations.map((nation): NationArchaeologyDiagnostic => {
    const summary = cultureSystem.calculateForNation(nation.id);
    const museumCount = cityManager.getCitiesByOwner(nation.id)
      .filter((city) => cityManager.getBuildings(city.id).hasActive(MUSEUM.id))
      .length;
    return {
      nationId: nation.id,
      nationName: nation.name,
      archaeologists: getUnitsByOwner(nation.id).filter((unit) => unit.unitType.id === ARCHAEOLOGIST.id).length,
      sitesControlled: controlledByNation.get(nation.id) ?? 0,
      sitesExcavated: excavatedByNation.get(nation.id) ?? 0,
      shipwrecksExcavated: excavatedShipwrecksByNation.get(nation.id) ?? 0,
      culturePerTurn: summary.baseCulturePerTurn,
      hasFunctioningMuseum: summary.hasFunctioningMuseum,
      museumCount,
    };
  });

  return { nations: nationDiagnostics, world };
}

/** Compact, grep-friendly checkpoint lines, matching the EconomyDiag style. */
export function formatArchaeologyDiagnostics(diagnostics: ArchaeologyDiagnostics): string[] {
  const lines: string[] = [];
  const { world } = diagnostics;
  lines.push(
    `[ArchaeologyDiag] world resources=${world.totalResources} excavated=${world.totalExcavated} `
    + `shipwrecks=${world.totalShipwrecks} excavatedShipwrecks=${world.excavatedShipwrecks}`,
  );
  for (const nation of diagnostics.nations) {
    // Skip nations with no archaeology footprint at all to keep the log quiet.
    if (
      nation.archaeologists === 0
      && nation.sitesControlled === 0
      && nation.museumCount === 0
    ) continue;
    lines.push(
      `[ArchaeologyDiag] ${nation.nationName} archaeologists=${nation.archaeologists} `
      + `sitesControlled=${nation.sitesControlled} sitesExcavated=${nation.sitesExcavated} `
      + `shipwrecksExcavated=${nation.shipwrecksExcavated} culturePerTurn=${nation.culturePerTurn} `
      + `museum=${nation.hasFunctioningMuseum ? 'yes' : 'no'}(${nation.museumCount})`,
    );
  }
  return lines;
}
