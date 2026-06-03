import { CULTURE_TREE, getCultureNodeById, getRequiredCultureNodeForUnit } from '../../data/cultureTree';
import { getGameSpeedById, scaleGameSpeedCost, type GameSpeedDefinition } from '../../data/gameSpeeds';
import { getEraPacingMultiplier } from '../../data/eraPacingMultipliers';
import type { CultureNode } from '../../types/CultureNode';
import type { NationManager } from '../NationManager';
import { pickBestAICultureNode } from '../ai/AICulturePlanningSystem';
import { DEFAULT_AI_EARLY_GAME_TURN_LIMIT } from '../../data/aiBaselinePriorities';

type ChangedListener = () => void;
export type CultureCompletedListener = (event: {
  readonly nationId: string;
  readonly cultureNode: CultureNode;
}) => void;
type CultureProvider = (nationId: string) => number;
type HappinessProvider = (nationId: string) => number;

export type CultureTreeNode = CultureNode;

export interface CultureNodeViewState {
  node: CultureNode;
  isUnlocked: boolean;
  isActive: boolean;
  isAvailable: boolean;
  missingPrerequisiteIds: string[];
  effectiveCost: number;
}

export class CultureSystem {
  private readonly listeners: ChangedListener[] = [];
  private readonly completedListeners: CultureCompletedListener[] = [];

  constructor(
    private readonly nationManager: NationManager,
    private readonly getCurrentRound: () => number,
    private readonly cultureProvider: CultureProvider = (nationId) => (
      this.nationManager.getResources(nationId).culturePerTurn
    ),
    private readonly gameSpeed: GameSpeedDefinition = getGameSpeedById(undefined),
    private readonly earlyGameTurnLimit: number = DEFAULT_AI_EARLY_GAME_TURN_LIMIT,
    private readonly logEvent?: (nationId: string, message: string) => void,
    private readonly getNetHappiness: HappinessProvider = () => 0,
  ) {}

  canStartCultureNode(nationId: string, nodeId: string): boolean {
    const nation = this.nationManager.getNation(nationId);
    const node = getCultureNodeById(nodeId);
    if (!nation || !node) return false;
    if (nation.currentCultureNodeId === nodeId) return false;
    if (this.isUnlocked(nationId, nodeId)) return false;

    return (node.prerequisites ?? []).every((prerequisiteId) =>
      this.isUnlocked(nationId, prerequisiteId),
    );
  }

  startCultureNode(nationId: string, nodeId: string): boolean {
    if (!this.canStartCultureNode(nationId, nodeId)) return false;

    const nation = this.nationManager.getNation(nationId);
    const node = getCultureNodeById(nodeId);
    if (!nation || !node) return false;

    nation.currentCultureNodeId = nodeId;

    const completedNode = this.tryCompleteCurrentNode(nationId);
    if (completedNode) return true;

    this.logCultureEvent(nation.id, `started developing ${node.name}.`);
    this.notifyChanged();

    return true;
  }

  advanceCultureForNation(nationId: string): CultureNode | null {
    const nation = this.nationManager.getNation(nationId);
    if (!nation?.currentCultureNodeId) return null;

    const node = getCultureNodeById(nation.currentCultureNodeId);
    if (!node) {
      nation.currentCultureNodeId = undefined;
      this.notifyChanged();
      return null;
    }

    if (this.getMissingPrerequisiteIds(nationId, node.id).length > 0 || this.isUnlocked(nationId, node.id)) {
      nation.currentCultureNodeId = undefined;
      this.notifyChanged();
      return null;
    }

    nation.cultureProgress += this.getCulturePerTurn(nationId);

    const completedNode = this.tryCompleteCurrentNode(nationId);
    if (!completedNode) {
      this.notifyChanged();
      return null;
    }

    return completedNode;
  }

  completeCurrentCultureNode(nationId: string): CultureNode | null {
    const nation = this.nationManager.getNation(nationId);
    if (!nation?.currentCultureNodeId) return null;

    const node = getCultureNodeById(nation.currentCultureNodeId);
    if (!node) {
      nation.currentCultureNodeId = undefined;
      this.notifyChanged();
      return null;
    }

    nation.cultureProgress = Math.max(nation.cultureProgress, this.getEffectiveCost(node.id));
    return this.tryCompleteCurrentNode(nationId);
  }

