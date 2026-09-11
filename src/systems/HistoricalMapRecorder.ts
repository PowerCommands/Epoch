import type { MapData } from '../types/map';
import type { HistoricalEvent } from '../types/historicalTimeline';

export interface HistoricalMapSnapshot {
  eventId?: number;
  round: number;
  year: number;
  dateLabel: string;
  /** Alternating owner index / run length, in row-major order. Zero is neutral. */
  owners: number[];
}
export interface SavedHistoricalMap {
  version: 1;
  width: number;
  height: number;
  nations: Array<{ id: string; name: string; color: number }>;
  snapshots: HistoricalMapSnapshot[];
}
export const HISTORY_INTERVAL = 5;
const TRANSITIONS = new Set(['cityFounded', 'cityCaptured', 'capitalCaptured', 'cityLiberated', 'cityRazed',
  'nationEliminated', 'capitulation', 'warDeclared', 'peace', 'worldWarStarted', 'worldWarEnded',
  'nuclearAttack', 'worldFirst', 'worldEra', 'worldCouncilResolution']);

/** Observer only: no simulation mutations, random numbers, or frame subscription. */
export class HistoricalMapRecorder {
  private state: SavedHistoricalMap;
  private ready = false;
  constructor(private readonly map: MapData,
    private readonly nations: () => Array<{ id: string; name: string; color: number }>,
    private readonly clock: () => { round: number; year: number; dateLabel: string; eventId?: number }) {
    this.state = this.empty();
  }
  private empty(): SavedHistoricalMap {
    return { version: 1, width: this.map.width, height: this.map.height, nations: [], snapshots: [] };
  }
  initialize(saved?: unknown): void {
    this.state = this.empty();
    // Optional data is untrusted. Reject the whole stream rather than show false borders.
    try {
      const s = saved as SavedHistoricalMap;
      if (s?.version === 1 && s.width === this.map.width && s.height === this.map.height
        && Array.isArray(s.nations) && Array.isArray(s.snapshots)
        && s.nations.every(n => n && typeof n.id === 'string' && typeof n.name === 'string'
          && Number.isInteger(n.color) && n.color >= 0 && n.color <= 0xffffff)
        && new Set(s.nations.map(n => n.id)).size === s.nations.length) {
        let previous = 0;
        const valid = s.snapshots.every(snapshot => {
          if (!snapshot || !Number.isInteger(snapshot.round) || snapshot.round < previous
            || snapshot.round > this.clock().round || !Number.isFinite(snapshot.year)
            || (snapshot.eventId !== undefined && (!Number.isSafeInteger(snapshot.eventId) || snapshot.eventId < 0))
            || typeof snapshot.dateLabel !== 'string' || !Array.isArray(snapshot.owners)
            || snapshot.owners.length % 2) return false;
          previous = snapshot.round;
          let count = 0;
          for (let i = 0; i < snapshot.owners.length; i += 2) {
            const owner = snapshot.owners[i], run = snapshot.owners[i + 1];
            if (!Number.isInteger(owner) || owner < 0 || owner > s.nations.length
              || !Number.isInteger(run) || run <= 0) return false;
            count += run;
          }
          return count === s.width * s.height;
        });
        if (valid) this.state = JSON.parse(JSON.stringify(s));
      }
    } catch { /* A corrupt optional recording never blocks loading. */ }
    this.ready = true;
    if (!this.state.snapshots.length) this.record();
  }
  observe(event: HistoricalEvent): void { if (TRANSITIONS.has(event.type)) this.record(); }
  interval(round: number): void { if ((round - 1) % HISTORY_INTERVAL === 0) this.record(); }
  record(): void {
    if (!this.ready) return;
    const snapshot = this.capture();
    const last = this.state.snapshots[this.state.snapshots.length - 1];
    // Keep distinct transitions even within a round, but suppress exact duplicates.
    if (last?.round === snapshot.round && last.eventId === snapshot.eventId && last.dateLabel === snapshot.dateLabel
      && last.owners.length === snapshot.owners.length && last.owners.every((v, i) => v === snapshot.owners[i])) return;
    this.state.snapshots.push(snapshot);
  }
  private capture(): HistoricalMapSnapshot {
    for (const nation of this.nations()) {
      if (!this.state.nations.some(n => n.id === nation.id)) {
        this.state.nations.push({ id: nation.id, name: nation.name, color: nation.color });
      }
    }
    const indices = new Map(this.state.nations.map((n, i) => [n.id, i + 1]));
    const owners: number[] = [];
    for (let y = 0; y < this.map.height; y++) for (let x = 0; x < this.map.width; x++) {
      const id = this.map.tiles[y]?.[x]?.ownerId;
      const owner = id ? indices.get(id) ?? 0 : 0;
      if (owners.length && owners[owners.length - 2] === owner) owners[owners.length - 1]++;
      else owners.push(owner, 1);
    }
    return { ...this.clock(), owners };
  }
  getState(): SavedHistoricalMap { return JSON.parse(JSON.stringify(this.state)); }
  /** Include a current endpoint for saving/viewing without modifying the recording. */
  getCurrentHistory(): SavedHistoricalMap {
    const saved = this.getState();
    // Capture uses the palette, so temporarily isolate it to keep viewing read-only.
    const original = this.state;
    this.state = saved;
    try {
      const endpoint = this.capture();
      const last = saved.snapshots[saved.snapshots.length - 1];
      if (!last || JSON.stringify(last) !== JSON.stringify(endpoint)) saved.snapshots.push(endpoint);
      return saved;
    } finally { this.state = original; }
  }
}

export function decodeOwnership(snapshot: HistoricalMapSnapshot): number[] {
  const result: number[] = [];
  for (let i = 0; i < snapshot.owners.length; i += 2) {
    for (let j = 0; j < snapshot.owners[i + 1]; j++) result.push(snapshot.owners[i]);
  }
  return result;
}
