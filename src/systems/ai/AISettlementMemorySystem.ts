import { getNaturalResourceById } from '../../data/naturalResources';
import { getTerrainYield } from '../../data/terrainYields';
import type { MapData, Tile } from '../../types/map';
import { TileType } from '../../types/map';

export type SettlementCandidate = {
  x: number;
  y: number;
  scoreBase: number;
  hasStrategicResource: boolean;
  hasLuxuryResource: boolean;
  hasWaterAccess: boolean;
  hasWaterResource: boolean;
  discoveredTurn: number;
};

export type SettlementCandidateAddResult = 'added' | 'replaced' | 'duplicate' | 'rejected';

interface SettlementSiteEvaluation {
  readonly candidate: SettlementCandidate;
  readonly foodYield: number;
  readonly productionYield: number;
  readonly resourceCount: number;
}

const MAX_CANDIDATES_PER_NATION = 30;
const MIN_SETTLEMENT_CANDIDATE_SCORE = 8;
const FOUNDABLE_LAND_TYPES = new Set<TileType>([
  TileType.Plains,
  TileType.Forest,
  TileType.Mountain,
  TileType.Jungle,
  TileType.Desert,
]);
const AXIAL_DIRECTIONS: ReadonlyArray<Readonly<{ x: number; y: number }>> = [
  { x: 1, y: 0 },
  { x: 1, y: -1 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
];

let sharedMemory: AISettlementMemorySystem | null = null;
let sharedMemoryMapData: MapData | null = null;

export class AISettlementMemorySystem {
  private readonly candidatesByNation = new Map<string, SettlementCandidate[]>();

  constructor(private readonly mapData: MapData) {}

  getCandidates(nationId: string): readonly SettlementCandidate[] {
    return [...(this.candidatesByNation.get(nationId) ?? [])]
      .sort((a, b) => (
        b.scoreBase - a.scoreBase
        || a.discoveredTurn - b.discoveredTurn
        || a.y - b.y
        || a.x - b.x
      ));
  }

  addCandidate(nationId: string, candidate: SettlementCandidate): SettlementCandidateAddResult {
    if (candidate.scoreBase < MIN_SETTLEMENT_CANDIDATE_SCORE) return 'rejected';

    let candidates = this.candidatesByNation.get(nationId);
    if (!candidates) {
      candidates = [];
      this.candidatesByNation.set(nationId, candidates);
    }

    const existing = candidates.find((entry) => entry.x === candidate.x && entry.y === candidate.y);
    if (existing !== undefined) {
      if (candidate.scoreBase <= existing.scoreBase) return 'duplicate';
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

  removeCandidate(nationId: string, x: number, y: number): void {
    const candidates = this.candidatesByNation.get(nationId);
    if (!candidates) return;
    this.candidatesByNation.set(
      nationId,
      candidates.filter((candidate) => candidate.x !== x || candidate.y !== y),
    );
  }

  evaluateTile(x: number, y: number, discoveredTurn: number): SettlementSiteEvaluation | null {
    const tile = this.mapData.tiles[y]?.[x];
    if (!tile || !FOUNDABLE_LAND_TYPES.has(tile.type)) return null;

    let foodYield = 0;
    let productionYield = 0;
    let resourceCount = 0;
    let hasStrategicResource = false;
    let hasLuxuryResource = false;
    let hasWaterResource = false;

    for (const siteTile of this.getTilesInSiteRadius(x, y)) {
      const terrainYield = getTerrainYield(siteTile.type);
      foodYield += terrainYield.food;
      productionYield += terrainYield.production;

      if (siteTile.resourceId === undefined) continue;
      resourceCount++;
      const resource = getNaturalResourceById(siteTile.resourceId);
      if (resource) {
        foodYield += resource.yieldBonus.food;
        productionYield += resource.yieldBonus.production;
        if (resource.category === 'strategic') hasStrategicResource = true;
        if (resource.category === 'luxury') hasLuxuryResource = true;
      }
      if (this.isWaterTile(siteTile)) hasWaterResource = true;
    }

    const hasWaterAccess = this.getAdjacentTiles(x, y).some((adjacent) => this.isWaterTile(adjacent));
    const scoreBase =
      foodYield
      + productionYield * 1.25
      + resourceCount * 2
      + (hasStrategicResource ? 4 : 0)
      + (hasLuxuryResource ? 3 : 0)
      + (hasWaterAccess ? 2 : 0)
      + (hasWaterResource ? 3 : 0)
      + this.getTerrainAdjustment(tile);

    return {
      candidate: {
        x,
        y,
        scoreBase: Math.round(scoreBase),
        hasStrategicResource,
        hasLuxuryResource,
        hasWaterAccess,
        hasWaterResource,
        discoveredTurn,
      },
      foodYield,
      productionYield,
      resourceCount,
    };
  }

  getSiteYields(x: number, y: number): { foodYield: number; productionYield: number } {
    const evaluation = this.evaluateTile(x, y, 0);
    return {
      foodYield: evaluation?.foodYield ?? 0,
      productionYield: evaluation?.productionYield ?? 0,
    };
  }

  private sortAndCap(candidates: SettlementCandidate[]): void {
    candidates.sort((a, b) => (
      b.scoreBase - a.scoreBase
      || a.discoveredTurn - b.discoveredTurn
      || a.y - b.y
      || a.x - b.x
    ));
    candidates.splice(MAX_CANDIDATES_PER_NATION);
  }

  private getTilesInSiteRadius(centerX: number, centerY: number): Tile[] {
    const tiles: Tile[] = [];
    for (let y = centerY - 1; y <= centerY + 1; y++) {
      for (let x = centerX - 1; x <= centerX + 1; x++) {
        const tile = this.mapData.tiles[y]?.[x];
        if (tile !== undefined) tiles.push(tile);
      }
    }
    return tiles;
  }

  private getAdjacentTiles(x: number, y: number): Tile[] {
    return AXIAL_DIRECTIONS
      .map((direction) => this.mapData.tiles[y + direction.y]?.[x + direction.x])
      .filter((tile): tile is Tile => tile !== undefined);
  }

  private isWaterTile(tile: Tile): boolean {
    return tile.type === TileType.Coast || tile.type === TileType.Ocean;
  }

  private getTerrainAdjustment(tile: Tile): number {
    if (tile.type === TileType.Desert) return -2;
    if (tile.type === TileType.Mountain) return -1;
    return 0;
  }
}

export function getSharedAISettlementMemorySystem(mapData: MapData): AISettlementMemorySystem {
  if (sharedMemory === null || sharedMemoryMapData !== mapData) {
    sharedMemory = new AISettlementMemorySystem(mapData);
    sharedMemoryMapData = mapData;
  }
  return sharedMemory;
}
