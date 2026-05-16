import type { Unit } from '../entities/Unit';
import { getLeaderPersonalityByNationId } from '../data/leaders';
import { TileType, type MapData } from '../types/map';
import type { CityManager } from './CityManager';
import type { DiplomacyManager } from './DiplomacyManager';
import type { NationManager } from './NationManager';
import type { TurnManager } from './TurnManager';
import type { UnitManager } from './UnitManager';

export const EXILE_PROTECTION_DEFAULT_TURNS = 20;

export type ExileProtectionResponse = 'deny' | 'accept_free' | 'accept_gold' | 'accept_resource';

export interface ExileProtectionTribute {
  type: 'gold' | 'resource';
  resourceId?: string;
  amountPerTurn?: number;
  goldPerTurn?: number;
}

export interface ExileProtectionAgreement {
  protectedNationId: string;
  protectorNationId: string;
  enemyNationId: string;
  leaderUnitId: string;
  turnsRemaining: number;
  tribute?: ExileProtectionTribute;
}

export interface ExileProtectionRequest {
  protectedNationId: string;
  protectorNationId: string;
  enemyNationId: string;
  leaderUnitId: string;
}

export interface ExileProtectionChoiceRequest extends ExileProtectionRequest {
  acceptFree: () => void;
  acceptGold: () => void;
  acceptResource: () => void;
  deny: () => void;
}

export interface ExileProtectionEvent {
  agreement?: ExileProtectionAgreement;
  request: ExileProtectionRequest;
  response: ExileProtectionResponse;
  message: string;
}

type ChoiceListener = (request: ExileProtectionChoiceRequest) => void;
type EventListener = (event: ExileProtectionEvent) => void;

const REQUEST_COOLDOWN_TURNS = 8;
const GOLD_TRIBUTE_PER_TURN = 5;

export class ExileProtectionSystem {
  private readonly agreements: ExileProtectionAgreement[] = [];
  private readonly requestCooldowns = new Map<string, number>();
  private readonly choiceListeners: ChoiceListener[] = [];
  private readonly grantedListeners: EventListener[] = [];
  private readonly deniedListeners: EventListener[] = [];
  private readonly expiredListeners: EventListener[] = [];

  constructor(
    private readonly cityManager: CityManager,
    private readonly unitManager: UnitManager,
    private readonly nationManager: NationManager,
    private readonly diplomacyManager: DiplomacyManager,
    private readonly mapData: MapData,
    private readonly turnManager: TurnManager,
    private readonly hasMet: (a: string, b: string) => boolean,
    private readonly getAvailableResourceIds: (nationId: string) => readonly string[] = () => [],
  ) {
    this.turnManager.on('turnStart', (event) => {
      this.advanceAgreements(event.nation.id);
      this.maybeRequestProtection(event.nation.id);
    });
  }

  onChoiceRequested(listener: ChoiceListener): void {
    this.choiceListeners.push(listener);
  }

  onGranted(listener: EventListener): void {
    this.grantedListeners.push(listener);
  }

  onDenied(listener: EventListener): void {
    this.deniedListeners.push(listener);
  }

  onExpired(listener: EventListener): void {
    this.expiredListeners.push(listener);
  }

  canLeaderEnterTerritory(leader: Unit, territoryOwnerId: string): boolean {
    return this.getAgreementForLeaderInProtectorTerritory(leader, territoryOwnerId) !== undefined;
  }

  getProtectorForProtectedLeaderTarget(attackerNationId: string, target: Unit): string | null {
    if (target.unitType.id !== 'leader') return null;
    const tile = this.mapData.tiles[target.tileY]?.[target.tileX];
    const protectorNationId = tile?.ownerId;
    if (!protectorNationId || protectorNationId === target.ownerId || protectorNationId === attackerNationId) return null;
    const agreement = this.getAgreementForLeaderInProtectorTerritory(target, protectorNationId);
    if (!agreement || agreement.enemyNationId !== attackerNationId) return null;
    if (this.diplomacyManager.getState(attackerNationId, protectorNationId) === 'WAR') return null;
    return protectorNationId;
  }

  getAllAgreements(): ExileProtectionAgreement[] {
    return this.agreements.map((agreement) => ({
      ...agreement,
      tribute: agreement.tribute ? { ...agreement.tribute } : undefined,
    }));
  }

