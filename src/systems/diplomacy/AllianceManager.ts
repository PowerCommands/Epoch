import type {
  Alliance,
  AllianceProposalContext,
  AllianceValidationResult,
} from '../../types/alliance';
import { ALLIANCE_COUNCIL_INTERVAL } from '../../data/alliances';

/** AI accepts an alliance only when the relation is clearly positive. */
export const ALLIANCE_ACCEPT_TRUST = 60;
export const ALLIANCE_ACCEPT_HOSTILITY = 10;

/**
 * Minimal relation values the AI acceptance check needs. Kept as a plain shape
 * so the manager stays decoupled from the diplomacy relation model.
 */
export interface AllianceRelationSnapshot {
  trust: number;
  hostility: number;
}

/**
 * Owns Alliance Core v1 state and rules: who is allied with whom, whether a
 * proposal is valid, and whether the AI would accept one. Pure data + rules —
 * it does not touch UI, relations, or the event log. Callers wire those side
 * effects (relation bonus, logging, UI refresh) around it.
 *
 * v1 constraints: two members only, one alliance per nation, no leaving.
 */
export class AllianceManager {
  private readonly alliances = new Map<string, Alliance>();
  private readonly nationToAllianceId = new Map<string, string>();

  getAllianceForNation(nationId: string): Alliance | null {
    const allianceId = this.nationToAllianceId.get(nationId);
    return allianceId ? this.alliances.get(allianceId) ?? null : null;
  }

  getAllianceById(allianceId: string): Alliance | null {
    return this.alliances.get(allianceId) ?? null;
  }

  isInAlliance(nationId: string): boolean {
    return this.nationToAllianceId.has(nationId);
  }

  /** The other member of `nationId`'s alliance, if any. */
  getAllyNationId(nationId: string): string | null {
    const alliance = this.getAllianceForNation(nationId);
    if (!alliance) return null;
    return alliance.memberNationIds.find((id) => id !== nationId) ?? null;
  }

  areAllied(a: string, b: string): boolean {
    const alliance = this.getAllianceForNation(a);
    return alliance ? alliance.memberNationIds.includes(b) : false;
  }

  /** Resolve an alliance contradiction before a system-forced war. */
  separateAlliedNations(a: string, b: string): boolean {
    const alliance = this.getAllianceForNation(a);
    if (!alliance || !alliance.memberNationIds.includes(b)) return false;
    this.removeMember(alliance.id, a);
    if (alliance.memberNationIds.length < 2) this.dissolve(alliance.id);
    return true;
  }

  getAllAlliances(): Alliance[] {
    return [...this.alliances.values()];
  }

  /**
   * Validate an alliance proposal from `proposerId` to `targetId`. Encapsulates
   * every v1 rule so neither UI nor AI code re-implements them.
   */
  canProposeAlliance(
    proposerId: string,
    targetId: string,
    context: AllianceProposalContext,
  ): AllianceValidationResult {
    if (proposerId === targetId) return { ok: false, reason: 'Cannot form an alliance with yourself.' };
    if (!context.haveMet(proposerId, targetId)) return { ok: false, reason: 'You have not met this nation.' };
    if (context.isAtWar(proposerId, targetId)) return { ok: false, reason: 'Cannot form an alliance during war.' };
    if (this.isInAlliance(proposerId)) return { ok: false, reason: 'You are already in an alliance.' };
    if (this.isInAlliance(targetId)) return { ok: false, reason: 'They are already in an alliance.' };
    if (!context.hasOpenBorders(proposerId, targetId)) return { ok: false, reason: 'Requires Open Borders.' };
    if (!context.hasEmbassy(proposerId, targetId)) return { ok: false, reason: 'Requires an established Embassy.' };
    if (!context.hasTradeRelations(proposerId, targetId)) return { ok: false, reason: 'Requires active Trade Relations.' };
    return { ok: true };
  }

