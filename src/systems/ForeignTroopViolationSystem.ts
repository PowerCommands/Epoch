import type { Unit } from '../entities/Unit';
import type { MapData } from '../types/map';
import type { SavedForeignTroopViolationWarning } from '../types/saveGame';
import type { DiplomacyManager, DiplomaticMemoryValues } from './DiplomacyManager';
import type { NationManager } from './NationManager';
import type { UnitManager } from './UnitManager';

export interface ForeignTroopViolationWarning {
  readonly offendedNationId: string;
  readonly violatingNationId: string;
  readonly firstWarningRound: number;
  readonly lastSeenRound: number;
  readonly unitCount: number;
}

export interface ForeignTroopViolationWarningEvent {
  readonly warning: ForeignTroopViolationWarning;
  readonly offendedNationName: string;
  readonly violatingNationName: string;
}

export interface ForeignTroopViolationEscalationEvent extends ForeignTroopViolationWarningEvent {
  readonly delta: {
    readonly trust: number;
    readonly hostility: number;
  };
}

export interface ForeignTroopViolationClearedEvent {
  readonly warning: ForeignTroopViolationWarning;
  readonly offendedNationName: string;
  readonly violatingNationName: string;
}

type WarningListener = (event: ForeignTroopViolationWarningEvent) => void;
type EscalationListener = (event: ForeignTroopViolationEscalationEvent) => void;
type ClearedListener = (event: ForeignTroopViolationClearedEvent) => void;

const MIN_VALUE = 0;
const MAX_VALUE = 100;
const BASE_TRUST_PENALTY = 10;
const BASE_HOSTILITY_PENALTY = 10;
const EXTRA_UNIT_PENALTY = 2;
const MAX_TOTAL_PENALTY = 20;
const DEFIANT_HOSTILITY_PENALTY = 3;

export class ForeignTroopViolationSystem {
  private readonly warnings = new Map<string, ForeignTroopViolationWarning>();
  private readonly warningListeners: WarningListener[] = [];
  private readonly escalationListeners: EscalationListener[] = [];
  private readonly clearedListeners: ClearedListener[] = [];

  constructor(
    private readonly diplomacyManager: DiplomacyManager,
    private readonly nationManager: NationManager,
    private readonly unitManager: UnitManager,
    private readonly mapData: MapData,
  ) {}

  onWarning(listener: WarningListener): void {
    this.warningListeners.push(listener);
  }

  onEscalation(listener: EscalationListener): void {
    this.escalationListeners.push(listener);
  }

  onCleared(listener: ClearedListener): void {
    this.clearedListeners.push(listener);
  }

  handleRoundEnd(round: number): void {
    const violations = this.scanViolations();
    for (const [key, existing] of Array.from(this.warnings.entries())) {
      if (violations.has(key)) continue;
      this.warnings.delete(key);
      if (this.diplomacyManager.getState(existing.offendedNationId, existing.violatingNationId) === 'WAR') {
        continue;
      }
      this.emitCleared(existing);
    }

    for (const [key, violation] of violations.entries()) {
      const existing = this.warnings.get(key);
      if (!existing) {
        const warning: ForeignTroopViolationWarning = {
          offendedNationId: violation.offendedNationId,
          violatingNationId: violation.violatingNationId,
          firstWarningRound: round,
          lastSeenRound: round,
          unitCount: violation.unitCount,
        };
        this.warnings.set(key, warning);
        this.emitWarning(warning);
        continue;
      }

      const warning: ForeignTroopViolationWarning = {
        ...existing,
        lastSeenRound: round,
        unitCount: violation.unitCount,
      };
      this.warnings.set(key, warning);

      if (round > existing.firstWarningRound) {
        const delta = this.applyContinuedViolationPenalty(warning);
        if (delta.trust !== 0 || delta.hostility !== 0) {
          this.emitEscalation(warning, delta);
        }
      }
    }
  }

  recordHumanResponse(
    offendedNationId: string,
    violatingNationId: string,
    response: 'passingThrough' | 'defiant',
  ): void {
    if (response !== 'defiant') return;
    const relation = this.diplomacyManager.getRelation(offendedNationId, violatingNationId);
    this.diplomacyManager.setMemoryValues(offendedNationId, violatingNationId, {
      trust: relation.trust,
      fear: relation.fear,
      hostility: clamp(relation.hostility + DEFIANT_HOSTILITY_PENALTY),
      affinity: relation.affinity,
    });
  }

