import { getLeaderById } from '../../data/leaders';
import type { GossipCategory, GossipExecutionResult, GossipFailureReason } from '../../types/gossip';
import type { RightSidebarRow } from '../phaser/RightSidebarPanelTypes';
import { GOSSIP_INFLUENCE_CHOICES, GossipDialogModel, type GossipDialogContext } from './GossipDialogModel';

/** Gossip selection and presentation inside the shared audience chamber. */
export class GossipConversation {
  private readonly model: GossipDialogModel;
  private currentLeaderId: string | null = null;
  private expandedCategory: GossipCategory | null = null;

  constructor(sourceNationId: string, context: GossipDialogContext, private readonly refresh: (preserveScroll: boolean) => void) {
    this.model = new GossipDialogModel(sourceNationId, context);
  }

  open(leaderId: string): void {
    const leader = getLeaderById(leaderId);
    if (!leader || this.currentLeaderId === leaderId) return;
    this.currentLeaderId = leaderId;
    this.expandedCategory = null;
    this.model.open(leader.nationId);
  }

  close(): void {
    this.currentLeaderId = null;
    this.model.close();
  }

  buildRows(): RightSidebarRow[] {
    const leader = this.currentLeaderId ? getLeaderById(this.currentLeaderId) : undefined;
    if (!leader) return [];
    const selected = this.model.getSelectedItem();
    const rows: RightSidebarRow[] = [{ kind: 'text', text: 'Conversation actions', large: true }];
    const sportsPreferences = this.model.getKnownSportsPreferences();
    if (sportsPreferences) {
      rows.push(
        { kind: 'text', text: 'Known Information', large: true },
        { kind: 'text', text: 'Sports Preferences' },
        { kind: 'text', text: `${sportsPreferences.traditionalSport} / ${sportsPreferences.additionalSport}`, muted: true },
        { kind: 'separator' },
      );
    }
    for (const category of ['information', 'manipulation', 'insult'] as const) {
      const items = this.model.getItems().filter((item) => item.type === category);
      const expanded = this.expandedCategory === category;
      const selectedSummary = selected?.type === category
        ? this.model.getResolvedTextForItem(selected.id) ?? selected.textTemplate
        : undefined;
      rows.push({
        kind: 'button',
        text: `${categoryLabel(category)} (${items.length}) ${expanded ? '▾' : '▸'}${selectedSummary ? ` — ${selectedSummary}` : ''}`,
        selected: selected?.type === category,
        accentColor: categoryColor(category),
        onClick: () => {
          this.expandedCategory = expanded ? null : category;
          this.refresh(true);
        },
      });
      if (!expanded) continue;
      rows.push(...items.map((item): RightSidebarRow => ({
        kind: 'button',
        text: `↳ ${this.model.getResolvedTextForItem(item.id) ?? item.textTemplate}`,
        disabled: !this.model.getItemAvailability(item.id).available,
        disabledReason: cultureRequirementText(this.model.getItemAvailability(item.id).requiredCultureNodeName),
        selected: selected?.id === item.id,
        accentColor: categoryColor(item.type),
        onClick: () => {
          this.model.selectItem(item.id);
          this.expandedCategory = null;
          this.refresh(false);
        },
      })));
    }

    if (selected?.requiresTarget) {
      rows.push({ kind: 'separator' }, { kind: 'text', text: 'Choose another known leader', large: true });
      if (this.model.getTargets().length === 0) {
        rows.push({ kind: 'text', text: 'You do not know another valid nation yet.', muted: true });
      } else {
        rows.push(...this.model.getTargets().map((target): RightSidebarRow => ({
          kind: 'button',
          text: `${target.leaderName} — ${target.nationName}`,
          selected: this.model.getSelectedTarget()?.nationId === target.nationId,
          onClick: () => { this.model.selectTarget(target.nationId); this.refresh(true); },
        })));
      }
    }

    if (selected?.type === 'manipulation') {
      const available = this.model.getAvailableInfluence();
      const status = this.model.getManipulationStatus();
      const selectedCost = this.model.getManipulationCost();
      rows.push(
        { kind: 'separator' },
        { kind: 'text', text: `Influence available: ${available}`, large: true },
        {
          kind: 'buttonGroup',
          buttons: GOSSIP_INFLUENCE_CHOICES.map((amount) => {
            const cost = this.model.getManipulationCost(selected.id, amount);
            return {
              text: cost ? `${amount} → ${cost.actualCost}` : `${amount}`,
              disabled: !cost || cost.actualCost > available,
              accentColor: this.model.getSelectedInfluence() === amount ? 0xf4d06f : 0x6fb2d4,
              onClick: () => { this.model.selectInfluence(amount); this.refresh(true); },
            };
          }),
        },
      );
      if (selectedCost) {
        rows.push({
          kind: 'text',
          text: `Actual cost: ${selectedCost.actualCost} Influence (${selectedCost.sourceEra}, ${selectedCost.itemWeight}× rumor)`,
          muted: true,
        });
      }
      if (status && !status.allowed) {
        rows.push({ kind: 'text', text: manipulationStatusText(status.failureReason, status.remainingRounds, leader.name), muted: true });
      }
    }

    if (selected?.type === 'insult') {
      const status = this.model.getInsultStatus();
      if (status && !status.allowed) {
        rows.push(
          { kind: 'separator' },
          { kind: 'text', text: insultStatusText(status.remainingRounds, leader.name), muted: true },
        );
      }
    }

    const preview = this.model.getResolvedPreview();
    rows.push(
      { kind: 'separator' },
      { kind: 'text', text: 'You will say', large: true },
      { kind: 'text', text: preview ?? 'Select a valid target to continue.', muted: !preview },
      {
        kind: 'button',
        text: selected?.type === 'information' ? 'Ask' : selected?.type === 'manipulation' ? 'Spread rumor' : 'Say it',
        disabled: !this.model.canExecute(),
        disabledReason: this.getDisabledReason(),
        accentColor: 0xf4d06f,
        onClick: () => { this.model.execute(); this.refresh(true); },
      },
    );

    const result = this.model.getLatestResult();
    if (result) rows.push(...this.buildResultRows(result, leader.name));
    return rows;
  }

