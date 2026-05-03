import { SCOUT } from '../../data/units';
import type { Unit } from '../../entities/Unit';
import type { GridCoord } from '../../types/grid';
import type { MapData, Tile } from '../../types/map';
import type { CityManager } from '../CityManager';
import type { EventLogSystem } from '../EventLogSystem';
import type { MovementSystem } from '../MovementSystem';
import type { NationManager } from '../NationManager';
import type { PathfindingSystem } from '../PathfindingSystem';
import type { TurnManager } from '../TurnManager';
import type { UnitChangedEvent, UnitManager } from '../UnitManager';

type TileIndex = number;
type UnitId = string;
type PointOfInterestType = 'foreignCity' | 'foreignUnit' | 'resource' | 'frontier';

interface NationExplorationKnowledge {
  readonly knownTiles: Set<TileIndex>;
  readonly visibleTiles: Set<TileIndex>;
  readonly seenResources: Set<TileIndex>;
  readonly knownForeignCities: Set<TileIndex>;
  readonly knownForeignUnits: Set<TileIndex>;
  readonly loggedForeignNationIds: Set<string>;
}

interface PointOfInterest {
  readonly type: PointOfInterestType;
  readonly tileIndex: TileIndex;
  readonly tile: Tile;
  readonly priority: number;
  readonly isEdgeFrontier: boolean;
}

interface ExplorationCandidate {
  readonly tile: Tile;
  readonly score: number;
  readonly isUnexplored: boolean;
  readonly adjacentToUnknown: boolean;
  readonly isNearOwnCity: boolean;
  readonly edgePenalty: number;
  readonly recentVisitPenalty: number;
}

const CARDINAL_DIRECTIONS: ReadonlyArray<Readonly<{ x: number; y: number }>> = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

const SCOUT_VISION_RADIUS = 3;
const MAX_TARGET_RADIUS = 12;
const RECENT_HISTORY_LIMIT = 10;
const EDGE_DISTANCE = 2;
const MIN_EDGE_DISTANCE = 3;
// After this many turns of finding no valid frontier target, a scout stops
// re-running expensive frontier scoring until the nation's known-tile set
// grows past the snapshot below — the guard against the reject-loop.
const FRONTIER_FAILURE_LIMIT = 10;
const FRONTIER_KNOWLEDGE_GROWTH_RETRY = 5;

const POI_PRIORITY: Record<PointOfInterestType, number> = {
  foreignCity: 4,
  foreignUnit: 3,
  resource: 2,
  frontier: 1,
};

export class AIExplorationSystem {
  private readonly knowledgeByNation = new Map<string, NationExplorationKnowledge>();
  private readonly explorationTargets = new Map<UnitId, TileIndex | null>();
  private readonly recentPositions = new Map<UnitId, TileIndex[]>();
  private readonly visitedTargetsByUnit = new Map<UnitId, Set<TileIndex>>();
  private readonly frontierFailuresByUnit = new Map<UnitId, number>();
  // Snapshot of nation knownTiles size when a scout was frontier-blocked.
  // Frontier scoring is skipped until the nation has explored materially more.
  private readonly frontierBlockKnowledgeSnapshot = new Map<UnitId, number>();
  private readonly frontierFallbackLogged = new Set<UnitId>();

  constructor(
    private readonly unitManager: UnitManager,
    private readonly cityManager: CityManager,
    private readonly nationManager: NationManager,
    private readonly turnManager: TurnManager,
    private readonly movementSystem: MovementSystem,
    private readonly pathfindingSystem: PathfindingSystem,
    private readonly mapData: MapData,
    private readonly eventLog: EventLogSystem,
  ) {
    this.unitManager.onUnitChanged((event) => this.handleUnitChanged(event));
  }

  runTurn(nationId: string): void {
    this.updateNationKnowledge(nationId);

    const scouts = this.unitManager.getUnitsByOwner(nationId)
      .filter((unit) => unit.unitType.id === SCOUT.id)
      .sort((a, b) => a.id.localeCompare(b.id));

    for (const scout of scouts) {
      if (scout.movementPoints <= 0) continue;
      if (this.unitManager.getUnit(scout.id) === undefined) continue;
      this.moveScout(scout);
      this.updateNationKnowledge(nationId);
    }
  }