  restoreAgreements(agreements: readonly ExileProtectionAgreement[] | undefined): void {
    this.agreements.length = 0;
    for (const agreement of agreements ?? []) {
      if (!this.nationManager.getNation(agreement.protectedNationId)) continue;
      if (!this.nationManager.getNation(agreement.protectorNationId)) continue;
      if (!this.unitManager.getUnit(agreement.leaderUnitId)) continue;
      if (agreement.turnsRemaining <= 0) continue;
      this.agreements.push({
        ...agreement,
        tribute: agreement.tribute ? { ...agreement.tribute } : undefined,
      });
    }
  }

  cancelAgreementsForNation(nationId: string): number {
    let cancelled = 0;
    for (let i = this.agreements.length - 1; i >= 0; i--) {
      const agreement = this.agreements[i];
      if (
        agreement.protectedNationId !== nationId &&
        agreement.protectorNationId !== nationId &&
        agreement.enemyNationId !== nationId
      ) continue;
      this.agreements.splice(i, 1);
      cancelled++;
    }
    return cancelled;
  }

  respondToRequest(request: ExileProtectionRequest, response: ExileProtectionResponse): void {
    this.setCooldown(request);
    if (response === 'deny') {
      this.emit(this.deniedListeners, {
        request,
        response,
        message: this.formatDeniedMessage(request),
      });
      return;
    }

    const agreement: ExileProtectionAgreement = {
      ...request,
      turnsRemaining: EXILE_PROTECTION_DEFAULT_TURNS,
      tribute: this.createTribute(request, response),
    };
    this.upsertAgreement(agreement);
    this.applyDiplomacyEffects(agreement);
    this.emit(this.grantedListeners, {
      request,
      response,
      agreement: { ...agreement, tribute: agreement.tribute ? { ...agreement.tribute } : undefined },
      message: this.formatGrantedMessage(agreement),
    });
  }

  private maybeRequestProtection(protectedNationId: string): void {
    const protectedNation = this.nationManager.getNation(protectedNationId);
    if (!protectedNation || protectedNation.isHuman) return;
    const leader = this.unitManager.getUnitsByOwner(protectedNationId)
      .find((unit) => unit.unitType.id === 'leader');
    if (!leader) return;
    const enemyNationId = this.getPrimaryEnemy(protectedNationId);
    if (!enemyNationId) return;
    if (!this.isResidenceUnsafe(protectedNationId, enemyNationId)) return;
    if (this.hasSafeOwnedCity(protectedNationId, enemyNationId)) return;

    const protectorNationId = this.pickProtector(protectedNationId, enemyNationId, leader);
    if (!protectorNationId) return;
    const request: ExileProtectionRequest = {
      protectedNationId,
      protectorNationId,
      enemyNationId,
      leaderUnitId: leader.id,
    };
    if (this.isOnCooldown(request)) return;
    if (this.nationManager.getNation(protectorNationId)?.isHuman) {
      for (const listener of this.choiceListeners) {
        listener({
          ...request,
          acceptFree: () => this.respondToRequest(request, 'accept_free'),
          acceptGold: () => this.respondToRequest(request, 'accept_gold'),
          acceptResource: () => this.respondToRequest(request, 'accept_resource'),
          deny: () => this.respondToRequest(request, 'deny'),
        });
      }
      return;
    }

    this.respondToRequest(request, this.chooseAIProtectorResponse(request));
  }

  private advanceAgreements(nationId: string): void {
    for (let i = this.agreements.length - 1; i >= 0; i--) {
      const agreement = this.agreements[i];
      if (agreement.protectorNationId !== nationId) continue;
      this.applyTribute(agreement);
      agreement.turnsRemaining -= 1;
      if (agreement.turnsRemaining > 0) continue;
      this.agreements.splice(i, 1);
      this.emit(this.expiredListeners, {
        request: agreement,
        response: 'deny',
        agreement,
        message: `${this.getNationName(agreement.protectorNationId)}'s protection of ${this.getNationName(agreement.protectedNationId)}'s leader expired.`,
      });
    }
  }

