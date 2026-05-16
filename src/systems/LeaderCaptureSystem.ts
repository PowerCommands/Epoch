import type { City } from '../entities/City';
import type { Unit } from '../entities/Unit';
import { getLeaderPersonalityByNationId } from '../data/leaders';
import { getAIStrategyById } from '../data/aiStrategies';
import { TileType, type MapData, type Tile } from '../types/map';
import type { CityManager } from './CityManager';
import type { DiplomacyManager } from './DiplomacyManager';
import type { IGridSystem } from './grid/IGridSystem';
import type { NationManager } from './NationManager';
import type { NationCollapseSystem } from './NationCollapseSystem';
import type { UnitManager } from './UnitManager';
import { canUnitEndMovementOnTile } from './UnitMovementRules';

export type LeaderCaptureOutcome = 'execute' | 'ransom';
export type LeaderCaptureCause = 'unit_defeated' | 'city_captured';

export interface LeaderCaptureContext {
  attacker: Unit;
  leader: Unit;
  defeatedNationId: string;
  cause: LeaderCaptureCause;
  city?: City;
}

export interface LeaderCaptureChoiceRequest extends LeaderCaptureContext {
  execute: () => void;
  ransom: () => void;
}

export interface LeaderCaptureResolvedEvent extends LeaderCaptureContext {
  outcome: LeaderCaptureOutcome;
  ransomGold: number;
  collapsed: boolean;
  message: string;
}

type ChoiceListener = (request: LeaderCaptureChoiceRequest) => void;
type ResolvedListener = (event: LeaderCaptureResolvedEvent) => void;

export class LeaderCaptureSystem {
  private readonly choiceListeners: ChoiceListener[] = [];
  private readonly resolvedListeners: ResolvedListener[] = [];
  private readonly pendingLeaderIds = new Set<string>();

  constructor(
    private readonly cityManager: CityManager,
    private readonly unitManager: UnitManager,
    private readonly nationManager: NationManager,
    private readonly mapData: MapData,
    private readonly gridSystem: IGridSystem,
    private readonly diplomacyManager: DiplomacyManager,
    private readonly nationCollapseSystem: NationCollapseSystem,
    private readonly isHumanNation: (nationId: string) => boolean,
  ) {}

  onChoiceRequested(listener: ChoiceListener): void {
    this.choiceListeners.push(listener);
  }

  onResolved(listener: ResolvedListener): void {
    this.resolvedListeners.push(listener);
  }

  handleUnitDefeated(attacker: Unit, defeated: Unit): boolean {
    if (!this.isLeader(defeated)) return false;
    return this.beginCapture({
      attacker,
      leader: defeated,
      defeatedNationId: defeated.ownerId,
      cause: 'unit_defeated',
    });
  }

  handleCityCaptured(city: City, previousOwnerId: string, attacker: Unit): boolean {
    const leader = this.unitManager.getUnitsByOwner(previousOwnerId).find((unit) => (
      this.isLeader(unit) && unit.tileX === city.tileX && unit.tileY === city.tileY
    ));
    if (!leader) return false;
    return this.beginCapture({
      attacker,
      leader,
      defeatedNationId: previousOwnerId,
      cause: 'city_captured',
      city,
    });
  }

  private beginCapture(context: LeaderCaptureContext): boolean {
    if (this.pendingLeaderIds.has(context.leader.id)) return true;
    this.pendingLeaderIds.add(context.leader.id);

    if (this.isHumanNation(context.attacker.ownerId)) {
      const request: LeaderCaptureChoiceRequest = {
        ...context,
        execute: () => this.resolve(context, 'execute'),
        ransom: () => this.resolve(context, 'ransom'),
      };
      for (const listener of this.choiceListeners) listener(request);
      return true;
    }

    this.resolve(context, this.chooseAIOutcome(context));
    return true;
  }

  private resolve(context: LeaderCaptureContext, outcome: LeaderCaptureOutcome): void {
    if (!this.pendingLeaderIds.has(context.leader.id)) return;
    this.pendingLeaderIds.delete(context.leader.id);

    if (outcome === 'ransom') {
      const destination = this.findEscapeDestination(context.leader, context.attacker.ownerId);
      if (destination) {
        const ransomGold = this.transferRansomGold(context.attacker.ownerId, context.defeatedNationId);
        context.leader.health = Math.max(1, context.leader.unitType.baseHealth);
        this.unitManager.moveUnit(context.leader.id, destination.x, destination.y, 0);
        this.emitResolved(context, {
          outcome: 'ransom',
          ransomGold,
          collapsed: false,
          message: this.formatRansomMessage(context, ransomGold),
        });
        return;
      }
    }

    const message = this.formatExecutionMessage(context);
    this.nationCollapseSystem.collapse({
      nationId: context.defeatedNationId,
      conquerorNationId: context.attacker.ownerId,
      triggerCity: context.city,
      reason: 'leader_executed',
    });
    this.emitResolved(context, {
      outcome: 'execute',
      ransomGold: 0,
      collapsed: true,
      message,
    });
  }

