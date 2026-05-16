import {
  ERA_TIMELINE,
  getEraIndex,
  getEraTimelineEntry,
} from '../data/eraTimeline';
import type { Era } from '../data/technologies';
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

const MIN_PULL_STRENGTH = 0.2;
const MAX_PULL_STRENGTH = 0.95;

export interface TimeDebugInfo {
  turn: number;
  baseYear: number;
  year: number;
  era?: Era;
  expectedRange?: { startYear: number; endYear: number };
}

export class TimeSystem {
  private readonly yearProgressionMultiplier: number;

  constructor(gameSpeed?: Pick<GameSpeedDefinition, 'yearProgressionMultiplier'>) {
    this.yearProgressionMultiplier = gameSpeed?.yearProgressionMultiplier ?? DEFAULT_YEAR_PROGRESSION_MULTIPLIER;
  }

  getYearForTurn(turn: number, era?: Era): number {
    const baseYear = this.getBaseYearForTurn(turn);
    return this.applyEraCalibration(baseYear, era);
  }

  getBaseYearForTurn(turn: number): number {
    const effectiveTurn = this.getEffectiveTurn(turn);
    const elapsedYears = this.getElapsedYearsBeforeTurn(effectiveTurn);
    return this.toCalendarYear(elapsedYears);
  }

  getLabelForTurn(turn: number, era?: Era): string {
    return `Year: ${this.getYearLabelForTurn(turn, era)} (turn:${turn})`;
  }

  getYearLabelForTurn(turn: number, era?: Era): string {
    const year = this.getYearForTurn(turn, era);
    if (year < 0) return `${Math.abs(year)} BC`;
    return `${year} AD`;
  }

  getDebugInfoForTurn(turn: number, era?: Era): TimeDebugInfo {
    const baseYear = this.getBaseYearForTurn(turn);
    const year = this.applyEraCalibration(baseYear, era);
    const entry = era ? getEraTimelineEntry(era) : undefined;
    return {
      turn,
      baseYear,
      year,
      era,
      expectedRange: entry ? { startYear: entry.startYear, endYear: entry.endYear } : undefined,
    };
  }

  private applyEraCalibration(baseYear: number, era?: Era): number {
    if (!era) return baseYear;

    const entry = getEraTimelineEntry(era);
    if (!entry) return baseYear;

    // Soft pull toward the era midpoint. Pull strength grows across eras, so
    // early eras barely shift the calendar while late eras keep it aligned
    // with civilization progress (avoids "atomic-era civics in 2600 BC").
    const eraIndex = Math.max(0, getEraIndex(era));
    const totalEras = Math.max(1, ERA_TIMELINE.length - 1);
    const t = eraIndex / totalEras;
    const pullStrength = MIN_PULL_STRENGTH + (MAX_PULL_STRENGTH - MIN_PULL_STRENGTH) * t;

    const expectedYear = (entry.startYear + entry.endYear) / 2;
    const adjusted = baseYear * (1 - pullStrength) + expectedYear * pullStrength;

    // Hard floor: once an era is reached, the calendar must not display a
    // year earlier than that era's start. This is what eliminates the worst
    // mismatches without requiring per-turn state.
    return Math.max(entry.startYear, Math.round(adjusted));
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
