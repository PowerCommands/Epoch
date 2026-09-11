import { WORLD_FIRSTS, WORLD_ERAS, eraArticleBody } from '../data/worldHistory';
import type { Era } from '../data/technologies';
import type { Producible } from '../types/producible';
import type { HistoricalTimelineService } from './HistoricalTimelineService';
import { getEraRank } from './EraSystem';

/** Idempotent global facts, recorded through the existing chronicle/newspaper. */
export class WorldHistoryMilestones {
  private seen = new Set<string>();
  private ready = false;
  constructor(private readonly history: HistoricalTimelineService) {}
  initialize(saved: unknown, existing: readonly Producible[], worldEra: Era): void {
    this.seen = new Set(Array.isArray(saved) ? saved.filter((s): s is string => typeof s === 'string') : []);
    for (const event of this.history.getEvents()) {
      if (event.metadata?.worldHistoryKey) this.seen.add(event.metadata.worldHistoryKey);
    }
    // Existing scenario/legacy assets are not newly built; do not invent dates for them.
    for (const definition of WORLD_FIRSTS) {
      if (existing.some(definition.matches)) this.seen.add(`first:${definition.id}`);
    }
    for (const era of Object.keys(WORLD_ERAS) as Era[]) {
      if (getEraRank(era) <= getEraRank(worldEra)) this.seen.add(`era:${era}`);
    }
    this.ready = true;
  }
  getState(): string[] { return [...this.seen].sort(); }
  completed(nationId: string, cityName: string, item: Producible): void {
    if (!this.ready) return;
    for (const definition of WORLD_FIRSTS) {
      const key = `first:${definition.id}`;
      if (this.seen.has(key) || !definition.matches(item)) continue;
      this.seen.add(key);
      this.history.record({ type: 'worldFirst', icon: '✦', text: definition.headline,
        eventNationIds: [nationId], newsImportance: 0,
        metadata: { cityName, worldHistoryKey: key, historyHeadline: definition.headline,
          historyBody: definition.body, historyImage: definition.imagePath } });
    }
  }
  reachedEra(nationId: string, era: Era): void {
    const key = `era:${era}`;
    if (!this.ready || this.seen.has(key) || !WORLD_ERAS[era]) return;
    this.seen.add(key);
    this.history.record({ type: 'worldEra', icon: '✦', text: WORLD_ERAS[era].headline,
      eventNationIds: [nationId], newsImportance: 0,
      metadata: { eraName: era, worldHistoryKey: key, historyHeadline: WORLD_ERAS[era].headline,
        historyBody: eraArticleBody(era), historyImage: '/assets/sprites/news/world-eras.png' } });
  }
}