  private chooseAIOutcome(context: LeaderCaptureContext): LeaderCaptureOutcome {
    const attacker = this.nationManager.getNation(context.attacker.ownerId);
    const defeatedGold = this.nationManager.getResources(context.defeatedNationId)?.gold ?? 0;
    const relation = this.diplomacyManager.getRelation(context.attacker.ownerId, context.defeatedNationId);
    const personality = getLeaderPersonalityByNationId(context.attacker.ownerId);
    const strategy = getAIStrategyById(attacker?.aiStrategyId);
    const defeatedCityCount = this.cityManager.getCitiesByOwner(context.defeatedNationId).length;
    const activeWars = this.nationManager.getAllNations()
      .filter((nation) => nation.id !== context.attacker.ownerId)
      .filter((nation) => this.diplomacyManager.getState(context.attacker.ownerId, nation.id) === 'WAR')
      .length;

    let executeScore = 0;
    executeScore += Math.max(0, personality.aggressionBias) * 2;
    executeScore += Math.max(0, personality.warTolerance - 50) / 10;
    executeScore += relation.hostility / 18;
    executeScore += strategy.military.aggression * 2;
    executeScore += defeatedCityCount >= 3 ? 2 : defeatedCityCount >= 2 ? 1 : 0;
    if (strategy.id === 'aggressive') executeScore += 2;
    if (context.cause === 'city_captured') executeScore += 0.5;

    let ransomScore = 0;
    ransomScore += Math.max(0, personality.economyBias) * 2;
    ransomScore += Math.max(0, personality.diplomacyBias) * 1.5;
    ransomScore += Math.max(0, personality.peacePreference - 50) / 10;
    ransomScore += defeatedGold >= 200 ? 3 : defeatedGold >= 80 ? 1.5 : defeatedGold > 0 ? 0.5 : 0;
    ransomScore += strategy.production.goldBuildingWeight;
    ransomScore += activeWars >= 2 ? 2 : 0;
    ransomScore += Math.max(0, 35 - relation.hostility) / 18;

    return executeScore >= ransomScore ? 'execute' : 'ransom';
  }

  private transferRansomGold(attackerNationId: string, defeatedNationId: string): number {
    const defeated = this.nationManager.getResources(defeatedNationId);
    const attacker = this.nationManager.getResources(attackerNationId);
    const amount = Math.max(0, Math.floor(defeated.gold * 0.5));
    defeated.gold = Math.max(0, defeated.gold - amount);
    attacker.gold += amount;
    return amount;
  }

  private findEscapeDestination(leader: Unit, attackerNationId: string): Tile | undefined {
    const leaderCoord = { x: leader.tileX, y: leader.tileY };
    const ownedCities = this.cityManager.getCitiesByOwner(leader.ownerId)
      .map((city) => this.mapData.tiles[city.tileY]?.[city.tileX])
      .filter((tile): tile is Tile => tile !== undefined)
      .filter((tile) => this.isValidEscapeTile(leader, tile, attackerNationId));
    const cityTile = this.nearestTile(leaderCoord, ownedCities);
    if (cityTile) return cityTile;

    const ownedLandTiles = this.allTiles()
      .filter((tile) => tile.ownerId === leader.ownerId)
      .filter((tile) => this.isValidEscapeTile(leader, tile, attackerNationId));
    const ownedLandTile = this.nearestTile(leaderCoord, ownedLandTiles);
    if (ownedLandTile) return ownedLandTile;

    const neutralLandTiles = this.allTiles()
      .filter((tile) => tile.ownerId === undefined)
      .filter((tile) => this.isValidEscapeTile(leader, tile, attackerNationId));
    return this.nearestTile(leaderCoord, neutralLandTiles);
  }

  private isValidEscapeTile(leader: Unit, tile: Tile, attackerNationId: string): boolean {
    if (tile.type === TileType.Coast || tile.type === TileType.Ocean) return false;
    if (!canUnitEndMovementOnTile(leader, tile, this.nationManager.getNation(leader.ownerId))) return false;
    const units = this.unitManager.getUnitsAt(tile.x, tile.y);
    if (units.some((unit) => unit.ownerId === attackerNationId || this.diplomacyManager.getState(leader.ownerId, unit.ownerId) === 'WAR')) {
      return false;
    }
    return true;
  }

  private nearestTile(origin: { x: number; y: number }, tiles: Tile[]): Tile | undefined {
    return tiles.sort((a, b) => (
      this.gridSystem.getDistance(origin, a) - this.gridSystem.getDistance(origin, b)
      || a.y - b.y
      || a.x - b.x
    ))[0];
  }

  private allTiles(): Tile[] {
    return this.mapData.tiles.flat();
  }

  private isLeader(unit: Unit): boolean {
    return unit.unitType.id === 'leader';
  }

  private emitResolved(
    context: LeaderCaptureContext,
    result: Pick<LeaderCaptureResolvedEvent, 'outcome' | 'ransomGold' | 'collapsed' | 'message'>,
  ): void {
    for (const listener of this.resolvedListeners) {
      listener({ ...context, ...result });
    }
  }

  private formatExecutionMessage(context: LeaderCaptureContext): string {
    const attackerName = this.nationManager.getNation(context.attacker.ownerId)?.name ?? context.attacker.ownerId;
    const defeatedName = this.nationManager.getNation(context.defeatedNationId)?.name ?? context.defeatedNationId;
    return `${attackerName} executed ${defeatedName}'s leader. ${defeatedName} collapsed.`;
  }

  private formatRansomMessage(context: LeaderCaptureContext, ransomGold: number): string {
    const attackerName = this.nationManager.getNation(context.attacker.ownerId)?.name ?? context.attacker.ownerId;
    const defeatedName = this.nationManager.getNation(context.defeatedNationId)?.name ?? context.defeatedNationId;
    return `${attackerName} ransomed ${defeatedName}'s leader for ${ransomGold} gold. ${defeatedName}'s leader escaped.`;
  }
}
