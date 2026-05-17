import type { NationManager } from './NationManager';
import type { CityManager } from './CityManager';
import type { TurnManager } from './TurnManager';
import type { WorldMarkerSystem } from './WorldMarkerSystem';
import type { ProductionSystem } from './ProductionSystem';
import type { UnitChangedEvent, UnitManager } from './UnitManager';
import type { MovementSystem } from './MovementSystem';
import type { PathfindingSystem } from './PathfindingSystem';
import type { IGridSystem } from './grid/IGridSystem';
import type { AILogFormatter } from './ai/AILogFormatter';
import type { OverseasSettlementTarget, OverseasTargetSource } from '../types/ai/OverseasSettlementTarget';
import type { WorldMarker } from '../types/WorldMarker';
import type { MapData } from '../types/map';
import type { City } from '../entities/City';
import type { Unit } from '../entities/Unit';
import type { UnitType } from '../entities/UnitType';
import { TileType } from '../types/map';
import { cityHasWaterTile } from './ProductionRules';
import { canNationEmbarkLandUnits } from './UnitMovementRules';
import { SETTLER, TRANSPORT_SHIP } from '../data/units';

const SAILING_TECH_ID = 'sailing';
const ISLAND_DISCOVERY_MARKER_TYPE = 'islandDiscovery';

interface MarkerTargetCoord {
  readonly x: number;
  readonly y: number;
}

interface MarkerExpeditionTarget extends MarkerTargetCoord {
  readonly source: OverseasTargetSource;
}

interface OverseasEvaluation {
  readonly canSelect: boolean;
  readonly reason?: string;
  readonly bestTarget?: OverseasSettlementTarget;
}

interface StagingPlan {
  readonly coastalTile: MarkerTargetCoord;
  readonly boardingTile?: MarkerTargetCoord;
}

const fallbackFormatLog: AILogFormatter = (nationId, message) => `[r?] [?] ${nationId} (era: ancient, gold: 0, happiness: 0) ${message}`;

export class AIOverseasExpansionSystem {
  private readonly lastBlockedReasonByNation = new Map<string, string>();

  constructor(
    private readonly worldMarkerSystem: WorldMarkerSystem,
    private readonly nationManager: NationManager,
    private readonly cityManager: CityManager,
    private readonly turnManager: TurnManager,
    private readonly mapData: MapData,
    private readonly productionSystem: ProductionSystem,
    private readonly unitManager: UnitManager,
    private readonly movementSystem: MovementSystem,
    private readonly pathfindingSystem: PathfindingSystem,
    private readonly gridSystem: IGridSystem,
    private readonly formatLog: AILogFormatter = fallbackFormatLog,
    private readonly logStrategicEvent?: (nationId: string, message: string) => void,
  ) {
    this.unitManager.onUnitChanged((event) => this.handleUnitChanged(event));
  }

  runTurn(nationId: string): void {
    this.syncDiscoveredIslandMarkers(nationId);

    const nation = this.nationManager.getNation(nationId);
    if (!nation?.knownIslandTargets || nation.knownIslandTargets.length === 0) return;

    const previousSelected = nation.knownIslandTargets.find((target) => target.selected);
    const previousSelectedKey = previousSelected ? this.targetKey(previousSelected) : undefined;
    const evaluation = this.evaluateNation(nationId, nation.knownIslandTargets);

    if (!evaluation.canSelect || !evaluation.bestTarget) {
      if (evaluation.reason) this.logBlockedReasonOnce(nationId, evaluation.reason);
      return;
    }

    for (const target of nation.knownIslandTargets) {
      const selected = this.targetKey(target) === this.targetKey(evaluation.bestTarget);
      target.selected = selected;
      if (selected && target.status === 'candidate') target.status = 'selected';
    }

    const selected = nation.knownIslandTargets.find((target) => target.selected);
    if (!selected) return;
    const selectedKey = this.targetKey(selected);
    if (previousSelectedKey === selectedKey) {
      this.updateExpeditionIntent(nationId, selected);
      return;
    }

    this.lastBlockedReasonByNation.delete(nationId);
    this.log(
      nationId,
      `selected overseas expedition target ${selected.name} at (${selected.targetX},${selected.targetY})`,
    );
    this.updateExpeditionIntent(nationId, selected);
  }