  private handleUnitChanged(event: UnitChangedEvent): void {
    if (event.reason !== 'moved' && event.reason !== 'created') return;
    this.getKnowledge(event.unit.ownerId).knownTiles.add(this.getTileIndex(event.unit.tileX, event.unit.tileY));
  }

  private moveScout(unit: Unit): void {
    const activeTarget = this.getValidTarget(unit);
    if (activeTarget !== null) {
      if (this.moveTowardTarget(unit, activeTarget)) return;
    }

    const nextTarget = this.selectTarget(unit);
    if (nextTarget !== null) {
      this.explorationTargets.set(unit.id, nextTarget.tileIndex);
      this.log(
        unit.ownerId,
        `${this.getNationName(unit.ownerId)} Scout target assigned (${this.formatPoiType(nextTarget.type)}) at (${nextTarget.tile.x},${nextTarget.tile.y})`,
      );
      if (this.moveTowardTarget(unit, nextTarget.tileIndex)) return;
    }

    this.explorationTargets.set(unit.id, null);
    this.exploreLocally(unit);
  }

  private updateNationKnowledge(nationId: string): void {
    const knowledge = this.getKnowledge(nationId);
    knowledge.visibleTiles.clear();

    const scouts = this.unitManager.getUnitsByOwner(nationId)
      .filter((unit) => unit.unitType.id === SCOUT.id);

    for (const scout of scouts) {
      for (const tile of this.getTilesInRadius(scout.tileX, scout.tileY, SCOUT_VISION_RADIUS)) {
        const tileIndex = this.getTileIndex(tile.x, tile.y);
        knowledge.visibleTiles.add(tileIndex);
        knowledge.knownTiles.add(tileIndex);
        if (tile.resourceId !== undefined) knowledge.seenResources.add(tileIndex);
      }
    }

    for (const city of this.cityManager.getAllCities()) {
      if (city.ownerId === nationId) continue;
      const tileIndex = this.getTileIndex(city.tileX, city.tileY);
      if (!knowledge.visibleTiles.has(tileIndex)) continue;
      knowledge.knownForeignCities.add(tileIndex);
      this.logForeignDiscovery(nationId, city.ownerId, city.tileX, city.tileY, knowledge);
    }

    knowledge.knownForeignUnits.clear();
    for (const unit of this.unitManager.getAllUnits()) {
      if (unit.ownerId === nationId) continue;
      const tileIndex = this.getTileIndex(unit.tileX, unit.tileY);
      if (!knowledge.visibleTiles.has(tileIndex)) continue;
      knowledge.knownForeignUnits.add(tileIndex);
      this.logForeignDiscovery(nationId, unit.ownerId, unit.tileX, unit.tileY, knowledge);
    }
  }

  private getValidTarget(unit: Unit): TileIndex | null {
    const target = this.explorationTargets.get(unit.id) ?? null;
    if (target === null) return null;
    if (target === this.getTileIndex(unit.tileX, unit.tileY)) {
      this.markTargetVisited(unit.id, target);
      this.explorationTargets.set(unit.id, null);
      return null;
    }
    if (!this.isTargetStillRelevant(unit, target)) {
      this.explorationTargets.set(unit.id, null);
      return null;
    }
    return target;
  }

