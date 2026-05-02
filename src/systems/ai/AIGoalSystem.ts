import type { Nation } from '../../entities/Nation';
import type { AIGoal, AIGoalType } from '../../types/ai/AIGoal';
import { createGoal, tickGoals } from './utils/AIGoalUtils';

export interface AIGoalContext {
  cityCount: number;
  gold: number;
  goldPerTurn: number;
  isAtWar: boolean;
  happiness: number;
}

export type AIGoalContextProvider = (nation: Nation) => AIGoalContext;

interface ScoredGoal {
  type: AIGoalType;
  score: number;
}

const ZERO_CONTEXT: AIGoalContext = {
  cityCount: 0,
  gold: 0,
  goldPerTurn: 0,
  isAtWar: false,
  happiness: 0,
};

export class AIGoalSystem {
  constructor(private readonly contextProvider?: AIGoalContextProvider) {}

  update(nation: Nation): void {
    if (!nation.aiGoals) {
      nation.aiGoals = [];
    }

    // 1. Tick existing goals
    nation.aiGoals = tickGoals(nation.aiGoals);

    // 2. Maintain at least 1–2 goals
    if (nation.aiGoals.length < 2) {
      const newGoal = this.selectGoal(nation);
      if (newGoal) {
        nation.aiGoals.push(newGoal);
      }
    }
  }

  private selectGoal(nation: Nation): AIGoal | null {
    const context = this.buildContext(nation);

    const scored: ScoredGoal[] = [
      this.scoreExpand(context),
      this.scoreEconomy(context),
      this.scoreWarPreparation(context),
      this.scoreDefense(context),
      this.scoreHappiness(context),
    ];

    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (!best || best.score <= 0) return null;

    return createGoal(best.type, best.score, this.getDuration(best.type));
  }

  private buildContext(nation: Nation): AIGoalContext {
    return this.contextProvider ? this.contextProvider(nation) : ZERO_CONTEXT;
  }

  private scoreExpand(ctx: AIGoalContext): ScoredGoal {
    let score = 0;

    if (ctx.cityCount < 4) score += 0.6;
    if (ctx.cityCount < 2) score += 0.4;

    return { type: 'expand', score };
  }

  private scoreEconomy(ctx: AIGoalContext): ScoredGoal {
    let score = 0;

    if (ctx.gold < 0) score += 0.6;
    if (ctx.goldPerTurn < 2) score += 0.4;

    return { type: 'build_economy', score };
  }

  private scoreWarPreparation(ctx: AIGoalContext): ScoredGoal {
    let score = 0;

    if (!ctx.isAtWar && ctx.cityCount >= 3) score += 0.3;

    return { type: 'prepare_war', score };
  }

  private scoreDefense(ctx: AIGoalContext): ScoredGoal {
    let score = 0;

    if (ctx.isAtWar) score += 0.7;

    return { type: 'defend', score };
  }

  private scoreHappiness(ctx: AIGoalContext): ScoredGoal {
    let score = 0;

    if (ctx.happiness < 0) score += 0.8;
    if (ctx.happiness < 3) score += 0.3;

    return { type: 'recover_happiness', score };
  }

  private getDuration(type: AIGoalType): number {
    switch (type) {
      case 'expand': return 25;
      case 'build_economy': return 20;
      case 'prepare_war': return 20;
      case 'defend': return 15;
      case 'recover_happiness': return 15;
      default: return 20;
    }
  }
}