  private chooseAIProtectorResponse(request: ExileProtectionRequest): ExileProtectionResponse {
    const protector = this.nationManager.getNation(request.protectorNationId);
    const protectedRelation = this.diplomacyManager.getRelation(request.protectorNationId, request.protectedNationId);
    const enemyRelation = this.diplomacyManager.getRelation(request.protectorNationId, request.enemyNationId);
    const personality = getLeaderPersonalityByNationId(request.protectorNationId);
    const atWarCount = this.nationManager.getAllNations()
      .filter((nation) => nation.id !== request.protectorNationId)
      .filter((nation) => this.diplomacyManager.getState(request.protectorNationId, nation.id) === 'WAR')
      .length;
    const protectedGold = this.nationManager.getResources(request.protectedNationId).gold;
    const resourceIds = this.getAvailableResourceIds(request.protectedNationId);

    let score = 0;
    score += (protectedRelation.trust - 50) / 8;
    score += protectedRelation.affinity / 15;
    score += enemyRelation.hostility / 12;
    score += personality.diplomacyBias * 2;
    score += personality.peacePreference >= 60 ? 1 : 0;
    score += this.diplomacyManager.getState(request.protectorNationId, request.enemyNationId) === 'WAR' ? 3 : 0;
    score -= enemyRelation.fear / 12;
    score -= atWarCount * 2;
    score -= Math.max(0, -personality.diplomacyBias) * 2;
    if (!protector) score -= 100;

    if (score >= 7) return 'accept_free';
    if (score >= 3 && protectedGold >= GOLD_TRIBUTE_PER_TURN) return 'accept_gold';
    if (score >= 3 && resourceIds.length > 0) return 'accept_resource';
    if (score >= 5) return 'accept_free';
    return 'deny';
  }

  private pickProtector(protectedNationId: string, enemyNationId: string, leader: Unit): string | undefined {
    const candidates = this.nationManager.getAllNations()
      .filter((nation) => nation.id !== protectedNationId && nation.id !== enemyNationId)
      .filter((nation) => this.hasMet(protectedNationId, nation.id))
      .map((nation) => ({
        nation,
        score: this.scoreProtector(protectedNationId, enemyNationId, nation.id, leader),
      }))
      .filter((candidate) => candidate.score > -10)
      .sort((a, b) => b.score - a.score || a.nation.id.localeCompare(b.nation.id));
    return candidates[0]?.nation.id;
  }

  private scoreProtector(protectedNationId: string, enemyNationId: string, protectorNationId: string, leader: Unit): number {
    const relation = this.diplomacyManager.getRelation(protectedNationId, protectorNationId);
    const enemyRelation = this.diplomacyManager.getRelation(protectorNationId, enemyNationId);
    const nearestCityDistance = this.cityManager.getCitiesByOwner(protectorNationId)
      .reduce((best, city) => Math.min(best, Math.abs(city.tileX - leader.tileX) + Math.abs(city.tileY - leader.tileY)), Infinity);
    return relation.trust / 10
      + relation.affinity / 20
      + enemyRelation.hostility / 15
      - enemyRelation.fear / 15
      - Math.min(nearestCityDistance, 30) / 8;
  }

  private getPrimaryEnemy(nationId: string): string | undefined {
    return this.nationManager.getAllNations()
      .filter((nation) => nation.id !== nationId)
      .filter((nation) => this.diplomacyManager.getState(nationId, nation.id) === 'WAR')
      .sort((a, b) => a.id.localeCompare(b.id))[0]?.id;
  }

  private isResidenceUnsafe(nationId: string, enemyNationId: string): boolean {
    const residence = this.cityManager.getResidenceCapital(nationId);
    if (!residence || residence.ownerId !== nationId || residence.health <= 35) return true;
    return this.unitManager.getUnitsByOwner(enemyNationId).some((unit) => (
      unit.unitType.baseStrength > 0 &&
      Math.abs(unit.tileX - residence.tileX) + Math.abs(unit.tileY - residence.tileY) <= 5
    ));
  }

  private hasSafeOwnedCity(nationId: string, enemyNationId: string): boolean {
    return this.cityManager.getCitiesByOwner(nationId).some((city) => (
      city.isResidenceCapital !== true &&
      city.health > 50 &&
      !this.unitManager.getUnitsByOwner(enemyNationId).some((unit) => (
        unit.unitType.baseStrength > 0 &&
        Math.abs(unit.tileX - city.tileX) + Math.abs(unit.tileY - city.tileY) <= 4
      ))
    ));
  }

  private getAgreementForLeaderInProtectorTerritory(leader: Unit, protectorNationId: string): ExileProtectionAgreement | undefined {
    return this.agreements.find((agreement) => (
      agreement.leaderUnitId === leader.id &&
      agreement.protectedNationId === leader.ownerId &&
      agreement.protectorNationId === protectorNationId &&
      agreement.turnsRemaining > 0
    ));
  }

