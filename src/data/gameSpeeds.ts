export type GameSpeedId = 'quick' | 'standard' | 'epic' | 'marathon';

export interface GameSpeedDefinition {
  id: GameSpeedId;
  name: string;
  costMultiplier: number;
  yearProgressionMultiplier: number;
  movementBonus: number;
}

export const GAME_SPEEDS: GameSpeedDefinition[] = [
  { id: 'quick', name: 'Quick', costMultiplier: 0.33, yearProgressionMultiplier: 3.0, movementBonus: 5 },
  { id: 'standard', name: 'Standard', costMultiplier: 0.50, yearProgressionMultiplier: 2.0, movementBonus: 2 },
  { id: 'epic', name: 'Epic', costMultiplier: 0.67, yearProgressionMultiplier: 1.5, movementBonus: 1 },
  { id: 'marathon', name: 'Marathon', costMultiplier: 1.00, yearProgressionMultiplier: 1.0, movementBonus: 0 },
];

export const DEFAULT_GAME_SPEED_ID: GameSpeedId = 'marathon';

export function getGameSpeedById(id: string | undefined): GameSpeedDefinition {
  return GAME_SPEEDS.find((speed) => speed.id === id) ?? GAME_SPEEDS.find((speed) => speed.id === DEFAULT_GAME_SPEED_ID)!;
}

export function scaleGameSpeedCost(baseCost: number, speed: GameSpeedDefinition): number {
  return Math.max(1, Math.round(baseCost * speed.costMultiplier));
}
