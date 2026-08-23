import type { GossipDefinition } from '../../types/gossip';
import type {
  GossipExecutionInput,
  GossipExecutionResult,
  GossipItemAvailability,
  GossipManipulationStatus,
  GossipManipulationCost,
  GossipInsultStatus,
} from '../../types/gossip';

export const GOSSIP_INFLUENCE_CHOICES = [10, 25, 50] as const;

export interface GossipTarget {
  readonly nationId: string;
  readonly nationName: string;
  readonly leaderId: string;
  readonly leaderName: string;
}

export interface GossipTargetCandidate extends GossipTarget {
  readonly knownToHuman: boolean;
}

export function filterGossipTargets(
  candidates: readonly GossipTargetCandidate[],
  sourceNationId: string,
  recipientNationId: string,
): GossipTarget[] {
  return candidates.filter((candidate) => (
    candidate.knownToHuman
    && candidate.nationId !== sourceNationId
    && candidate.nationId !== recipientNationId
  ));
}

export interface GossipDialogContext {
  getAvailableItems(): readonly GossipDefinition[];
  getValidTargets(sourceNationId: string, recipientNationId: string): GossipTarget[];
  getHumanInfluence(): number;
  getItemAvailability(sourceNationId: string, itemId: string): GossipItemAvailability;
  getManipulationStatus(sourceNationId: string, recipientNationId: string): GossipManipulationStatus;
  getManipulationCost(itemId: string, sourceNationId: string, influenceTier: number): GossipManipulationCost | undefined;
  getInsultStatus(sourceNationId: string, recipientNationId: string): GossipInsultStatus;
  resolveText(input: GossipExecutionInput): string | undefined;
  execute(input: GossipExecutionInput): GossipExecutionResult;
}

/** Pure selection/execution coordinator kept separate from Phaser rendering. */
export class GossipDialogModel {
  private recipientNationId: string | null = null;
  private selectedItemId = 'ask_opinion';
  private selectedTargetNationId: string | null = null;
  private selectedInfluence: number = GOSSIP_INFLUENCE_CHOICES[0];
  private targets: GossipTarget[] = [];
  private latestResult: GossipExecutionResult | null = null;

  constructor(
    readonly sourceNationId: string,
    private readonly context: GossipDialogContext,
  ) {}

  open(recipientNationId: string): void {
    this.recipientNationId = recipientNationId;
    this.targets = this.context.getValidTargets(this.sourceNationId, recipientNationId);
    this.selectedTargetNationId = this.targets[0]?.nationId ?? null;
    this.selectedItemId = this.context.getAvailableItems()
      .find((item) => this.context.getItemAvailability(this.sourceNationId, item.id).available)?.id ?? '';
    this.latestResult = null;
  }

  close(): void {
    this.recipientNationId = null;
    this.latestResult = null;
  }

  isOpen(): boolean { return this.recipientNationId !== null; }
  getRecipientNationId(): string | null { return this.recipientNationId; }
  getItems(): readonly GossipDefinition[] { return this.context.getAvailableItems(); }
  getSelectedItem(): GossipDefinition | undefined { return this.getItems().find((item) => item.id === this.selectedItemId); }
  getTargets(): readonly GossipTarget[] { return this.targets; }
  getSelectedTarget(): GossipTarget | undefined { return this.targets.find((target) => target.nationId === this.selectedTargetNationId); }
  getSelectedInfluence(): number { return this.selectedInfluence; }
  getAvailableInfluence(): number { return this.context.getHumanInfluence(); }
  getManipulationCost(itemId = this.selectedItemId, influenceTier = this.selectedInfluence): GossipManipulationCost | undefined {
    return this.context.getManipulationCost(itemId, this.sourceNationId, influenceTier);
  }
  getItemAvailability(itemId: string): GossipItemAvailability {
    return this.context.getItemAvailability(this.sourceNationId, itemId);
  }
  getLatestResult(): GossipExecutionResult | null { return this.latestResult; }

  selectItem(itemId: string): boolean {
    if (!this.getItems().some((item) => item.id === itemId)) return false;
    if (!this.getItemAvailability(itemId).available) return false;
    this.selectedItemId = itemId;
    return true;
  }

  selectTarget(nationId: string): boolean {
    if (!this.targets.some((target) => target.nationId === nationId)) return false;
    this.selectedTargetNationId = nationId;
    return true;
  }

  selectInfluence(amount: number): boolean {
    if (!GOSSIP_INFLUENCE_CHOICES.includes(amount as typeof GOSSIP_INFLUENCE_CHOICES[number])) return false;
    const item = this.getSelectedItem();
    if (item?.type === 'manipulation') {
      const cost = this.getManipulationCost(item.id, amount);
      if (!cost || cost.actualCost > this.getAvailableInfluence()) return false;
    }
    this.selectedInfluence = amount as typeof GOSSIP_INFLUENCE_CHOICES[number];
    return true;
  }

  getManipulationStatus(): GossipManipulationStatus | undefined {
    if (!this.recipientNationId) return undefined;
    return this.context.getManipulationStatus(this.sourceNationId, this.recipientNationId);
  }

  getInsultStatus(): GossipInsultStatus | undefined {
    if (!this.recipientNationId) return undefined;
    return this.context.getInsultStatus(this.sourceNationId, this.recipientNationId);
  }

  getResolvedPreview(): string | undefined {
    const input = this.buildInput();
    return input ? this.context.resolveText(input) : undefined;
  }

  getResolvedTextForItem(itemId: string): string | undefined {
    const item = this.getItems().find((candidate) => candidate.id === itemId);
    if (!item || !this.recipientNationId) return undefined;
    return this.context.resolveText({
      itemId,
      sourceNationId: this.sourceNationId,
      recipientNationId: this.recipientNationId,
      targetNationId: item.requiresTarget ? this.selectedTargetNationId ?? undefined : undefined,
      influence: item.type === 'manipulation' ? this.selectedInfluence : undefined,
    });
  }

  canExecute(): boolean {
    const item = this.getSelectedItem();
    if (!item || !this.recipientNationId) return false;
    if (!this.getItemAvailability(item.id).available) return false;
    if (item.requiresTarget && !this.selectedTargetNationId) return false;
    if (item.type === 'manipulation') {
      const cost = this.getManipulationCost(item.id, this.selectedInfluence);
      if (!cost || cost.actualCost > this.getAvailableInfluence()) return false;
      if (!this.getManipulationStatus()?.allowed) return false;
    }
    if (item.type === 'insult' && !this.getInsultStatus()?.allowed) return false;
    return true;
  }

  execute(): GossipExecutionResult | null {
    const input = this.buildInput();
    if (!input || !this.canExecute()) return null;
    this.latestResult = this.context.execute(input);
    return this.latestResult;
  }

  private buildInput(): GossipExecutionInput | null {
    const item = this.getSelectedItem();
    if (!item || !this.recipientNationId) return null;
    return {
      itemId: item.id,
      sourceNationId: this.sourceNationId,
      recipientNationId: this.recipientNationId,
      targetNationId: item.requiresTarget ? this.selectedTargetNationId ?? undefined : undefined,
      influence: item.type === 'manipulation' ? this.selectedInfluence : undefined,
    };
  }
}
