import type { DiplomacyManager, WarDeclarationMetadata } from '../DiplomacyManager';

export interface VassalWarJoinEvent {
  readonly hostNationId: string;
  readonly vassalNationId: string;
  readonly enemyNationId: string;
  readonly cause: 'hostDeclaredWar' | 'hostWasAttacked';
}

export interface VassalDefenseRequest {
  readonly hostNationId: string;
  readonly vassalNationId: string;
  readonly attackerNationId: string;
}

export interface VassalDefenseResolution extends VassalDefenseRequest {
  readonly defended: boolean;
  readonly joinedWar: boolean;
}

export interface VassalWarSystemContext {
  readonly isHumanNation: (nationId: string) => boolean;
  readonly shouldAIDefend: (request: VassalDefenseRequest) => boolean;
  readonly requestHumanDefense?: (
    request: VassalDefenseRequest,
    resolve: (defend: boolean) => void,
  ) => void;
}

/**
 * Coordinates vassal obligations around the canonical diplomacy war transition.
 * It owns no war state: every join is validated and committed by DiplomacyManager.
 */
export class VassalWarSystem {
  private readonly pendingDefenseKeys = new Set<string>();
  private readonly joinedListeners: Array<(event: VassalWarJoinEvent) => void> = [];
  private readonly defenseListeners: Array<(event: VassalDefenseResolution) => void> = [];

  constructor(
    private readonly diplomacyManager: DiplomacyManager,
    private readonly context: VassalWarSystemContext,
  ) {
    diplomacyManager.onWarDeclared((attacker, defender, metadata) =>
      this.handleWarDeclared(attacker, defender, metadata));
  }

  onVassalJoinedWar(listener: (event: VassalWarJoinEvent) => void): void {
    this.joinedListeners.push(listener);
  }

  onDefenseResolved(listener: (event: VassalDefenseResolution) => void): void {
    this.defenseListeners.push(listener);
  }

  resolveHostDefense(request: VassalDefenseRequest, defend: boolean): boolean {
    const key = this.defenseKey(request);
    if (!this.pendingDefenseKeys.delete(key)) return false;
    if (this.diplomacyManager.getVassalHost(request.vassalNationId) !== request.hostNationId) return false;
    if (this.diplomacyManager.getState(request.vassalNationId, request.attackerNationId) !== 'WAR') return false;

    let joinedWar = false;
    if (defend) {
      joinedWar = this.diplomacyManager.getState(request.hostNationId, request.attackerNationId) === 'WAR'
        || this.diplomacyManager.joinWarToDefendVassal(
          request.hostNationId,
          request.vassalNationId,
          request.attackerNationId,
        );
    } else {
      this.diplomacyManager.terminateVassalage(request.hostNationId, request.vassalNationId);
    }

    const resolution: VassalDefenseResolution = { ...request, defended: defend, joinedWar };
    for (const listener of this.defenseListeners) listener(resolution);
    return defend ? joinedWar : true;
  }

  private handleWarDeclared(
    attackerNationId: string,
    defenderNationId: string,
    _metadata: WarDeclarationMetadata,
  ): void {
    // A host controls offensive policy: all direct vassals follow its declaration.
    this.joinDirectVassals(attackerNationId, defenderNationId, 'hostDeclaredWar');
    // An attack on the host automatically activates all direct vassals defensively.
    this.joinDirectVassals(defenderNationId, attackerNationId, 'hostWasAttacked');

    // An attack on a vassal is asymmetric: its host decides whether to defend.
    const hostNationId = this.diplomacyManager.getVassalHost(defenderNationId);
    if (!hostNationId || hostNationId === attackerNationId) return;
    if (this.diplomacyManager.getState(hostNationId, attackerNationId) === 'WAR') return;
    const request: VassalDefenseRequest = {
      hostNationId,
      vassalNationId: defenderNationId,
      attackerNationId,
    };
    const key = this.defenseKey(request);
    if (this.pendingDefenseKeys.has(key)) return;
    this.pendingDefenseKeys.add(key);

    if (this.context.isHumanNation(hostNationId)) {
      this.context.requestHumanDefense?.(request, (defend) => this.resolveHostDefense(request, defend));
      return;
    }
    this.resolveHostDefense(request, this.context.shouldAIDefend(request));
  }

  private joinDirectVassals(
    hostNationId: string,
    enemyNationId: string,
    cause: VassalWarJoinEvent['cause'],
  ): void {
    for (const vassalNationId of this.diplomacyManager.getVassals(hostNationId)) {
      if (vassalNationId === enemyNationId) continue;
      if (this.diplomacyManager.getState(vassalNationId, enemyNationId) === 'WAR') continue;
      if (!this.diplomacyManager.joinWarForHost(vassalNationId, hostNationId, enemyNationId)) continue;
      const event = { hostNationId, vassalNationId, enemyNationId, cause };
      for (const listener of this.joinedListeners) listener(event);
    }
  }

  private defenseKey(request: VassalDefenseRequest): string {
    return `${request.hostNationId}|${request.vassalNationId}|${request.attackerNationId}`;
  }
}