  registerDiscoveredIslandMarker(nationId: string, markerId: string): boolean {
    const marker = this.worldMarkerSystem.getMarker(markerId);
    if (!marker || marker.type !== ISLAND_DISCOVERY_MARKER_TYPE) return false;

    const nation = this.nationManager.getNation(nationId);
    if (!nation) return false;
    if (!nation.knownIslandTargets) nation.knownIslandTargets = [];
    if (nation.knownIslandTargets.some((target) => target.markerId === marker.id)) return false;

    const expeditionTarget = this.getExpeditionTargetForMarker(marker);

    const target: OverseasSettlementTarget = {
      markerId: marker.id,
      name: marker.name ?? marker.id,
      targetX: expeditionTarget.x,
      targetY: expeditionTarget.y,
      source: expeditionTarget.source,
      priority: getMarkerPriority(marker),
      discoveredTurn: this.turnManager.getCurrentRound(),
      selected: false,
      status: 'candidate',
    };

    nation.knownIslandTargets.push(target);
    this.sortTargets(nation.knownIslandTargets);
    if (target.source === 'marker') {
      this.log(
        nationId,
        `registered overseas expedition target ${target.name} at marker position (${target.targetX},${target.targetY}), priority ${target.priority}`,
      );
    } else {
      this.log(
        nationId,
        `registered overseas expedition target ${target.name} at metadata target (${target.targetX},${target.targetY}), priority ${target.priority}`,
      );
    }
    return true;
  }

  getKnownIslandTargets(nationId: string): OverseasSettlementTarget[] {
    const nation = this.nationManager.getNation(nationId);
    return (nation?.knownIslandTargets ?? []).map((target) => ({ ...normalizeTarget(target) }));
  }

  runStaging(nationId: string): void {
    const target = this.getMutableSelectedTarget(nationId);
    if (!target || (target.status !== 'expeditionReady' && target.status !== 'staging')) return;

    const settler = target.assignedSettlerUnitId ? this.unitManager.getUnit(target.assignedSettlerUnitId) : undefined;
    if (!settler) return;

    const transportRequired = this.requiresTransportForOverseasExpansion(nationId);
    const transport = target.assignedTransportUnitId ? this.unitManager.getUnit(target.assignedTransportUnitId) : undefined;
    if (transportRequired && !transport) return;

    const plan = this.findStagingPlan(nationId, settler, transport);
    if (!plan) {
      this.log(nationId, `overseas expedition ${target.name} could not find a coastal staging tile.`);
      return;
    }

    if (target.status === 'expeditionReady') {
      target.status = 'staging';
      this.log(nationId, `staging overseas expedition ${target.name}.`);
    }

    this.moveUnitToward(settler, plan.coastalTile, 'Settler', target.name, 'coastal staging tile');

    if (transportRequired && transport && plan.boardingTile) {
      this.moveUnitToward(transport, plan.boardingTile, 'Transport', target.name, 'boarding tile');
      if (this.isAt(settler, plan.coastalTile) && this.isAt(transport, plan.boardingTile) && this.areAdjacent(settler, transport)) {
        target.status = 'readyToBoard';
        this.log(nationId, `overseas expedition ${target.name} is ready to board.`);
      }
      return;
    }

    if (!transportRequired && this.isAt(settler, plan.coastalTile)) {
      target.status = 'readyToEmbark';
      this.log(nationId, `overseas expedition ${target.name} is ready to embark.`);
    }
  }

  isUnitAssignedToActiveExpedition(unitId: string): boolean {
    return this.nationManager.getAllNations().some((nation) => (
      (nation.knownIslandTargets ?? []).some((target) => (
        target.status !== 'completed'
        && target.status !== 'cancelled'
        && (target.assignedSettlerUnitId === unitId || target.assignedTransportUnitId === unitId)
      ))
    ));
  }

  getSelectedOverseasTarget(nationId: string): OverseasSettlementTarget | undefined {
    const nation = this.nationManager.getNation(nationId);
    const target = nation?.knownIslandTargets?.find((candidate) => candidate.selected);
    return target ? normalizeTarget(target) : undefined;
  }

  requiresTransportForOverseasExpansion(nationId: string): boolean {
    return !canNationEmbarkLandUnits(this.nationManager.getNation(nationId));
  }

