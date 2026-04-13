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

export interface RoundEndEvent {
  round: number;
}

export type TurnEventType = 'turnStart' | 'turnEnd' | 'roundStart' | 'roundEnd';
