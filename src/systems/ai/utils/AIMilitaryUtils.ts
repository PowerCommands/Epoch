import type { AIGoal } from '../../../types/ai/AIGoal';

export interface MilitaryIntent {
  aggression: number;
  defense: number;
  expansionWar: number;
}

export function getMilitaryIntent(goals: AIGoal[] | undefined): MilitaryIntent {
  const intent: MilitaryIntent = {
    aggression: 1,
    defense: 1,
    expansionWar: 1,
  };

  if (!goals) return intent;

  for (const goal of goals) {
    switch (goal.type) {
      case 'prepare_war':
        intent.aggression += 2 * goal.priority;
        intent.expansionWar += 2 * goal.priority;
        break;

      case 'defend':
        intent.defense += 2 * goal.priority;
        break;

      case 'expand':
        intent.expansionWar += 1.5 * goal.priority;
        break;
    }
  }

  return intent;
}

/**
 * Deterministic 0..1 personality factor derived from a nation id. JS strings
 * have no `hashCode()`, so this uses a small DJB2-style accumulator. Same id
 * always returns the same factor — no Math.random — but different nations
 * vary, giving each game a slightly different feel.
 */
export function getNationPersonalityFactor(nationId: string): number {
  let hash = 5381;
  for (let i = 0; i < nationId.length; i++) {
    hash = ((hash << 5) + hash + nationId.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 1000) / 1000;
}