  private selectTarget(unit: Unit): PointOfInterest | null {
    if (this.isFrontierSelectionBlocked(unit)) return null;

    const visitedTargets = this.getVisitedTargets(unit.id);
    // Tiles other scouts of the same nation are already heading toward.
    // Derived live from explorationTargets so there is no extra state to sync.
    const peerTargets = this.getPeerScoutTargets(unit);

    const allPois = this.collectPointsOfInterest(unit.ownerId, true);
    const byPriority = (a: PointOfInterest, b: PointOfInterest): number => (
      b.priority - a.priority
      || this.manhattan(unit.tileX, unit.tileY, a.tile.x, a.tile.y)
        - this.manhattan(unit.tileX, unit.tileY, b.tile.x, b.tile.y)
      || a.tile.y - b.tile.y
      || a.tile.x - b.tile.x
    );

    // Prefer tiles no other scout has claimed; fall back to allowing overlap
    // only when no alternative exists.
    let primary = this.filterPois(unit, allPois, visitedTargets, peerTargets, MAX_TARGET_RADIUS, true).sort(byPriority);
    if (primary.length === 0) {
      primary = this.filterPois(unit, allPois, visitedTargets, peerTargets, MAX_TARGET_RADIUS, false).sort(byPriority);
    }
    if (primary.length > 0) {
      this.clearFrontierFailure(unit.id);
      return primary[0];
    }

    const allPoisIncEdges = this.collectPointsOfInterest(unit.ownerId, false);
    const byDistance = (a: PointOfInterest, b: PointOfInterest): number => (
      this.manhattan(unit.tileX, unit.tileY, a.tile.x, a.tile.y)
        - this.manhattan(unit.tileX, unit.tileY, b.tile.x, b.tile.y)
      || a.tile.y - b.tile.y
      || a.tile.x - b.tile.x
    );
    const edgeRadius = Math.floor(MAX_TARGET_RADIUS / 2);
    let edges = this.filterPois(
      unit,
      allPoisIncEdges.filter((poi) => poi.isEdgeFrontier),
      visitedTargets,
      peerTargets,
      edgeRadius,
      true,
    ).sort(byDistance);
    if (edges.length === 0) {
      edges = this.filterPois(
        unit,
        allPoisIncEdges.filter((poi) => poi.isEdgeFrontier),
        visitedTargets,
        peerTargets,
        edgeRadius,
        false,
      ).sort(byDistance);
    }
    if (edges.length > 0) {
      this.clearFrontierFailure(unit.id);
      return edges[0];
    }

    this.recordFrontierFailure(unit);
    return null;
  }

  private filterPois(
    unit: Unit,
    pois: PointOfInterest[],
    visitedTargets: Set<TileIndex>,
    peerTargets: Set<TileIndex>,
    radius: number,
    excludePeerTargets: boolean,
  ): PointOfInterest[] {
    return pois
      .filter((poi) => !visitedTargets.has(poi.tileIndex))
      .filter((poi) => !excludePeerTargets || !peerTargets.has(poi.tileIndex))
      .filter((poi) => this.manhattan(unit.tileX, unit.tileY, poi.tile.x, poi.tile.y) <= radius)
      .filter((poi) => this.findPathTowardTarget(unit, poi.tileIndex) !== null);
  }

  private getPeerScoutTargets(unit: Unit): Set<TileIndex> {
    const claimed = new Set<TileIndex>();
    for (const peer of this.unitManager.getUnitsByOwner(unit.ownerId)) {
      if (peer.id === unit.id) continue;
      if (peer.unitType.id !== SCOUT.id) continue;
      const target = this.explorationTargets.get(peer.id);
      if (target !== undefined && target !== null) claimed.add(target);
    }
    return claimed;
  }

  private isFrontierSelectionBlocked(unit: Unit): boolean {
    const snapshot = this.frontierBlockKnowledgeSnapshot.get(unit.id);
    if (snapshot === undefined) return false;
    const knownNow = this.getKnowledge(unit.ownerId).knownTiles.size;
    if (knownNow >= snapshot + FRONTIER_KNOWLEDGE_GROWTH_RETRY) {
      // Nation has explored materially more — let the scout retry frontier
      // scoring with the fresh knowledge.
      this.frontierBlockKnowledgeSnapshot.delete(unit.id);
      this.frontierFailuresByUnit.delete(unit.id);
      return false;
    }
    return true;
  }

  private recordFrontierFailure(unit: Unit): void {
    const failures = (this.frontierFailuresByUnit.get(unit.id) ?? 0) + 1;
    this.frontierFailuresByUnit.set(unit.id, failures);
    if (failures < FRONTIER_FAILURE_LIMIT) return;
    if (this.frontierBlockKnowledgeSnapshot.has(unit.id)) return;

    this.frontierBlockKnowledgeSnapshot.set(
      unit.id,
      this.getKnowledge(unit.ownerId).knownTiles.size,
    );
    if (!this.frontierFallbackLogged.has(unit.id)) {
      this.frontierFallbackLogged.add(unit.id);
      this.log(
        unit.ownerId,
        `${this.getNationName(unit.ownerId)} fallback to local exploration (no valid frontier)`,
      );
    }
  }

  private clearFrontierFailure(unitId: UnitId): void {
    this.frontierFailuresByUnit.delete(unitId);
    this.frontierBlockKnowledgeSnapshot.delete(unitId);
    this.frontierFallbackLogged.delete(unitId);
  }

