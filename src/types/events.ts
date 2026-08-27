import type { Nation } from '../entities/Nation';

export interface TurnStartEvent {
  round: number;
  nation: Nation;
}

export interface TurnEndEvent {
  round: number;
  nation: Nation;
}

export interface RoundStartEvent {
  round: number;
}

/** Fired before any round-start systems, allowing deterministic date-boundary work. */
export interface BeforeRoundStartEvent {
  round: number;
  previousRound: number | null;
}

export interface RoundEndEvent {
  round: number;
}

export type TurnEventType = 'beforeRoundStart' | 'turnStart' | 'turnEnd' | 'roundStart' | 'roundEnd';
