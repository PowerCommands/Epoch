import { getCultureNodeById } from '../../data/cultureTree';
import type { CultureEffect, CultureNode } from '../../types/CultureNode';
import type { AILogFormatter } from '../ai/AILogFormatter';
import type { EventLogSystem } from '../EventLogSystem';
import type { NationManager } from '../NationManager';

type InfluenceConversionEffect = Extract<CultureEffect, { readonly type: 'influenceToHappiness' }>;

export const HAPPINESS_STABLE_THRESHOLD = 5;

export class CultureEffectSystem {
  private readonly conversionHappinessThisTurn = new Map<string, number>();
  private readonly conversionAppliedThisTurn = new Set<string>();

  constructor(
    private readonly nationManager: NationManager,
    private readonly eventLog: EventLogSystem,
    private readonly getCurrentRound: () => number,
    private readonly getNetHappiness: (nationId: string) => number,
    private readonly formatLog?: AILogFormatter,
  ) {}

  beginTurn(nationId: string): void {
    this.conversionHappinessThisTurn.set(nationId, 0);
    this.conversionAppliedThisTurn.delete(nationId);
  }

  applyTurnStartEffects(nationId: string): void {
    if (this.conversionAppliedThisTurn.has(nationId)) return;

    const startingHappiness = this.getNetHappiness(nationId);
    if (startingHappiness >= HAPPINESS_STABLE_THRESHOLD) return;

    const conversion = this.getBestInfluenceConversionEffect(nationId);
    if (!conversion) return;

    const resources = this.nationManager.getResources(nationId);
    let currentHappiness = startingHappiness;
    let influenceSpent = 0;
    let rawHappinessGained = 0;

    while (
      currentHappiness < HAPPINESS_STABLE_THRESHOLD
      && resources.influence >= conversion.influenceCost
    ) {
      resources.influence -= conversion.influenceCost;
      influenceSpent += conversion.influenceCost;
      rawHappinessGained += conversion.happinessGain;
      currentHappiness += conversion.happinessGain;
    }

    if (influenceSpent <= 0) return;

    const happinessGained = Math.min(
      rawHappinessGained,
      HAPPINESS_STABLE_THRESHOLD - startingHappiness,
    );
    const finalHappiness = startingHappiness + happinessGained;

    this.conversionHappinessThisTurn.set(nationId, happinessGained);
    this.conversionAppliedThisTurn.add(nationId);
    this.logCultureEffectEvent(
      nationId,
      `converted ${influenceSpent} influence into ${happinessGained} happiness (stabilized to ${finalHappiness})`,
    );
  }

  getCultureHappinessBonus(nationId: string): number {
    return this.getFlatCultureHappiness(nationId)
      + this.getFutureCultureHappiness(nationId)
      + (this.conversionHappinessThisTurn.get(nationId) ?? 0);
  }

  handleCultureNodeCompleted(nationId: string, cultureNode: CultureNode): void {
    for (const effect of cultureNode.effects ?? []) {
      this.logCultureEffectEvent(
        nationId,
        `unlocked culture effect: ${cultureNode.name} ${describeEffect(effect)}`,
      );
    }

    const futureHappinessGained = this.getFutureCultureHappinessForCompletedNode(nationId, cultureNode.id);
    if (futureHappinessGained > 0) {
      this.logCultureEffectEvent(
        nationId,
        `gained +${futureHappinessGained} permanent happiness from future culture progress`,
      );
    }
  }

  private getActiveEffects(nationId: string): CultureEffect[] {
    const nation = this.nationManager.getNation(nationId);
    if (!nation) return [];

    return nation.unlockedCultureNodeIds.flatMap((nodeId) => (
      getCultureNodeById(nodeId)?.effects ?? []
    ));
  }

  private getBestInfluenceConversionEffect(nationId: string): InfluenceConversionEffect | undefined {
    const conversions = this.getActiveEffects(nationId)
      .filter((effect): effect is InfluenceConversionEffect => (
        effect.type === 'influenceToHappiness'
        && effect.influenceCost > 0
        && effect.happinessGain > 0
      ));

    return conversions.reduce<InfluenceConversionEffect | undefined>((best, candidate) => {
      if (!best) return candidate;
      const candidateRatio = candidate.happinessGain / candidate.influenceCost;
      const bestRatio = best.happinessGain / best.influenceCost;
      if (candidateRatio > bestRatio) return candidate;
      if (candidateRatio === bestRatio && candidate.influenceCost < best.influenceCost) return candidate;
      return best;
    }, undefined);
  }

  private getFlatCultureHappiness(nationId: string): number {
    return this.getActiveEffects(nationId).reduce((sum, effect) => (
      effect.type === 'happinessPerTurnFlat' ? sum + effect.value : sum
    ), 0);
  }

  private getFutureCultureHappiness(nationId: string): number {
    const nation = this.nationManager.getNation(nationId);
    if (!nation) return 0;

    let activeFutureHappinessPerNode = 0;
    let total = 0;

    for (const nodeId of nation.unlockedCultureNodeIds) {
      if (activeFutureHappinessPerNode > 0) {
        total += activeFutureHappinessPerNode;
      }

      for (const effect of getCultureNodeById(nodeId)?.effects ?? []) {
        if (effect.type === 'futureCultureHappiness') {
          activeFutureHappinessPerNode += effect.value;
        }
      }
    }

    return total;
  }

  private getFutureCultureHappinessForCompletedNode(nationId: string, completedNodeId: string): number {
    const nation = this.nationManager.getNation(nationId);
    if (!nation) return 0;

    let activeFutureHappinessPerNode = 0;
    for (const nodeId of nation.unlockedCultureNodeIds) {
      if (nodeId === completedNodeId) {
        return activeFutureHappinessPerNode;
      }

      for (const effect of getCultureNodeById(nodeId)?.effects ?? []) {
        if (effect.type === 'futureCultureHappiness') {
          activeFutureHappinessPerNode += effect.value;
        }
      }
    }

    return 0;
  }

  private logCultureEffectEvent(nationId: string, message: string): void {
    const nation = this.nationManager.getNation(nationId);
    if (!nation) return;

    const fallbackMessage = `${nation.name} ${message}`;
    this.eventLog.log(
      nation.isHuman ? fallbackMessage : this.formatLog?.(nation.id, message) ?? fallbackMessage,
      [nation.id],
      this.getCurrentRound(),
    );
  }
}

function describeEffect(effect: CultureEffect): string {
  switch (effect.type) {
    case 'influenceToHappiness':
      return `enables ${effect.influenceCost} influence -> ${effect.happinessGain} happiness`;
    case 'happinessPerTurnFlat':
      return `grants +${effect.value} happiness per turn`;
    case 'futureCultureHappiness':
      return `grants +${effect.value} happiness per later culture node`;
  }
}