  needsSettlerForSelectedTarget(nationId: string): boolean {
    const target = this.getMutableSelectedTarget(nationId);
    if (!target || target.status === 'expeditionReady') return false;
    if (target.assignedSettlerUnitId && this.unitManager.getUnit(target.assignedSettlerUnitId)) return false;
    return !this.hasQueuedUnit(nationId, SETTLER.id);
  }

  needsTransportForSelectedTarget(nationId: string): boolean {
    if (!this.requiresTransportForOverseasExpansion(nationId)) return false;
    const target = this.getMutableSelectedTarget(nationId);
    if (!target || target.status === 'expeditionReady') return false;
    if (target.assignedTransportUnitId && this.unitManager.getUnit(target.assignedTransportUnitId)) return false;
    return !this.hasQueuedUnit(nationId, TRANSPORT_SHIP.id);
  }

  isExpeditionReady(nationId: string): boolean {
    const target = this.getMutableSelectedTarget(nationId);
    if (!target) return false;
    return this.isTargetReady(nationId, target);
  }

  getExpeditionProductionRequest(
    nationId: string,
    city: City,
    canProduceSettler: boolean,
    canProduceTransport: boolean,
  ): { unitType: UnitType; target: OverseasSettlementTarget; component: 'settler' | 'transport' } | undefined {
    const target = this.getMutableSelectedTarget(nationId);
    if (!target || target.status === 'expeditionReady') return undefined;
    this.updateExpeditionIntent(nationId, target);

    if (this.needsSettlerForSelectedTarget(nationId) && canProduceSettler) {
      return { unitType: SETTLER, target: { ...normalizeTarget(target) }, component: 'settler' };
    }

    if (
      this.needsTransportForSelectedTarget(nationId)
      && canProduceTransport
      && cityHasWaterTile(city, this.mapData)
    ) {
      return { unitType: TRANSPORT_SHIP, target: { ...normalizeTarget(target) }, component: 'transport' };
    }

    return undefined;
  }

  markProductionSelected(
    nationId: string,
    cityName: string,
    component: 'settler' | 'transport',
    targetMarkerId: string,
  ): void {
    const target = this.getMutableTarget(nationId, targetMarkerId);
    if (!target) return;
    const label = component === 'settler' ? 'Settler' : 'Transport';
    this.log(nationId, `${cityName} production selected ${label} for overseas expedition target ${target.name}.`);
  }

  getDiagnosticLines(): string[] {
    const lines: string[] = ['Known overseas targets:'];
    let wroteTarget = false;

    for (const nation of this.nationManager.getAllNations().sort((a, b) => a.name.localeCompare(b.name))) {
      const targets = nation.knownIslandTargets ?? [];
      if (targets.length === 0) continue;
      lines.push(`${nation.name}:`);
      for (const target of targets.map(normalizeTarget).sort(compareTargets)) {
        lines.push(`- ${target.name} target (${target.targetX},${target.targetY}) source: ${target.source ?? 'settlementTargetMetadata'} priority ${target.priority} [${target.status}] ${this.describeExpeditionState(nation.id, target)}`);
      }
      wroteTarget = true;
    }

    if (!wroteTarget) lines.push('- none');
    return lines;
  }

  private syncDiscoveredIslandMarkers(nationId: string): void {
    for (const marker of this.worldMarkerSystem.getDiscoveredMarkersForNation(nationId)) {
      if (marker.type !== ISLAND_DISCOVERY_MARKER_TYPE) continue;
      this.registerDiscoveredIslandMarker(nationId, marker.id);
    }
  }

  private evaluateNation(
    nationId: string,
    targets: readonly OverseasSettlementTarget[],
  ): OverseasEvaluation {
    const nation = this.nationManager.getNation(nationId);
    if (!nation) return { canSelect: false, reason: 'nation is unavailable' };
    nation.knownIslandTargets = nation.knownIslandTargets?.map(normalizeTarget);
    if (!nation.researchedTechIds.includes(SAILING_TECH_ID)) {
      return { canSelect: false, reason: 'Sailing has not been researched' };
    }
    if (!this.hasCoastalCityAccess(nationId)) {
      return { canSelect: false, reason: 'no coastal city access' };
    }

    const bestTarget = [...targets].sort(compareTargets)[0];
    if (!bestTarget) return { canSelect: false, reason: 'no known overseas targets' };
    return { canSelect: true, bestTarget };
  }

