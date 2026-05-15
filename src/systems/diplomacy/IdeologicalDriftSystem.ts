import type { DiplomacyManager, DiplomacyRelation, DiplomaticMemoryValues } from '../DiplomacyManager';
import type { NationManager } from '../NationManager';
import { getLeaderIdeologyByNationId } from '../../data/leaders';
import {
  describeIdeologyCompatibility,
  getIdeologyCompatibility,
} from '../../data/ideologyCompatibility';

export interface IdeologicalDriftEvent {
  readonly nationAId: string;
  readonly nationBId: string;
  readonly nationAName: string;
  readonly nationBName: string;
  readonly compatibility: number;
  readonly compatibilityLabel: string;
  readonly delta: DiplomaticMemoryDelta;
}

interface DiplomaticMemoryDelta {
  readonly trust?: number;
  readonly fear?: number;
  readonly hostility?: number;
  readonly affinity?: number;
}

const DRIFT_INTERVAL_ROUNDS = 5;
const OCCASIONAL_DRIFT_INTERVAL_ROUNDS = 10;
const MIN_VALUE = 0;
const MAX_VALUE = 100;

export class IdeologicalDriftSystem {
  private readonly listeners: Array<(event: IdeologicalDriftEvent) => void> = [];

  constructor(
    private readonly diplomacyManager: DiplomacyManager,
    private readonly nationManager: NationManager,
    private readonly haveMet: (a: string, b: string) => boolean,
  ) {}

  onDrift(listener: (event: IdeologicalDriftEvent) => void): void {
    this.listeners.push(listener);
  }

  handleRoundStart(round: number): void {
    if (round % DRIFT_INTERVAL_ROUNDS !== 0) return;

    const nations = this.nationManager.getAllNations();
    for (let i = 0; i < nations.length; i++) {
      for (let j = i + 1; j < nations.length; j++) {
        const nationA = nations[i];
        const nationB = nations[j];
        if (!this.haveMet(nationA.id, nationB.id)) continue;

        const relation = this.diplomacyManager.getRelation(nationA.id, nationB.id);
        const compatibility = this.getCompatibility(nationA.id, nationB.id);
        const delta = getDriftDelta(compatibility, relation, round);
        if (isEmptyDelta(delta)) continue;

        const actualDelta = this.applyDelta(nationA.id, nationB.id, relation, delta);
        if (isEmptyDelta(actualDelta)) continue;

        this.emitDrift({
          nationAId: nationA.id,
          nationBId: nationB.id,
          nationAName: nationA.name,
          nationBName: nationB.name,
          compatibility,
          compatibilityLabel: describeIdeologyCompatibility(compatibility),
          delta: actualDelta,
        });
      }
    }
  }

  private getCompatibility(nationAId: string, nationBId: string): number {
    const ideologyA = getLeaderIdeologyByNationId(nationAId);
    const ideologyB = getLeaderIdeologyByNationId(nationBId);
    return getIdeologyCompatibility(ideologyA.id, ideologyB.id);
  }

  private applyDelta(
    nationAId: string,
    nationBId: string,
    relation: DiplomacyRelation,
    delta: DiplomaticMemoryDelta,
  ): DiplomaticMemoryDelta {
    const next: DiplomaticMemoryValues = {
      trust: clamp(relation.trust + (delta.trust ?? 0)),
      fear: clamp(relation.fear + (delta.fear ?? 0)),
      hostility: clamp(relation.hostility + (delta.hostility ?? 0)),
      affinity: clamp(relation.affinity + (delta.affinity ?? 0)),
    };
    this.diplomacyManager.setMemoryValues(nationAId, nationBId, next);
    return {
      trust: next.trust - relation.trust,
      fear: next.fear - relation.fear,
      hostility: next.hostility - relation.hostility,
      affinity: next.affinity - relation.affinity,
    };
  }

  private emitDrift(event: IdeologicalDriftEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}

function getDriftDelta(
  compatibility: number,
  relation: DiplomacyRelation,
  round: number,
): DiplomaticMemoryDelta {
  if (compatibility >= 25) {
    return {
      trust: 1,
      affinity: 1,
      hostility: relation.hostility > 0 ? -1 : 0,
    };
  }
  if (compatibility >= 10) {
    return round % OCCASIONAL_DRIFT_INTERVAL_ROUNDS === 0 ? { trust: 1 } : {};
  }
  if (compatibility <= -25) {
    return getTensionDelta(relation, { trust: -1, hostility: 1 });
  }
  if (compatibility <= -10) {
    return round % OCCASIONAL_DRIFT_INTERVAL_ROUNDS === 0
      ? getTensionDelta(relation, { hostility: 1 })
      : {};
  }
  return {};
}

function getTensionDelta(relation: DiplomacyRelation, baseDelta: DiplomaticMemoryDelta): DiplomaticMemoryDelta {
  const cooperationBuffer = getCooperationBuffer(relation);
  if (cooperationBuffer === 0) return baseDelta;

  const hostility = baseDelta.hostility === undefined
    ? undefined
    : Math.max(0, baseDelta.hostility - cooperationBuffer);
  return {
    trust: baseDelta.trust,
    hostility,
  };
}

function getCooperationBuffer(relation: DiplomacyRelation): number {
  if (relation.state !== 'PEACE') return 0;
  if (relation.tradeRelations) return 1;
  if (relation.openBordersFromAToB && relation.openBordersFromBToA) return 1;
  return 0;
}

function isEmptyDelta(delta: DiplomaticMemoryDelta): boolean {
  return (delta.trust ?? 0) === 0 &&
    (delta.fear ?? 0) === 0 &&
    (delta.hostility ?? 0) === 0 &&
    (delta.affinity ?? 0) === 0;
}

function clamp(value: number): number {
  return Math.max(MIN_VALUE, Math.min(MAX_VALUE, value));
}
