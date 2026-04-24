import type { GameSpeedDefinition } from '../data/gameSpeeds';

interface TimelineSegment {
  startTurn: number;
  endTurn?: number;
  yearsPerTurn: number;
}

const START_YEAR_BC = 4000;
const FIRST_TURN = 1;
const DEFAULT_YEAR_PROGRESSION_MULTIPLIER = 1;
const TIMELINE_SEGMENTS: readonly TimelineSegment[] = [
  { startTurn: 1, endTurn: 80, yearsPerTurn: 10 },
  { startTurn: 81, endTurn: 160, yearsPerTurn: 5 },
  { startTurn: 161, endTurn: 260, yearsPerTurn: 2 },
  { startTurn: 261, yearsPerTurn: 1 },
];

export class TimeSystem {
  private readonly yearProgressionMultiplier: number;

  constructor(gameSpeed?: Pick<GameSpeedDefinition, 'yearProgressionMultiplier'>) {
    this.yearProgressionMultiplier = gameSpeed?.yearProgressionMultiplier ?? DEFAULT_YEAR_PROGRESSION_MULTIPLIER;
  }

  getYearForTurn(turn: number): number {
    const effectiveTurn = this.getEffectiveTurn(turn);
    const elapsedYears = this.getElapsedYearsBeforeTurn(effectiveTurn);
    return this.toCalendarYear(elapsedYears);
  }

  getLabelForTurn(turn: number): string {
    const year = this.getYearForTurn(turn);

    let yearLabel: string;

    if (year < 0) {
      yearLabel = `${Math.abs(year)} BC`;
    } else {
      yearLabel = `${year} AD`;
    }

    return `Year: ${yearLabel} (turn:${turn})`;
  }

  private getEffectiveTurn(turn: number): number {
    const safeTurn = Math.max(FIRST_TURN, Math.floor(turn));
    const effectiveTurn = FIRST_TURN + Math.floor((safeTurn - FIRST_TURN) * this.yearProgressionMultiplier);
    return Math.max(FIRST_TURN, effectiveTurn);
  }

  private getElapsedYearsBeforeTurn(turn: number): number {
    let elapsedYears = 0;

    for (const segment of TIMELINE_SEGMENTS) {
      if (turn <= segment.startTurn) break;

      const segmentEndTurn = segment.endTurn ?? turn - 1;
      const lastCompletedTurn = Math.min(turn - 1, segmentEndTurn);
      if (lastCompletedTurn < segment.startTurn) continue;

      const completedTurnsInSegment = lastCompletedTurn - segment.startTurn + 1;
      elapsedYears += completedTurnsInSegment * segment.yearsPerTurn;
    }

    return elapsedYears;
  }

  private toCalendarYear(elapsedYears: number): number {
    if (elapsedYears < START_YEAR_BC) {
      return -START_YEAR_BC + elapsedYears;
    }

    return elapsedYears - START_YEAR_BC + 1;
  }
}