  ensureCultureNodeSelected(nationId: string): boolean {
    const nation = this.nationManager.getNation(nationId);
    if (!nation || nation.currentCultureNodeId) return false;

    const availableCultureNodes = this.getAvailableCultureNodes(nationId);
    const nextNode = nation.isHuman
      ? availableCultureNodes[0]
      : pickBestAICultureNode({
        nation,
        availableCultureNodes,
        currentTurn: this.getCurrentRound(),
        earlyGameTurnLimit: this.earlyGameTurnLimit,
        netHappiness: this.getNetHappiness(nation.id),
      });
    if (!nextNode) return false;

    return this.startCultureNode(nationId, nextNode.id);
  }

  isUnlocked(nationId: string, nodeId: string): boolean {
    const nation = this.nationManager.getNation(nationId);
    return nation?.unlockedCultureNodeIds.includes(nodeId) ?? false;
  }

  /**
   * Whether `nationId` satisfies the culture requirement for building `unitId`.
   * True when the unit is not gated by a culture node, or that node is unlocked.
   * (e.g. Rebels require the Nationalism culture node.)
   */
  isUnitCultureUnlocked(nationId: string, unitId: string): boolean {
    const node = getRequiredCultureNodeForUnit(unitId);
    if (!node) return true;
    return this.isUnlocked(nationId, node.id);
  }

  getCurrentCultureNode(nationId: string): CultureNode | undefined {
    const currentCultureNodeId = this.nationManager.getNation(nationId)?.currentCultureNodeId;
    return currentCultureNodeId ? getCultureNodeById(currentCultureNodeId) : undefined;
  }

  getCultureProgress(nationId: string): number {
    return this.nationManager.getNation(nationId)?.cultureProgress ?? 0;
  }

  getCulturePerTurn(nationId: string): number {
    return this.cultureProvider(nationId);
  }

  getEffectiveCost(nodeId: string): number {
    const node = getCultureNodeById(nodeId);
    if (!node) return 0;
    const base = scaleGameSpeedCost(node.cost, this.gameSpeed);
    return Math.max(1, Math.round(base * getEraPacingMultiplier(node.era)));
  }

  getMissingPrerequisiteIds(nationId: string, nodeId: string): string[] {
    const node = getCultureNodeById(nodeId);
    if (!node) return [];
    return (node.prerequisites ?? []).filter((prerequisiteId) => !this.isUnlocked(nationId, prerequisiteId));
  }

  getAvailableCultureNodes(nationId: string): CultureNode[] {
    return CULTURE_TREE.filter((node) => this.canStartCultureNode(nationId, node.id));
  }

  getUnlockedCultureNodes(nationId: string): CultureNode[] {
    return CULTURE_TREE.filter((node) => this.isUnlocked(nationId, node.id));
  }

  getCultureViewState(nationId: string): CultureNodeViewState[] {
    return CULTURE_TREE.map((node) => {
      const missingPrerequisiteIds = this.getMissingPrerequisiteIds(nationId, node.id);
      return {
        node,
        isUnlocked: this.isUnlocked(nationId, node.id),
        isActive: this.getCurrentCultureNode(nationId)?.id === node.id,
        isAvailable: this.canStartCultureNode(nationId, node.id),
        missingPrerequisiteIds,
        effectiveCost: this.getEffectiveCost(node.id),
      };
    });
  }

  onChanged(cb: ChangedListener): void {
    this.listeners.push(cb);
  }

  onCompleted(listener: CultureCompletedListener): void {
    this.completedListeners.push(listener);
  }

  private logCultureEvent(nationId: string, message: string): void {
    this.logEvent?.(nationId, message);
  }

  private tryCompleteCurrentNode(nationId: string): CultureNode | null {
    const nation = this.nationManager.getNation(nationId);
    if (!nation?.currentCultureNodeId) return null;

    const node = getCultureNodeById(nation.currentCultureNodeId);
    if (!node) return null;

    const effectiveCost = this.getEffectiveCost(node.id);
    if (nation.cultureProgress < effectiveCost) return null;

    if (!nation.unlockedCultureNodeIds.includes(node.id)) {
      nation.unlockedCultureNodeIds.push(node.id);
    }
    nation.cultureProgress -= effectiveCost;
    nation.currentCultureNodeId = undefined;

    this.logCultureEvent(nation.id, `completed ${node.name}.`);
    this.notifyCompleted(nation.id, node);
    this.notifyChanged();

    return node;
  }

  private notifyChanged(): void {
    for (const cb of this.listeners) cb();
  }

  private notifyCompleted(nationId: string, cultureNode: CultureNode): void {
    for (const listener of this.completedListeners) {
      listener({ nationId, cultureNode });
    }
  }
}
