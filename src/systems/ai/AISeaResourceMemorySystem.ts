import { getNaturalResourceById } from '../../data/naturalResources';
import type { MapData, Tile } from '../../types/map';
import { TileType } from '../../types/map';
import type { ResourceCategory } from '../../types/naturalResources';
import { isTileImprovedForResource } from '../resource/ResourceQuantity';

export type SeaResourceCandidate = {
  x: number;
  y: number;
  resourceId: string;
  category: ResourceCategory;
  scoreBase: number;
  discoveredTurn: number;
  ownerNationId?: string;
};

export type SeaResourceCandidateAddResult = 'added' | 'replaced' | 'duplicate' | 'rejected';

const MAX_CANDIDATES_PER_NATION = 50;

let sharedMemory: AISeaResourceMemorySystem | null = null;
let sharedMemoryMapData: MapData | null = null;

export class AISeaResourceMemorySystem {
  private readonly candidatesByNation = new Map<string, SeaResourceCandidate[]>();

  constructor(private readonly mapData: MapData) {}

  getBestSeaResourceTargetsForNation(nationId: string): SeaResourceCandidate[] {
    return [...(this.candidatesByNation.get(nationId) ?? [])]
      .sort((a, b) => (
        b.scoreBase - a.scoreBase
        || a.discoveredTurn - b.discoveredTurn
        || a.y - b.y
        || a.x - b.x
      ));
  }

  rememberVisibleSeaResource(
    nationId: string,
    tile: Tile,
    discoveredTurn: number,
  ): { result: SeaResourceCandidateAddResult; candidate: SeaResourceCandidate | null } {
    const candidate = this.evaluateTile(nationId, tile, discoveredTurn);
    if (candidate === null) return { result: 'rejected', candidate: null };
    return { result: this.addCandidate(nationId, candidate), candidate };
  }

  private addCandidate(
    nationId: string,
    candidate: SeaResourceCandidate,
  ): SeaResourceCandidateAddResult {
    let candidates = this.candidatesByNation.get(nationId);
    if (!candidates) {
      candidates = [];
      this.candidatesByNation.set(nationId, candidates);
    }

    const existing = candidates.find((entry) => entry.x === candidate.x && entry.y === candidate.y);
    if (existing !== undefined) {
      const changed = existing.resourceId !== candidate.resourceId
        || existing.ownerNationId !== candidate.ownerNationId
        || existing.scoreBase !== candidate.scoreBase;
      if (!changed) return 'duplicate';
      Object.assign(existing, candidate);
      this.sortAndCap(candidates);
      return 'replaced';
    }

    if (candidates.length < MAX_CANDIDATES_PER_NATION) {
      candidates.push(candidate);
      this.sortAndCap(candidates);
      return 'added';
    }

    const weakest = candidates[candidates.length - 1];
    if (weakest === undefined || candidate.scoreBase <= weakest.scoreBase) return 'rejected';

    candidates[candidates.length - 1] = candidate;
    this.sortAndCap(candidates);
    return 'replaced';
  }

  private evaluateTile(
    nationId: string,
    tile: Tile,
    discoveredTurn: number,
  ): SeaResourceCandidate | null {
    if (!isWaterTile(tile)) return null;
    if (tile.resourceId === undefined) return null;

    const resource = getNaturalResourceById(tile.resourceId);
    if (resource === undefined) return null;

    const ownerNationId = tile.resourceOwnerNationId ?? tile.ownerId;
    let scoreBase = getResourceCategoryScore(resource.category);
    if (ownerNationId === undefined) scoreBase += 4;
    else if (ownerNationId === nationId) scoreBase += 2;
    else scoreBase -= 4;

    if (isTileImprovedForResource(tile, resource)) scoreBase -= 4;

    return {
      x: tile.x,
      y: tile.y,
      resourceId: resource.id,
      category: resource.category,
      scoreBase,
      discoveredTurn,
      ownerNationId,
    };
  }

  private sortAndCap(candidates: SeaResourceCandidate[]): void {
    candidates.sort((a, b) => (
      b.scoreBase - a.scoreBase
      || a.discoveredTurn - b.discoveredTurn
      || a.y - b.y
      || a.x - b.x
    ));
    candidates.splice(MAX_CANDIDATES_PER_NATION);
  }
}

export function getSharedAISeaResourceMemorySystem(mapData: MapData): AISeaResourceMemorySystem {
  if (sharedMemory === null || sharedMemoryMapData !== mapData) {
    sharedMemory = new AISeaResourceMemorySystem(mapData);
    sharedMemoryMapData = mapData;
  }
  return sharedMemory;
}

function getResourceCategoryScore(category: ResourceCategory): number {
  switch (category) {
    case 'bonus':
      return 6;
    case 'luxury':
      return 12;
    case 'strategic':
      return 14;
  }
}

function isWaterTile(tile: Tile): boolean {
  return tile.type === TileType.Coast || tile.type === TileType.Ocean;
}