  private collectPointsOfInterest(nationId: string, rejectEdgeFrontiers: boolean): PointOfInterest[] {
    const knowledge = this.getKnowledge(nationId);
    const byTile = new Map<TileIndex, PointOfInterest>();

    const addPoi = (type: PointOfInterestType, tileIndex: TileIndex, isEdgeFrontier = false): void => {
      const tile = this.getTileByIndex(tileIndex);
      if (tile === undefined) return;
      const next: PointOfInterest = {
        type,
        tileIndex,
        tile,
        priority: POI_PRIORITY[type] - (type === 'resource' && !this.isWithinSafeExplorationBounds(tile) ? 1.5 : 0),
        isEdgeFrontier,
      };
      const existing = byTile.get(tileIndex);
      if (!existing || next.priority > existing.priority) byTile.set(tileIndex, next);
    };

    for (const tileIndex of knowledge.knownForeignCities) addPoi('foreignCity', tileIndex);
    for (const tileIndex of knowledge.knownForeignUnits) addPoi('foreignUnit', tileIndex);
    for (const tileIndex of knowledge.seenResources) addPoi('resource', tileIndex);
    for (const tileIndex of knowledge.knownTiles) {
      if (!this.isTileAdjacentToUnknown(nationId, tileIndex)) continue;
      const tile = this.getTileByIndex(tileIndex);
      if (tile === undefined) continue;
      const isEdgeFrontier = !this.isWithinSafeExplorationBounds(tile);
      if (isEdgeFrontier && rejectEdgeFrontiers) {
        // Silently skip: when every frontier is an edge tile, the previous
        // per-tile log spammed every turn. Failure handling lives in selectTarget.
        continue;
      }
      addPoi('frontier', tileIndex, isEdgeFrontier);
    }

    return [...byTile.values()];
  }

  private moveTowardTarget(unit: Unit, targetIndex: TileIndex): boolean {
    const path = this.findPathTowardTarget(unit, targetIndex);
    if (path === null || path.length < 2) {
      this.markTargetVisited(unit.id, targetIndex);
      this.explorationTargets.set(unit.id, null);
      return false;
    }

    const nextTile = path[1];
    const fromX = unit.tileX;
    const fromY = unit.tileY;
    this.movementSystem.moveAlongPath(unit, [nextTile]);
    if (unit.tileX === fromX && unit.tileY === fromY) {
      this.markTargetVisited(unit.id, targetIndex);
      this.explorationTargets.set(unit.id, null);
      return false;
    }

    this.rememberVisit(unit.id, unit.tileX, unit.tileY);
    const target = this.getTileByIndex(targetIndex);
    if (target !== undefined) {
      this.log(unit.ownerId, `${this.getNationName(unit.ownerId)} Scout moved toward target (${target.x},${target.y})`);
    }
    if (this.getTileIndex(unit.tileX, unit.tileY) === targetIndex) {
      this.markTargetVisited(unit.id, targetIndex);
      this.explorationTargets.set(unit.id, null);
    }
    return true;
  }

  private findPathTowardTarget(unit: Unit, targetIndex: TileIndex): Tile[] | null {
    const target = this.getTileByIndex(targetIndex);
    if (target === undefined) return null;

    const direct = this.pathfindingSystem.findPath(unit, target.x, target.y, {
      respectMovementPoints: false,
    });
    if (direct !== null) return direct;

    const approachTiles = CARDINAL_DIRECTIONS
      .map((direction) => ({ x: target.x + direction.x, y: target.y + direction.y }))
      .filter((coord) => this.mapData.tiles[coord.y]?.[coord.x] !== undefined);
    return this.pathfindingSystem.findBestPathToAnyTarget(unit, approachTiles, {
      respectMovementPoints: false,
    });
  }

  private exploreLocally(unit: Unit): void {
    const candidate = this.pickBestLocalCandidate(unit);
    if (!candidate) return;

    const fromX = unit.tileX;
    const fromY = unit.tileY;
    this.movementSystem.moveAlongPath(unit, [candidate.tile]);
    if (unit.tileX === fromX && unit.tileY === fromY) return;

    this.rememberVisit(unit.id, unit.tileX, unit.tileY);
    if (this.getDistanceToEdge(fromX, fromY) < MIN_EDGE_DISTANCE && this.getDistanceToEdge(unit.tileX, unit.tileY) > this.getDistanceToEdge(fromX, fromY)) {
      this.log(unit.ownerId, `${this.getNationName(unit.ownerId)} Scout moved inward from map edge`);
    }
    this.log(unit.ownerId, `${this.getNationName(unit.ownerId)} Scout exploring locally`);
  }