  private updateExpeditionIntent(nationId: string, target: OverseasSettlementTarget): void {
    const mutableTarget = this.getMutableTarget(nationId, target.markerId);
    if (
      !mutableTarget
      || mutableTarget.status === 'expeditionReady'
      || mutableTarget.status === 'staging'
      || mutableTarget.status === 'readyToBoard'
      || mutableTarget.status === 'readyToEmbark'
    ) return;

    if (!mutableTarget.assignedSettlerUnitId && !mutableTarget.settlerRequested) {
      mutableTarget.settlerRequested = true;
      mutableTarget.status = 'settlerRequested';
      this.log(nationId, `wants Settler for overseas expedition target ${mutableTarget.name}.`);
    }

    if (this.requiresTransportForOverseasExpansion(nationId)) {
      if (!mutableTarget.assignedTransportUnitId && !mutableTarget.transportRequested) {
        mutableTarget.transportRequested = true;
        mutableTarget.status = 'transportRequested';
        this.log(nationId, `wants Transport for overseas expedition target ${mutableTarget.name}.`);
      }
    } else if (mutableTarget.status === 'settlerRequested' || mutableTarget.status === 'selected') {
      this.log(nationId, `does not require Transport for ${mutableTarget.name} because land embarkation is available.`);
    }

    this.updateTargetReadiness(nationId, mutableTarget);
  }

  private handleUnitChanged(event: UnitChangedEvent): void {
    if (event.reason !== 'created') return;
    this.assignProducedUnit(event.unit);
  }

  private assignProducedUnit(unit: Unit): void {
    const target = this.getMutableSelectedTarget(unit.ownerId);
    if (!target || target.status === 'expeditionReady') return;

    if (
      unit.unitType.canFound === true
      && target.assignedSettlerUnitId === undefined
    ) {
      target.assignedSettlerUnitId = unit.id;
      target.status = 'expeditionPreparing';
      this.log(unit.ownerId, `assigned Settler to overseas expedition target ${target.name}.`);
      this.updateTargetReadiness(unit.ownerId, target);
      return;
    }

    if (
      this.requiresTransportForOverseasExpansion(unit.ownerId)
      && this.isTransportCapableUnit(unit)
      && target.assignedTransportUnitId === undefined
    ) {
      target.assignedTransportUnitId = unit.id;
      target.status = 'expeditionPreparing';
      this.log(unit.ownerId, `assigned Transport to overseas expedition target ${target.name}.`);
      this.updateTargetReadiness(unit.ownerId, target);
    }
  }

  private updateTargetReadiness(nationId: string, target: OverseasSettlementTarget): void {
    if (this.isTargetReady(nationId, target)) {
      if (target.status !== 'expeditionReady') {
        target.status = 'expeditionReady';
        this.log(nationId, `overseas expedition ${target.name} is ready.`);
      }
      return;
    }

    if (target.settlerRequested || target.transportRequested || target.assignedSettlerUnitId || target.assignedTransportUnitId) {
      target.status = 'expeditionPreparing';
    }
  }

  private isTargetReady(nationId: string, target: OverseasSettlementTarget): boolean {
    const settlerReady = target.assignedSettlerUnitId !== undefined
      && this.unitManager.getUnit(target.assignedSettlerUnitId) !== undefined;
    if (!settlerReady) return false;
    if (!this.requiresTransportForOverseasExpansion(nationId)) return true;
    return target.assignedTransportUnitId !== undefined
      && this.unitManager.getUnit(target.assignedTransportUnitId) !== undefined;
  }

  private getMutableSelectedTarget(nationId: string): OverseasSettlementTarget | undefined {
    const target = this.nationManager.getNation(nationId)?.knownIslandTargets?.find((candidate) => candidate.selected);
    if (!target) return undefined;
    Object.assign(target, normalizeTarget(target));
    return target;
  }

  private getMutableTarget(nationId: string, markerId: string): OverseasSettlementTarget | undefined {
    const target = this.nationManager.getNation(nationId)?.knownIslandTargets?.find((candidate) => candidate.markerId === markerId);
    if (!target) return undefined;
    Object.assign(target, normalizeTarget(target));
    return target;
  }