  getWarningsForSave(): SavedForeignTroopViolationWarning[] {
    return Array.from(this.warnings.values()).map((warning) => ({ ...warning }));
  }

  restoreWarnings(warnings: readonly SavedForeignTroopViolationWarning[] | undefined): void {
    this.warnings.clear();
    for (const warning of warnings ?? []) {
      if (!warning.offendedNationId || !warning.violatingNationId) continue;
      this.warnings.set(this.warningKey(warning.offendedNationId, warning.violatingNationId), {
        offendedNationId: warning.offendedNationId,
        violatingNationId: warning.violatingNationId,
        firstWarningRound: warning.firstWarningRound,
        lastSeenRound: warning.lastSeenRound,
        unitCount: warning.unitCount,
      });
    }
  }

  private scanViolations(): Map<string, {
    offendedNationId: string;
    violatingNationId: string;
    unitCount: number;
  }> {
    const violations = new Map<string, {
      offendedNationId: string;
      violatingNationId: string;
      unitCount: number;
    }>();

    for (const unit of this.unitManager.getAllUnits()) {
      if (!this.isForeignTroopViolationUnit(unit)) continue;
      const tile = this.mapData.tiles[unit.tileY]?.[unit.tileX];
      const offendedNationId = tile?.ownerId;
      if (!offendedNationId || offendedNationId === unit.ownerId) continue;
      if (!this.nationManager.getNation(offendedNationId)) continue;
      if (!this.nationManager.getNation(unit.ownerId)) continue;
      if (this.diplomacyManager.getState(offendedNationId, unit.ownerId) === 'WAR') continue;

      const key = this.warningKey(offendedNationId, unit.ownerId);
      const existing = violations.get(key);
      violations.set(key, {
        offendedNationId,
        violatingNationId: unit.ownerId,
        unitCount: (existing?.unitCount ?? 0) + 1,
      });
    }

    return violations;
  }

  private isForeignTroopViolationUnit(unit: Unit): boolean {
    if (unit.transportId !== undefined) return false;
    if (unit.unitType.baseStrength <= 0) return false;
    if (unit.unitType.category === 'recon' || unit.unitType.category === 'naval_recon') return false;
    if (unit.unitType.category === 'civilian' || unit.unitType.category === 'leader') return false;
    return true;
  }

  private applyContinuedViolationPenalty(
    warning: ForeignTroopViolationWarning,
  ): { trust: number; hostility: number } {
    const penalty = Math.min(
      MAX_TOTAL_PENALTY,
      BASE_HOSTILITY_PENALTY + Math.max(0, warning.unitCount - 1) * EXTRA_UNIT_PENALTY,
    );
    const relation = this.diplomacyManager.getRelation(warning.offendedNationId, warning.violatingNationId);
    const next: DiplomaticMemoryValues = {
      trust: clamp(relation.trust - penalty),
      fear: relation.fear,
      hostility: clamp(relation.hostility + penalty),
      affinity: relation.affinity,
    };
    this.diplomacyManager.setMemoryValues(warning.offendedNationId, warning.violatingNationId, next);
    return {
      trust: next.trust - relation.trust,
      hostility: next.hostility - relation.hostility,
    };
  }

  private emitWarning(warning: ForeignTroopViolationWarning): void {
    const event = this.buildWarningEvent(warning);
    for (const listener of this.warningListeners) listener(event);
  }

  private emitEscalation(
    warning: ForeignTroopViolationWarning,
    delta: { trust: number; hostility: number },
  ): void {
    const event = { ...this.buildWarningEvent(warning), delta };
    for (const listener of this.escalationListeners) listener(event);
  }

  private emitCleared(warning: ForeignTroopViolationWarning): void {
    const event = this.buildWarningEvent(warning);
    for (const listener of this.clearedListeners) listener(event);
  }

  private buildWarningEvent(warning: ForeignTroopViolationWarning): ForeignTroopViolationWarningEvent {
    return {
      warning,
      offendedNationName: this.nationManager.getNation(warning.offendedNationId)?.name
        ?? warning.offendedNationId,
      violatingNationName: this.nationManager.getNation(warning.violatingNationId)?.name
        ?? warning.violatingNationId,
    };
  }

  private warningKey(offendedNationId: string, violatingNationId: string): string {
    return `${offendedNationId}|${violatingNationId}`;
  }
}

function clamp(value: number): number {
  return Math.max(MIN_VALUE, Math.min(MAX_VALUE, value));
}