  private pickBestLocalCandidate(unit: Unit): ExplorationCandidate | null {
    const candidates = CARDINAL_DIRECTIONS
      .map((direction) => this.mapData.tiles[unit.tileY + direction.y]?.[unit.tileX + direction.x])
      .filter((tile): tile is Tile => tile !== undefined)
      .filter((tile) => this.movementSystem.canMoveUnitTo(unit, tile.x, tile.y))
      .map((tile) => this.scoreLocalTile(unit, tile))
      .sort((a, b) => (
        b.score - a.score
        || a.tile.y - b.tile.y
        || a.tile.x - b.tile.x
      ));

    return candidates[0] ?? null;
  }

  private scoreLocalTile(unit: Unit, tile: Tile): ExplorationCandidate {
    const knowledge = this.getKnowledge(unit.ownerId);
    const tileIndex = this.getTileIndex(tile.x, tile.y);
    const isUnexplored = !knowledge.knownTiles.has(tileIndex);
    const adjacentToUnknown = this.isTileAdjacentToUnknown(unit.ownerId, tileIndex);
    const distanceFromOwnCity = this.getDistanceFromNearestOwnCity(unit.ownerId, tile.x, tile.y);
    const isNearOwnCity = distanceFromOwnCity < 8;
    const edgePenalty = this.getEdgePenalty(tile.x, tile.y);
    const recentVisitPenalty = (this.recentPositions.get(unit.id) ?? []).includes(tileIndex) ? 6 : 0;
    const currentEdgeDistance = this.getDistanceToEdge(unit.tileX, unit.tileY);
    const candidateEdgeDistance = this.getDistanceToEdge(tile.x, tile.y);
    const inwardEdgeAdjustment = currentEdgeDistance < MIN_EDGE_DISTANCE
      ? (candidateEdgeDistance > currentEdgeDistance ? 10 : -10)
      : 0;
    const score =
      (isUnexplored ? 8 : 0)
      + (adjacentToUnknown ? 5 : 0)
      + (isNearOwnCity ? 3 : 0)
      + inwardEdgeAdjustment
      - edgePenalty
      - recentVisitPenalty
      + this.smallRandom(unit, tile);

    return {
      tile,
      score,
      isUnexplored,
      adjacentToUnknown,
      isNearOwnCity,
      edgePenalty,
      recentVisitPenalty,
    };
  }

  private isTargetStillRelevant(unit: Unit, targetIndex: TileIndex): boolean {
    const target = this.getTileByIndex(targetIndex);
    if (target === undefined) return false;
    if (this.getVisitedTargets(unit.id).has(targetIndex)) return false;
    if (this.manhattan(unit.tileX, unit.tileY, target.x, target.y) > MAX_TARGET_RADIUS + 4) return false;

    const knowledge = this.getKnowledge(unit.ownerId);
    return knowledge.knownForeignCities.has(targetIndex)
      || knowledge.knownForeignUnits.has(targetIndex)
      || knowledge.seenResources.has(targetIndex)
      || this.isTileAdjacentToUnknown(unit.ownerId, targetIndex);
  }

  private isTileAdjacentToUnknown(nationId: string, tileIndex: TileIndex): boolean {
    const tile = this.getTileByIndex(tileIndex);
    if (tile === undefined) return false;
    const knowledge = this.getKnowledge(nationId);
    return CARDINAL_DIRECTIONS.some((direction) => {
      const neighbor = this.mapData.tiles[tile.y + direction.y]?.[tile.x + direction.x];
      return neighbor !== undefined && !knowledge.knownTiles.has(this.getTileIndex(neighbor.x, neighbor.y));
    });
  }

  private getTilesInRadius(centerX: number, centerY: number, radius: number): Tile[] {
    const tiles: Tile[] = [];
    for (let y = centerY - radius; y <= centerY + radius; y++) {
      for (let x = centerX - radius; x <= centerX + radius; x++) {
        if (this.manhattan(centerX, centerY, x, y) > radius) continue;
        const tile = this.mapData.tiles[y]?.[x];
        if (tile !== undefined) tiles.push(tile);
      }
    }
    return tiles;
  }