  private hasQueuedUnit(nationId: string, unitTypeId: string): boolean {
    return this.cityManager.getCitiesByOwner(nationId).some((city) => (
      this.productionSystem.getQueue(city.id).some((entry) => (
        entry.item.kind === 'unit' && entry.item.unitType.id === unitTypeId
      ))
    ));
  }

  private isTransportCapableUnit(unit: Unit): boolean {
    return unit.unitType.isNaval === true
      && unit.unitType.category !== 'naval_recon'
      && unit.unitType.id === TRANSPORT_SHIP.id;
  }

  private describeExpeditionState(nationId: string, target: OverseasSettlementTarget): string {
    if (target.status === 'candidate' || target.status === 'selected') return '';
    const settler = target.assignedSettlerUnitId
      ? 'assigned'
      : target.settlerRequested || this.hasQueuedUnit(nationId, SETTLER.id)
        ? 'requested'
        : 'needed';
    const transport = this.requiresTransportForOverseasExpansion(nationId)
      ? `Transport: required/${target.assignedTransportUnitId ? 'assigned' : target.transportRequested || this.hasQueuedUnit(nationId, TRANSPORT_SHIP.id) ? 'requested' : 'needed'}`
      : 'Transport: not required';
    return `Settler: ${settler}, ${transport}`;
  }

  private findStagingPlan(
    nationId: string,
    settler: Unit,
    transport: Unit | undefined,
  ): StagingPlan | undefined {
    const candidates = this.getFriendlyCoastalStagingTiles(nationId, settler.id)
      .map((coastalTile) => ({
        coastalTile,
        boardingTile: this.getBestBoardingTile(coastalTile, transport?.id),
        distance: this.gridSystem.getDistance(
          { x: settler.tileX, y: settler.tileY },
          { x: coastalTile.x, y: coastalTile.y },
        ),
      }))
      .filter((candidate) => !this.requiresTransportForOverseasExpansion(nationId) || candidate.boardingTile !== undefined)
      .sort((a, b) => {
        if (a.distance !== b.distance) return a.distance - b.distance;
        if (a.coastalTile.y !== b.coastalTile.y) return a.coastalTile.y - b.coastalTile.y;
        return a.coastalTile.x - b.coastalTile.x;
      });

    const best = candidates[0];
    if (!best) return undefined;
    return {
      coastalTile: best.coastalTile,
      boardingTile: best.boardingTile,
    };
  }

  private getFriendlyCoastalStagingTiles(nationId: string, settlerId: string): MarkerTargetCoord[] {
    const result: MarkerTargetCoord[] = [];
    for (let y = 0; y < this.mapData.height; y++) {
      for (let x = 0; x < this.mapData.width; x++) {
        const tile = this.mapData.tiles[y]?.[x];
        if (!tile || tile.ownerId !== nationId) continue;
        if (tile.type === TileType.Coast || tile.type === TileType.Ocean || tile.type === TileType.Mountain) continue;
        const occupant = this.unitManager.getUnitAt(x, y);
        if (occupant && occupant.id !== settlerId) continue;
        if (!this.hasAdjacentWaterTile(x, y)) continue;
        result.push({ x, y });
      }
    }
    return result;
  }

  private getBestBoardingTile(coastalTile: MarkerTargetCoord, transportId: string | undefined): MarkerTargetCoord | undefined {
    return this.gridSystem.getAdjacentCoords(coastalTile)
      .map((coord) => this.mapData.tiles[coord.y]?.[coord.x])
      .filter((tile) => {
        if (!tile) return false;
        if (tile.type !== TileType.Coast && tile.type !== TileType.Ocean) return false;
        const occupant = this.unitManager.getUnitAt(tile.x, tile.y);
        return occupant === null || occupant.id === transportId;
      })
      .sort((a, b) => (a.y - b.y) || (a.x - b.x))[0];
  }

  private hasAdjacentWaterTile(x: number, y: number): boolean {
    return this.gridSystem.getAdjacentCoords({ x, y }).some((coord) => {
      const tile = this.mapData.tiles[coord.y]?.[coord.x];
      return tile?.type === TileType.Coast || tile?.type === TileType.Ocean;
    });
  }