  private createTribute(request: ExileProtectionRequest, response: ExileProtectionResponse): ExileProtectionTribute | undefined {
    if (response === 'accept_gold') {
      return { type: 'gold', goldPerTurn: GOLD_TRIBUTE_PER_TURN };
    }
    if (response === 'accept_resource') {
      const resourceId = this.getAvailableResourceIds(request.protectedNationId)[0];
      return resourceId ? { type: 'resource', resourceId, amountPerTurn: 1 } : undefined;
    }
    return undefined;
  }

  private applyTribute(agreement: ExileProtectionAgreement): void {
    if (agreement.tribute?.type !== 'gold') return;
    const amount = Math.min(
      agreement.tribute.goldPerTurn ?? 0,
      this.nationManager.getResources(agreement.protectedNationId).gold,
    );
    if (amount <= 0) return;
    this.nationManager.getResources(agreement.protectedNationId).gold -= amount;
    this.nationManager.getResources(agreement.protectorNationId).gold += amount;
  }

  private applyDiplomacyEffects(agreement: ExileProtectionAgreement): void {
    this.adjustMemory(agreement.protectedNationId, agreement.protectorNationId, {
      trust: 12,
      affinity: 8,
    });
    this.adjustMemory(agreement.enemyNationId, agreement.protectorNationId, {
      trust: -25,
      hostility: 35,
    });
    this.adjustMemory(agreement.enemyNationId, agreement.protectedNationId, {
      hostility: 10,
    });
  }

  private adjustMemory(a: string, b: string, delta: { trust?: number; affinity?: number; hostility?: number; fear?: number }): void {
    const relation = this.diplomacyManager.getRelation(a, b);
    this.diplomacyManager.setMemoryValues(a, b, {
      trust: clampMemory(relation.trust + (delta.trust ?? 0)),
      affinity: clampMemory(relation.affinity + (delta.affinity ?? 0)),
      hostility: clampMemory(relation.hostility + (delta.hostility ?? 0)),
      fear: clampMemory(relation.fear + (delta.fear ?? 0)),
    });
  }

  private upsertAgreement(agreement: ExileProtectionAgreement): void {
    const existingIndex = this.agreements.findIndex((candidate) => (
      candidate.protectedNationId === agreement.protectedNationId &&
      candidate.protectorNationId === agreement.protectorNationId &&
      candidate.enemyNationId === agreement.enemyNationId &&
      candidate.leaderUnitId === agreement.leaderUnitId
    ));
    if (existingIndex >= 0) this.agreements.splice(existingIndex, 1, agreement);
    else this.agreements.push(agreement);
  }

  private isOnCooldown(request: ExileProtectionRequest): boolean {
    const key = this.cooldownKey(request);
    const lastTurn = this.requestCooldowns.get(key);
    return lastTurn !== undefined && this.turnManager.getCurrentRound() - lastTurn < REQUEST_COOLDOWN_TURNS;
  }

  private setCooldown(request: ExileProtectionRequest): void {
    this.requestCooldowns.set(this.cooldownKey(request), this.turnManager.getCurrentRound());
  }

  private cooldownKey(request: ExileProtectionRequest): string {
    return `${request.protectedNationId}|${request.protectorNationId}|${request.enemyNationId}`;
  }

  private formatGrantedMessage(agreement: ExileProtectionAgreement): string {
    const tribute = agreement.tribute?.type === 'gold'
      ? ` for ${agreement.tribute.goldPerTurn ?? 0} gold per turn`
      : agreement.tribute?.type === 'resource'
        ? ` for ${agreement.tribute.resourceId ?? 'resource'} tribute`
        : '';
    return `${this.getNationName(agreement.protectorNationId)} granted protection to ${this.getNationName(agreement.protectedNationId)}'s fleeing leader${tribute}. ${this.getNationName(agreement.enemyNationId)} now sees ${this.getNationName(agreement.protectorNationId)} as sheltering an enemy government.`;
  }

  private formatDeniedMessage(request: ExileProtectionRequest): string {
    return `${this.getNationName(request.protectorNationId)} denied protection to ${this.getNationName(request.protectedNationId)}'s fleeing leader.`;
  }

  private getNationName(nationId: string): string {
    return this.nationManager.getNation(nationId)?.name ?? nationId;
  }

  private emit(listeners: EventListener[], event: ExileProtectionEvent): void {
    for (const listener of listeners) listener(event);
  }
}

function clampMemory(value: number): number {
  return Math.max(0, Math.min(100, value));
}