  private getDistanceFromNearestOwnCity(nationId: string, x: number, y: number): number {
    const cities = this.cityManager.getCitiesByOwner(nationId);
    if (cities.length === 0) return Number.POSITIVE_INFINITY;
    return cities.reduce((best, city) => Math.min(
      best,
      this.manhattan(city.tileX, city.tileY, x, y),
    ), Number.POSITIVE_INFINITY);
  }

  private getEdgePenalty(x: number, y: number): number {
    const distanceToEdge = this.getDistanceToEdge(x, y);
    return distanceToEdge <= EDGE_DISTANCE ? 4 : 0;
  }

  private getDistanceToEdge(x: number, y: number): number {
    return Math.min(x, y, this.mapData.width - 1 - x, this.mapData.height - 1 - y);
  }

  private isWithinSafeExplorationBounds(tile: Tile): boolean {
    return tile.x >= MIN_EDGE_DISTANCE
      && tile.y >= MIN_EDGE_DISTANCE
      && tile.x <= this.mapData.width - 1 - MIN_EDGE_DISTANCE
      && tile.y <= this.mapData.height - 1 - MIN_EDGE_DISTANCE;
  }

  private logForeignDiscovery(
    observerNationId: string,
    foreignNationId: string,
    x: number,
    y: number,
    knowledge: NationExplorationKnowledge,
  ): void {
    if (knowledge.loggedForeignNationIds.has(foreignNationId)) return;
    knowledge.loggedForeignNationIds.add(foreignNationId);
    this.log(
      observerNationId,
      `${this.getNationName(observerNationId)} discovered ${this.getNationName(foreignNationId)} near (${x},${y})`,
    );
  }

  private formatPoiType(type: PointOfInterestType): string {
    switch (type) {
      case 'foreignCity':
        return 'foreign city';
      case 'foreignUnit':
        return 'foreign unit';
      case 'resource':
        return 'resource';
      case 'frontier':
        return 'frontier';
    }
  }

  private markTargetVisited(unitId: UnitId, targetIndex: TileIndex): void {
    this.getVisitedTargets(unitId).add(targetIndex);
  }

  private getVisitedTargets(unitId: UnitId): Set<TileIndex> {
    let visited = this.visitedTargetsByUnit.get(unitId);
    if (!visited) {
      visited = new Set<TileIndex>();
      this.visitedTargetsByUnit.set(unitId, visited);
    }
    return visited;
  }

  private getKnowledge(nationId: string): NationExplorationKnowledge {
    let knowledge = this.knowledgeByNation.get(nationId);
    if (!knowledge) {
      knowledge = {
        knownTiles: new Set<TileIndex>(),
        visibleTiles: new Set<TileIndex>(),
        seenResources: new Set<TileIndex>(),
        knownForeignCities: new Set<TileIndex>(),
        knownForeignUnits: new Set<TileIndex>(),
        loggedForeignNationIds: new Set<string>(),
      };
      this.knowledgeByNation.set(nationId, knowledge);
    }
    return knowledge;
  }

  private rememberVisit(unitId: UnitId, x: number, y: number): void {
    const history = this.recentPositions.get(unitId) ?? [];
    history.push(this.getTileIndex(x, y));
    while (history.length > RECENT_HISTORY_LIMIT) history.shift();
    this.recentPositions.set(unitId, history);
  }

  private getTileByIndex(tileIndex: TileIndex): Tile | undefined {
    const x = tileIndex % this.mapData.width;
    const y = (tileIndex / this.mapData.width) | 0;
    return this.mapData.tiles[y]?.[x];
  }

  private getTileIndex(x: number, y: number): TileIndex {
    return y * this.mapData.width + x;
  }

  private manhattan(ax: number, ay: number, bx: number, by: number): number {
    return Math.abs(ax - bx) + Math.abs(ay - by);
  }

  private getNationName(nationId: string): string {
    return this.nationManager.getNation(nationId)?.name ?? nationId;
  }

  private log(nationId: string, message: string): void {
    this.eventLog.log(message, [nationId], this.turnManager.getCurrentRound());
  }

  private smallRandom(unit: Unit, tile: Tile): number {
    const input = `${unit.id}:${this.turnManager.getCurrentRound()}:${tile.x}:${tile.y}`;
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return ((hash >>> 0) % 1000) / 1000;
  }
}