  private buildResultRows(result: GossipExecutionResult, leaderName: string): RightSidebarRow[] {
    const rows: RightSidebarRow[] = [
      { kind: 'separator' },
      { kind: 'text', text: 'Latest exchange', large: true },
    ];
    if (!result.success) {
      rows.push({ kind: 'text', text: failureText(result.failureReason, result.cooldownRemainingRounds, leaderName), muted: true });
      return rows;
    }
    rows.push({ kind: 'text', text: 'You', large: true }, { kind: 'text', text: result.resolvedText });
    if (result.responseText) {
      rows.push({ kind: 'text', text: leaderName, large: true }, { kind: 'text', text: result.responseText });
    } else if (result.type === 'manipulation') {
      rows.push({ kind: 'text', text: `Rumor spread. ${result.influenceSpent} Influence spent.`, muted: true });
    } else {
      rows.push({ kind: 'text', text: 'Remark delivered.', muted: true });
    }
    return rows;
  }

  private getDisabledReason(): string | undefined {
    const selected = this.model.getSelectedItem();
    if (!selected?.requiresTarget || this.model.getSelectedTarget()) {
      if (selected?.type === 'manipulation') {
        const status = this.model.getManipulationStatus();
        if (status && !status.allowed) return manipulationStatusText(status.failureReason, status.remainingRounds, 'This leader');
        const cost = this.model.getManipulationCost();
        if (!cost || cost.actualCost > this.model.getAvailableInfluence()) return 'Not enough Influence.';
      }
      if (selected?.type === 'insult') {
        const status = this.model.getInsultStatus();
        if (status && !status.allowed) return insultStatusText(status.remainingRounds, 'this leader');
      }
      return undefined;
    }
    return 'Select another known leader first.';
  }

}

function categoryLabel(type: 'information' | 'manipulation' | 'insult'): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function categoryColor(type: 'information' | 'manipulation' | 'insult'): number {
  if (type === 'information') return 0x6fb2d4;
  if (type === 'manipulation') return 0xd9a441;
  return 0xb86969;
}

function manipulationStatusText(reason: GossipFailureReason | undefined, rounds: number, leaderName: string): string {
  if (reason === 'cooldown_active') return `You recently manipulated ${leaderName}. Available again in ${rounds} rounds.`;
  if (reason === 'recipient_rejects') return `${leaderName} does not trust you enough to believe your rumors.`;
  return 'Manipulation is not available for this leader.';
}

function failureText(reason: GossipFailureReason, rounds: number, leaderName: string): string {
  switch (reason) {
    case 'insufficient_influence': return 'You do not have enough Influence.';
    case 'cooldown_active': return manipulationStatusText(reason, rounds, leaderName);
    case 'insult_cooldown_active': return insultStatusText(rounds, leaderName);
    case 'recipient_rejects': return manipulationStatusText(reason, rounds, leaderName);
    case 'invalid_target':
    case 'invalid_combination': return 'That target is no longer valid.';
    case 'unknown_item': return 'That Gossip topic is no longer available.';
    case 'influence_required': return 'Choose an Influence commitment.';
    case 'invalid_source':
    case 'invalid_recipient': return 'This conversation is no longer available.';
    case 'culture_locked': return 'You have not unlocked the required Cultural advancement.';
    case 'games_not_founded': return 'Games of Nations has not been founded.';
    case 'already_discovered': return 'You already know this leader’s sports preferences.';
  }
}

function insultStatusText(rounds: number, leaderName: string): string {
  return `You recently insulted ${leaderName}. Available again in ${rounds} rounds.`;
}

function cultureRequirementText(requiredCultureNodeName: string | undefined): string | undefined {
  return requiredCultureNodeName ? `Requires ${requiredCultureNodeName}` : undefined;
}
