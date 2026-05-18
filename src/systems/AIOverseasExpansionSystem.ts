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
import type { UnitBoardingManager } from './UnitBoardingManager';
import type { OverseasSettlementTarget, OverseasTargetSource } from '../types/ai/OverseasSettlementTarget';
import type { WorldMarker } from '../types/WorldMarker';
import type { MapData, Tile } from '../types/map';
import type { City } from '../entities/City';
import type { Unit } from '../entities/Unit';
import type { UnitType } from '../entities/UnitType';
import { TileType } from '../types/map';
import { cityHasWaterTile } from './ProductionRules';
import { canNationEmbarkLandUnits, canUnitEndMovementOnTile, isWaterTile } from './UnitMovementRules';
import { SETTLER, canCarryUnitType, getUnitTypeById, hasCargoCapacity } from '../data/units';
import { getEraIndex } from '../data/eraTimeline';

const SAILING_TECH_ID = 'sailing';
const ISLAND_DISCOVERY_MARKER_TYPE = 'islandDiscovery';
const LANDING_RADIUS_START = 3;
const LANDING_RADIUS_EXPAND = 5;
const LANDING_RADIUS_MAX = 8;
const DEFAULT_CITY_WITHIN_MARKER_RADIUS = 8;

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
  private readonly lastExpeditionStateByNation = new Map<string, string>();

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
    private readonly unitBoardingManager?: UnitBoardingManager,
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
      this.logExpeditionStateOnce(nationId, selected);
      return;
    }

    this.lastBlockedReasonByNation.delete(nationId);
    this.lastExpeditionStateByNation.delete(nationId);
    this.log(
      nationId,
      `selected overseas expedition target ${selected.name} at (${selected.targetX},${selected.targetY})`,
    );
    this.updateExpeditionIntent(nationId, selected);
    this.logExpeditionStateOnce(nationId, selected);
  }

  registerDiscoveredIslandMarker(nationId: string, markerId: string): boolean {
    // Fetch marker data via getMarker (bypasses claim filter) so we have the
    // data available before we attempt to claim.
    const marker = this.worldMarkerSystem.getMarker(markerId);
    if (!marker || marker.type !== ISLAND_DISCOVERY_MARKER_TYPE) return false;

    const nation = this.nationManager.getNation(nationId);
    if (!nation) return false;
    if (!nation.knownIslandTargets) nation.knownIslandTargets = [];

    // Already registered for this nation — idempotent guard (no claim needed again).
    if (nation.knownIslandTargets.some((target) => target.markerId === marker.id)) return false;

    // Per-nation region-name dedup: ignore further markers for a region we have
    // already handled, but do NOT claim them — leave them for other nations.
    if (marker.name) {
      const normalized = normalizeOverseasRegionName(marker.name);
      if (nation.handledOverseasRegionNames?.includes(normalized)) {
        this.log(nationId, `ignored island opportunity ${marker.name}: region already handled.`);
        return false;
      }
    }

    // Global claim: first nation to register this marker wins; others are blocked.
    if (this.worldMarkerSystem.isMarkerClaimed(markerId)) {
      const owner = this.worldMarkerSystem.getMarkerClaimOwner(markerId);
      const ownerName = owner ? (this.nationManager.getNation(owner)?.name ?? owner) : 'unknown';
      this.log(nationId, `island opportunity ${marker.name ?? markerId} already claimed by ${ownerName}.`);
      return false;
    }

    // Rule 2: If the nation already has a city inside this marker's radius,
    // consume the marker globally without creating an expedition.
    const existingCity = this.findCityWithinMarkerRadius(nationId, marker);
    if (existingCity) {
      if (!this.worldMarkerSystem.claimMarker(nationId, markerId)) return false;
      if (marker.name) {
        if (!nation.handledOverseasRegionNames) nation.handledOverseasRegionNames = [];
        nation.handledOverseasRegionNames.push(normalizeOverseasRegionName(marker.name));
      }
      const radius = getMarkerCheckRadius(marker);
      this.log(nationId, `claimed island opportunity ${marker.name ?? markerId} but no expedition needed: city ${existingCity.name} is within radius ${radius}.`);
      return true;
    }

    const expeditionTarget = this.getExpeditionTargetForMarker(marker);

    // Attempt the global claim before committing the target.
    if (!this.worldMarkerSystem.claimMarker(nationId, markerId)) return false;

    // Record the region name so this nation skips future markers for the same region.
    if (marker.name) {
      if (!nation.handledOverseasRegionNames) nation.handledOverseasRegionNames = [];
      nation.handledOverseasRegionNames.push(normalizeOverseasRegionName(marker.name));
    }

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
    this.log(
      nationId,
      `claimed island opportunity ${target.name} and registered overseas expedition target at ${target.source === 'marker' ? 'marker' : 'metadata'} position (${target.targetX},${target.targetY}), priority ${target.priority}`,
    );
    return true;
  }

  getKnownIslandTargets(nationId: string): OverseasSettlementTarget[] {
    const nation = this.nationManager.getNation(nationId);
    return (nation?.knownIslandTargets ?? []).map((target) => ({ ...normalizeTarget(target) }));
  }

  runStaging(nationId: string): void {
    const target = this.getMutableSelectedTarget(nationId);
    if (!target || !this.isActiveExpeditionTravelStatus(target.status)) return;

    const settler = target.assignedSettlerUnitId ? this.unitManager.getUnit(target.assignedSettlerUnitId) : undefined;
    if (!settler) {
      this.cancelExpedition(nationId, target, 'assigned Settler is missing');
      return;
    }

    const transportRequired = this.requiresTransportForOverseasExpansion(nationId);
    const transport = target.assignedTransportUnitId ? this.unitManager.getUnit(target.assignedTransportUnitId) : undefined;
    if (transportRequired && !transport) {
      this.cancelExpedition(nationId, target, 'assigned transport is missing');
      return;
    }

    if (
      transportRequired
      && transport
      && (
        target.status === 'embarked'
        || target.status === 'enRoute'
        || target.status === 'landing'
        || this.unitBoardingManager?.isCargo(settler) === true
      )
    ) {
      this.runEmbarkedExpedition(nationId, target, settler, transport);
      return;
    }

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
      if (target.status === 'readyToBoard') {
        this.boardExpeditionSettler(nationId, target, settler, transport);
        return;
      }

      this.moveUnitToward(transport, plan.boardingTile, 'Transport', target.name, 'boarding tile');
      if (this.isAt(settler, plan.coastalTile) && this.isAt(transport, plan.boardingTile) && this.areAdjacent(settler, transport)) {
        if (this.boardExpeditionSettler(nationId, target, settler, transport)) return;
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
    return !this.hasQueuedSettlerTransport(nationId);
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
    availableTransportUnitTypes: readonly UnitType[],
  ): { unitType: UnitType; target: OverseasSettlementTarget; component: 'settler' | 'transport' } | undefined {
    const target = this.getMutableSelectedTarget(nationId);
    if (!target || target.status === 'expeditionReady') return undefined;
    this.updateExpeditionIntent(nationId, target);

    if (this.needsSettlerForSelectedTarget(nationId) && canProduceSettler) {
      return { unitType: SETTLER, target: { ...normalizeTarget(target) }, component: 'settler' };
    }

    if (
      this.needsTransportForSelectedTarget(nationId)
      && cityHasWaterTile(city, this.mapData)
    ) {
      const transportType = this.chooseBestSettlerTransportUnitType(availableTransportUnitTypes);
      if (!transportType) return undefined;
      if (target.requestedTransportUnitTypeId !== transportType.id) {
        target.requestedTransportUnitTypeId = transportType.id;
        this.log(nationId, `wants ${transportType.name} for overseas expedition target ${target.name}.`);
      }
      return { unitType: transportType, target: { ...normalizeTarget(target) }, component: 'transport' };
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
    const requestedTransportType = target.requestedTransportUnitTypeId
      ? getUnitTypeById(target.requestedTransportUnitTypeId)
      : undefined;
    const label = component === 'settler'
      ? 'Settler'
      : requestedTransportType?.name ?? 'Transport';
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

    const bestTarget = targets
      .filter((target) => target.status !== 'completed' && target.status !== 'cancelled')
      .sort(compareTargets)[0];
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
      || mutableTarget.status === 'embarked'
      || mutableTarget.status === 'enRoute'
      || mutableTarget.status === 'landing'
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
      this.log(unit.ownerId, `assigned ${unit.unitType.name} to overseas expedition target ${target.name}.`);
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

  private boardExpeditionSettler(
    nationId: string,
    target: OverseasSettlementTarget,
    settler: Unit,
    transport: Unit,
  ): boolean {
    if (!this.unitBoardingManager) return false;
    if (this.unitBoardingManager.isCargo(settler)) {
      target.status = 'embarked';
      return true;
    }
    if (!this.unitBoardingManager.board(settler, transport)) {
      const reason = this.unitBoardingManager.getBoardingFailureReason(settler, transport);
      if (reason) this.log(nationId, `could not board Settler for overseas expedition ${target.name}: ${reason}.`);
      return false;
    }
    target.status = 'embarked';
    this.log(nationId, `Settler boarded ${transport.unitType.name} for overseas expedition target ${target.name}.`);
    return true;
  }

  private runEmbarkedExpedition(
    nationId: string,
    target: OverseasSettlementTarget,
    settler: Unit,
    transport: Unit,
  ): void {
    if (!this.unitBoardingManager) {
      this.cancelExpedition(nationId, target, 'boarding manager is unavailable');
      return;
    }
    if (!this.unitBoardingManager.isCargo(settler)) {
      target.status = 'staging';
      this.log(nationId, `overseas expedition ${target.name} returned to staging because Settler is not cargo.`);
      return;
    }

    const immediateLanding = this.findLandingTile(nationId, target, settler, transport);
    if (immediateLanding) {
      this.completeLanding(nationId, target, settler, immediateLanding);
      return;
    }

    const destinationWaterTiles = this.getDestinationWaterTiles(nationId, target, settler, transport);
    if (destinationWaterTiles.length === 0) {
      this.cancelExpedition(nationId, target, `no valid landing tile found near ${target.name} within radius ${LANDING_RADIUS_MAX}`);
      return;
    }

    if (target.status === 'embarked') {
      target.status = 'enRoute';
      const dest = destinationWaterTiles[0];
      this.log(
        nationId,
        `${transport.unitType.name} sailing toward ${target.name} landing water tile (${dest.x},${dest.y}), target marker (${target.targetX},${target.targetY}).`,
      );
    }

    const path = this.pathfindingSystem.findBestPathToAnyTarget(transport, destinationWaterTiles, {
      respectMovementPoints: false,
    });
    if (!path) {
      this.cancelExpedition(nationId, target, `${transport.unitType.name} could not find a naval path to ${target.name}`);
      return;
    }

    const beforeX = transport.tileX;
    const beforeY = transport.tileY;
    this.movementSystem.moveAlongPath(transport, path);

    const landingAfterMove = this.findLandingTile(nationId, target, settler, transport);
    if (landingAfterMove) {
      this.completeLanding(nationId, target, settler, landingAfterMove);
      return;
    }

    const destination = path[path.length - 1];
    if (
      destination
      && transport.tileX === beforeX
      && transport.tileY === beforeY
      && (transport.tileX !== destination.x || transport.tileY !== destination.y)
      && transport.movementPoints > 0
    ) {
      this.cancelExpedition(nationId, target, `${transport.unitType.name} could not advance toward ${target.name}`);
    }
  }

  private completeLanding(
    nationId: string,
    target: OverseasSettlementTarget,
    settler: Unit,
    landingTile: MarkerTargetCoord,
  ): void {
    if (!this.unitBoardingManager) return;
    const targetCoord = { x: target.targetX, y: target.targetY };
    const distance = this.gridSystem.getDistance(landingTile, targetCoord);
    if (distance > LANDING_RADIUS_MAX) {
      this.cancelExpedition(
        nationId,
        target,
        `landing tile (${landingTile.x},${landingTile.y}) is outside target radius for ${target.name}`,
      );
      return;
    }
    target.status = 'landing';
    this.log(
      nationId,
      `selected landing tile for ${target.name} at (${landingTile.x},${landingTile.y}), distance ${distance} from target marker.`,
    );
    if (!this.unitBoardingManager.unboard(settler, landingTile.x, landingTile.y)) {
      const reason = this.unitBoardingManager.getUnboardingFailureReason(settler, landingTile.x, landingTile.y);
      this.cancelExpedition(nationId, target, reason ? `landing failed near ${target.name}: ${reason}` : `landing failed near ${target.name}`);
      return;
    }

    this.log(nationId, `Settler unboarded near ${target.name} at (${landingTile.x},${landingTile.y}).`);
    target.status = 'completed';
    target.selected = false;
    target.assignedSettlerUnitId = undefined;
    target.assignedTransportUnitId = undefined;
    target.settlerRequested = false;
    target.transportRequested = false;
    target.requestedTransportUnitTypeId = undefined;
    this.log(nationId, `Overseas expedition to ${target.name} completed.`);
  }

  private cancelExpedition(nationId: string, target: OverseasSettlementTarget, reason: string): void {
    target.status = 'cancelled';
    target.selected = false;
    target.assignedSettlerUnitId = undefined;
    target.assignedTransportUnitId = undefined;
    target.settlerRequested = false;
    target.transportRequested = false;
    target.requestedTransportUnitTypeId = undefined;
    this.log(nationId, `overseas expedition ${target.name} cancelled: ${reason}.`);
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

  private hasQueuedSettlerTransport(nationId: string): boolean {
    return this.cityManager.getCitiesByOwner(nationId).some((city) => (
      this.productionSystem.getQueue(city.id).some((entry) => (
        entry.item.kind === 'unit' && this.isSettlerTransportUnitType(entry.item.unitType)
      ))
    ));
  }

  private isTransportCapableUnit(unit: Unit): boolean {
    return this.isSettlerTransportUnitType(unit.unitType);
  }

  private isSettlerTransportUnitType(unitType: UnitType): boolean {
    return unitType.isNaval === true
      && hasCargoCapacity(unitType)
      && canCarryUnitType(unitType, SETTLER);
  }

  private chooseBestSettlerTransportUnitType(unitTypes: readonly UnitType[]): UnitType | undefined {
    return unitTypes
      .filter((unitType) => this.isSettlerTransportUnitType(unitType))
      .sort((a, b) => {
        const eraDelta = getEraIndex(a.era) - getEraIndex(b.era);
        if (eraDelta !== 0) return eraDelta;
        const costDelta = a.productionCost - b.productionCost;
        if (costDelta !== 0) return costDelta;
        return a.name.localeCompare(b.name);
      })[0];
  }

  private describeExpeditionState(nationId: string, target: OverseasSettlementTarget): string {
    if (target.status === 'candidate' || target.status === 'selected') return '';
    const settler = target.assignedSettlerUnitId
      ? 'assigned'
      : target.settlerRequested || this.hasQueuedUnit(nationId, SETTLER.id)
        ? 'requested'
        : 'needed';
    const transport = this.requiresTransportForOverseasExpansion(nationId)
      ? `Transport: required/${target.assignedTransportUnitId ? 'assigned' : target.transportRequested || this.hasQueuedSettlerTransport(nationId) ? 'requested' : 'needed'}`
      : 'Transport: not required';
    return `Settler: ${settler}, ${transport}`;
  }

  private isActiveExpeditionTravelStatus(status: OverseasSettlementTarget['status']): boolean {
    return status === 'expeditionReady'
      || status === 'staging'
      || status === 'readyToBoard'
      || status === 'embarked'
      || status === 'enRoute'
      || status === 'landing';
  }

  private getDestinationWaterTiles(
    nationId: string,
    target: OverseasSettlementTarget,
    settler: Unit,
    transport: Unit,
  ): MarkerTargetCoord[] {
    const seen = new Set<string>();
    const candidates: MarkerTargetCoord[] = [];
    const targetCoord = { x: target.targetX, y: target.targetY };

    for (const landingTile of this.getLandingRegionTiles(nationId, target, settler)) {
      for (const coord of this.gridSystem.getAdjacentCoords(landingTile)) {
        const tile = this.mapData.tiles[coord.y]?.[coord.x];
        if (!tile || !isWaterTile(tile)) continue;
        const occupant = this.unitManager.getUnitAt(tile.x, tile.y);
        if (occupant && occupant.id !== transport.id) continue;
        const key = `${tile.x},${tile.y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        candidates.push({ x: tile.x, y: tile.y });
      }
    }

    return candidates.sort((a, b) => {
      const distanceDelta = this.gridSystem.getDistance(a, targetCoord) - this.gridSystem.getDistance(b, targetCoord);
      if (distanceDelta !== 0) return distanceDelta;
      return (a.y - b.y) || (a.x - b.x);
    });
  }

  private findLandingTile(
    nationId: string,
    target: OverseasSettlementTarget,
    settler: Unit,
    transport: Unit,
  ): MarkerTargetCoord | undefined {
    if (!this.unitBoardingManager) return undefined;
    const targetCoord = { x: target.targetX, y: target.targetY };

    const candidates = this.gridSystem.getAdjacentCoords({ x: transport.tileX, y: transport.tileY })
      .map((coord) => this.mapData.tiles[coord.y]?.[coord.x])
      .filter((tile): tile is Tile => tile !== undefined)
      .filter((tile) => this.isCandidateLandingTile(nationId, settler, tile))
      .filter((tile) => this.unitBoardingManager?.canUnboard(settler, tile.x, tile.y) === true);

    const withinRadius: Tile[] = [];
    for (const tile of candidates) {
      const distance = this.gridSystem.getDistance(tile, targetCoord);
      if (distance > LANDING_RADIUS_MAX) {
        this.log(nationId, `rejected landing tile (${tile.x},${tile.y}) for ${target.name}: outside target radius.`);
      } else {
        withinRadius.push(tile);
      }
    }

    return withinRadius.sort((a, b) => {
      const scoreDelta = this.getLandingTileScore(a, targetCoord) - this.getLandingTileScore(b, targetCoord);
      if (scoreDelta !== 0) return scoreDelta;
      return (a.y - b.y) || (a.x - b.x);
    })[0];
  }

  private getLandingRegionTiles(
    nationId: string,
    target: OverseasSettlementTarget,
    settler: Unit,
  ): Tile[] {
    const targetCoord = { x: target.targetX, y: target.targetY };
    for (const radius of [LANDING_RADIUS_START, LANDING_RADIUS_EXPAND, LANDING_RADIUS_MAX]) {
      const tiles = this.gridSystem.getTilesInRange(targetCoord, radius, this.mapData, { includeCenter: true })
        .filter((tile) => this.isCandidateLandingTile(nationId, settler, tile))
        .sort((a, b) => {
          const scoreDelta = this.getLandingTileScore(a, targetCoord) - this.getLandingTileScore(b, targetCoord);
          if (scoreDelta !== 0) return scoreDelta;
          return (a.y - b.y) || (a.x - b.x);
        });
      if (tiles.length > 0) return tiles;
    }
    return [];
  }

  private isCandidateLandingTile(nationId: string, settler: Unit, tile: Tile): boolean {
    if (isWaterTile(tile)) return false;
    if (tile.ownerId !== undefined && tile.ownerId !== nationId) return false;
    if (!canUnitEndMovementOnTile(settler, tile, this.nationManager.getNation(nationId))) return false;
    const occupant = this.unitManager.getUnitAt(tile.x, tile.y);
    if (occupant && occupant.id !== settler.id) return false;
    return this.hasAdjacentWaterTile(tile.x, tile.y);
  }

  private getLandingTileScore(tile: Tile, target: MarkerTargetCoord): number {
    let score = this.gridSystem.getDistance(tile, target) * 100;
    if (tile.type === TileType.Plains || tile.type === TileType.Forest || tile.type === TileType.Jungle) score -= 20;
    if (tile.resourceId !== undefined) score -= 10;
    if (this.hasAdjacentWaterTile(tile.x, tile.y)) score -= 5;
    return score;
  }

  private findStagingPlan(
    nationId: string,
    settler: Unit,
    transport: Unit | undefined,
  ): StagingPlan | undefined {
    const transportPos = transport ? { x: transport.tileX, y: transport.tileY } : undefined;
    const candidates = this.getFriendlyCoastalStagingTiles(nationId, settler.id)
      .map((coastalTile) => {
        const boardingTile = this.getBestBoardingTile(coastalTile, transport?.id, transportPos);
        const settlerDistance = this.gridSystem.getDistance(
          { x: settler.tileX, y: settler.tileY },
          { x: coastalTile.x, y: coastalTile.y },
        );
        const transportDistance = transportPos && boardingTile
          ? this.gridSystem.getDistance(transportPos, boardingTile)
          : 0;
        return { coastalTile, boardingTile, settlerDistance, transportDistance };
      })
      .filter((candidate) => !this.requiresTransportForOverseasExpansion(nationId) || candidate.boardingTile !== undefined)
      .sort((a, b) => {
        if (a.settlerDistance !== b.settlerDistance) return a.settlerDistance - b.settlerDistance;
        if (a.transportDistance !== b.transportDistance) return a.transportDistance - b.transportDistance;
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

  private getBestBoardingTile(
    coastalTile: MarkerTargetCoord,
    carrierUnitId: string | undefined,
    transportPos?: MarkerTargetCoord,
  ): MarkerTargetCoord | undefined {
    return this.gridSystem.getAdjacentCoords(coastalTile)
      .map((coord) => this.mapData.tiles[coord.y]?.[coord.x])
      .filter((tile) => {
        if (!tile) return false;
        if (tile.type !== TileType.Coast && tile.type !== TileType.Ocean) return false;
        const occupant = this.unitManager.getUnitAt(tile.x, tile.y);
        return occupant === null || occupant.id === carrierUnitId;
      })
      .sort((a, b) => {
        if (transportPos) {
          const distA = this.gridSystem.getDistance({ x: a.x, y: a.y }, transportPos);
          const distB = this.gridSystem.getDistance({ x: b.x, y: b.y }, transportPos);
          if (distA !== distB) return distA - distB;
        }
        return (a.y - b.y) || (a.x - b.x);
      })[0];
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
      this.log(unit.ownerId, `${unitLabel} at (${unit.tileX},${unit.tileY}) could not find path to overseas expedition ${targetName} ${destinationLabel} (${target.x},${target.y}).`);
      return;
    }
    const beforeX = unit.tileX;
    const beforeY = unit.tileY;
    this.movementSystem.moveAlongPath(unit, path);
    if (unit.tileX === beforeX && unit.tileY === beforeY) {
      const mp = unit.movementPoints;
      this.log(unit.ownerId, `${unitLabel} at (${beforeX},${beforeY}) could not move toward overseas expedition ${targetName} ${destinationLabel} (${target.x},${target.y})${mp <= 0 ? ' (no movement points)' : ''}.`);
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

  private findCityWithinMarkerRadius(nationId: string, marker: WorldMarker): City | undefined {
    const radius = getMarkerCheckRadius(marker);
    const markerCoord = { x: marker.x, y: marker.y };
    return this.cityManager.getCitiesByOwner(nationId).find(
      (city) => this.gridSystem.getDistance({ x: city.tileX, y: city.tileY }, markerCoord) <= radius,
    );
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

  private buildExpeditionStateSummary(nationId: string, target: OverseasSettlementTarget): string {
    const parts: string[] = [];

    if (target.assignedSettlerUnitId && this.unitManager.getUnit(target.assignedSettlerUnitId)) {
      parts.push('settler=assigned');
    } else if (this.hasQueuedUnit(nationId, SETTLER.id)) {
      parts.push('settler=in-queue');
    } else if (target.settlerRequested) {
      parts.push('settler=requested(not-in-queue)');
    } else {
      parts.push('settler=needed');
    }

    if (this.requiresTransportForOverseasExpansion(nationId)) {
      if (target.assignedTransportUnitId && this.unitManager.getUnit(target.assignedTransportUnitId)) {
        parts.push('transport=assigned');
      } else if (this.hasQueuedSettlerTransport(nationId)) {
        parts.push('transport=in-queue');
      } else if (target.transportRequested) {
        const coastalCityCount = this.cityManager.getCitiesByOwner(nationId)
          .filter((c) => cityHasWaterTile(c, this.mapData)).length;
        parts.push(`transport=requested(not-in-queue, ${coastalCityCount} coastal cities)`);
      } else {
        parts.push('transport=needed');
      }
    } else {
      parts.push('transport=not-required');
    }

    return `expedition ${target.name} [${target.status}]: ${parts.join(', ')}`;
  }

  private logExpeditionStateOnce(nationId: string, target: OverseasSettlementTarget): void {
    const summary = this.buildExpeditionStateSummary(nationId, target);
    const key = `${this.targetKey(target)}:${summary}`;
    if (this.lastExpeditionStateByNation.get(nationId) === key) return;
    this.lastExpeditionStateByNation.set(nationId, key);
    this.log(nationId, summary);
  }

  private log(nationId: string, message: string): void {
    console.log(this.formatLog(nationId, message));
    this.logStrategicEvent?.(nationId, message);
  }
}

function normalizeOverseasRegionName(name: string): string {
  return name.trim().toLowerCase();
}

function getMarkerCheckRadius(marker: WorldMarker): number {
  const metaRadius = marker.metadata?.radius;
  return typeof metaRadius === 'number' && metaRadius > 0
    ? metaRadius
    : marker.radius ?? DEFAULT_CITY_WITHIN_MARKER_RADIUS;
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
