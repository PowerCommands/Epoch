export type GameSpeedId = 'quick' | 'standard' | 'epic' | 'marathon';

export interface GameSpeedDefinition {
  id: GameSpeedId;
  name: string;
  costMultiplier: number;
  movementBonus: number;
  yearProgressionMultiplier: number;
}

export const GAME_SPEEDS: GameSpeedDefinition[] = [
  { id: 'quick', name: 'Quick', costMultiplier: 0.50, movementBonus: 5, yearProgressionMultiplier: 1.25 },
  { id: 'standard', name: 'Standard', costMultiplier: 0.50, movementBonus: 2, yearProgressionMultiplier: 1.00 },
  { id: 'epic', name: 'Epic', costMultiplier: 0.67, movementBonus: 1, yearProgressionMultiplier: 0.75 },
  { id: 'marathon', name: 'Marathon', costMultiplier: 1.00, movementBonus: 0, yearProgressionMultiplier: 0.50 },
];

export const DEFAULT_GAME_SPEED_ID: GameSpeedId = 'standard';

export function getGameSpeedById(id: string | undefined): GameSpeedDefinition {
  return GAME_SPEEDS.find((speed) => speed.id === id) ?? GAME_SPEEDS.find((speed) => speed.id === DEFAULT_GAME_SPEED_ID)!;
}

export function scaleGameSpeedCost(baseCost: number, speed: GameSpeedDefinition): number {
  return Math.max(1, Math.round(baseCost * speed.costMultiplier));
}