  private moveUnitToward(
    unit: Unit,
    target: MarkerTargetCoord,
    unitLabel: string,
    targetName: string,
    destinationLabel: string,
  ): void {
    if (this.isAt(unit, target)) return;
    const path = this.pathfindingSystem.findPath(unit, target.x, target.y, {
      respectMovementPoints: false,
    });
    if (!path) {
      this.log(unit.ownerId, `${unitLabel} could not find path to overseas expedition ${targetName} ${destinationLabel} (${target.x},${target.y}).`);
      return;
    }
    const beforeX = unit.tileX;
    const beforeY = unit.tileY;
    this.movementSystem.moveAlongPath(unit, path);
    if (unit.tileX === beforeX && unit.tileY === beforeY) {
      this.log(unit.ownerId, `${unitLabel} could not move toward overseas expedition ${targetName} ${destinationLabel} (${target.x},${target.y}).`);
      return;
    }
    this.log(unit.ownerId, `moved ${unitLabel} toward ${destinationLabel} (${target.x},${target.y}).`);
  }

  private isAt(unit: Unit, coord: MarkerTargetCoord): boolean {
    return unit.tileX === coord.x && unit.tileY === coord.y;
  }

  private areAdjacent(a: Unit, b: Unit): boolean {
    return this.gridSystem.isAdjacent(
      { x: a.tileX, y: a.tileY },
      { x: b.tileX, y: b.tileY },
    );
  }

  private hasCoastalCityAccess(nationId: string): boolean {
    return this.cityManager.getCitiesByOwner(nationId)
      .some((city) => cityHasWaterTile(city, this.mapData));
  }

  private getExpeditionTargetForMarker(marker: WorldMarker): MarkerExpeditionTarget {
    const metadataTarget = this.getFirstValidSettlementTarget(marker);
    if (metadataTarget) {
      return {
        ...metadataTarget,
        source: 'settlementTargetMetadata',
      };
    }

    return {
      x: marker.x,
      y: marker.y,
      source: 'marker',
    };
  }

  private getFirstValidSettlementTarget(marker: WorldMarker): MarkerTargetCoord | undefined {
    const targets = marker.metadata?.settlementTargets;
    if (!Array.isArray(targets)) return undefined;
    for (const target of targets) {
      const coord = parseSettlementTarget(target);
      if (!coord) continue;
      return coord;
    }
    return undefined;
  }

  private sortTargets(targets: OverseasSettlementTarget[]): void {
    targets.sort(compareTargets);
  }

  private targetKey(target: OverseasSettlementTarget): string {
    return `${target.markerId}:${target.targetX},${target.targetY}`;
  }

  private logBlockedReasonOnce(nationId: string, reason: string): void {
    const key = `${reason}:${this.getKnownIslandTargets(nationId).length}`;
    if (this.lastBlockedReasonByNation.get(nationId) === key) return;
    this.lastBlockedReasonByNation.set(nationId, key);
    this.log(nationId, `overseas expedition target pending: ${reason}`);
  }

  private log(nationId: string, message: string): void {
    const formatted = this.formatLog(nationId, message);
    console.log(formatted);
    this.logStrategicEvent?.(nationId, formatted);
  }
}

function compareTargets(a: OverseasSettlementTarget, b: OverseasSettlementTarget): number {
  const priorityDelta = b.priority - a.priority;
  if (priorityDelta !== 0) return priorityDelta;
  const turnDelta = a.discoveredTurn - b.discoveredTurn;
  if (turnDelta !== 0) return turnDelta;
  return a.markerId.localeCompare(b.markerId);
}

function normalizeTarget(target: OverseasSettlementTarget): OverseasSettlementTarget {
  return {
    ...target,
    source: target.source ?? 'settlementTargetMetadata',
    status: target.status ?? (target.selected ? 'selected' : 'candidate'),
  };
}

function getMarkerPriority(marker: WorldMarker): number {
  const priority = marker.metadata?.priority;
  return typeof priority === 'number' ? priority : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSettlementTarget(value: unknown): MarkerTargetCoord | undefined {
  if (!isRecord(value)) return undefined;
  const x = value.x;
  const y = value.y;
  if (typeof x !== 'number' || typeof y !== 'number') return undefined;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  return { x: Math.trunc(x), y: Math.trunc(y) };
}