  /**
   * Deterministic v1 AI acceptance. Accept only when the proposal is valid and
   * the relation is clearly positive; reject otherwise (neutral, hostile,
   * fearful, warlike, or already allied).
   */
  shouldAcceptAlliance(
    proposerId: string,
    targetId: string,
    context: AllianceProposalContext,
    relation: AllianceRelationSnapshot,
  ): boolean {
    if (!this.canProposeAlliance(proposerId, targetId, context).ok) return false;
    return relation.trust >= ALLIANCE_ACCEPT_TRUST && relation.hostility <= ALLIANCE_ACCEPT_HOSTILITY;
  }

  /**
   * Create and register a two-member alliance. Callers must validate first via
   * {@link canProposeAlliance}; this trusts its inputs and only guards against
   * double-registration.
   */
  createAlliance(founderNationId: string, otherNationId: string, name: string, createdTurn: number): Alliance | null {
    if (this.isInAlliance(founderNationId) || this.isInAlliance(otherNationId)) return null;
    const alliance: Alliance = {
      id: `alliance_${founderNationId}_${otherNationId}_${createdTurn}`,
      name,
      memberNationIds: [founderNationId, otherNationId],
      founderNationId,
      createdTurn,
      nextCouncilTurn: createdTurn + ALLIANCE_COUNCIL_INTERVAL,
    };
    this.register(alliance);
    return alliance;
  }

  /** Add a nation to an existing alliance (used by council "Invite Nation"). */
  addMember(allianceId: string, nationId: string): void {
    const alliance = this.alliances.get(allianceId);
    if (!alliance) return;
    if (this.isInAlliance(nationId)) return;
    if (alliance.memberNationIds.includes(nationId)) return;
    alliance.memberNationIds = [...alliance.memberNationIds, nationId];
    this.nationToAllianceId.set(nationId, allianceId);
  }

  /** Remove one member from an alliance (membership only — survival is decided by the caller). */
  removeMember(allianceId: string, nationId: string): void {
    const alliance = this.alliances.get(allianceId);
    if (!alliance) return;
    alliance.memberNationIds = alliance.memberNationIds.filter((id) => id !== nationId);
    if (this.nationToAllianceId.get(nationId) === allianceId) {
      this.nationToAllianceId.delete(nationId);
    }
  }

  /** Dissolve an alliance entirely, clearing all member mappings. */
  dissolve(allianceId: string): void {
    const alliance = this.alliances.get(allianceId);
    if (!alliance) return;
    for (const memberId of alliance.memberNationIds) {
      if (this.nationToAllianceId.get(memberId) === allianceId) {
        this.nationToAllianceId.delete(memberId);
      }
    }
    this.alliances.delete(allianceId);
  }

  /** Advance (or set) when an alliance next holds its council. */
  setNextCouncilTurn(allianceId: string, turn: number): void {
    const alliance = this.alliances.get(allianceId);
    if (alliance) alliance.nextCouncilTurn = turn;
  }

  /** Replace all alliance state from a save payload. Tolerates missing data. */
  restoreAlliances(alliances: Alliance[] | undefined): void {
    this.reset();
    for (const alliance of alliances ?? []) {
      // Defensive: alliances need at least two members (invites can grow them).
      if (alliance.memberNationIds.length < 2) continue;
      this.register({
        ...alliance,
        memberNationIds: [...alliance.memberNationIds],
        // Older saves predate council scheduling — schedule from creation.
        nextCouncilTurn: alliance.nextCouncilTurn ?? alliance.createdTurn + ALLIANCE_COUNCIL_INTERVAL,
      });
    }
  }

  reset(): void {
    this.alliances.clear();
    this.nationToAllianceId.clear();
  }

  private register(alliance: Alliance): void {
    this.alliances.set(alliance.id, alliance);
    for (const nationId of alliance.memberNationIds) {
      this.nationToAllianceId.set(nationId, alliance.id);
    }
  }
}
