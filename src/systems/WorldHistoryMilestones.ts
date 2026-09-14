import type { City } from '../entities/City';
import type { CityBuildings } from '../entities/CityBuildings';
import { getSettlementStage, type SettlementStage } from './UrbanDevelopment';
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
  initialize(saved: unknown, existing: readonly Producible[], worldEra: Era, existingCityIds: readonly string[] = [], existingIndustrialCityIds: readonly string[] = [], existingMetropolisIds: readonly string[] = []): void {
    this.seen = new Set(Array.isArray(saved) ? saved.filter((s): s is string => typeof s === 'string') : []);
    for (const event of this.history.getEvents()) {
      if (event.metadata?.firstCity) this.seen.add(event.metadata.settlementStage === 'Metropolis' ? 'first:metropolis' : event.metadata.settlementStage === 'City' ? 'first:industrial-city' : 'first:city');
      if (event.metadata?.worldHistoryKey) this.seen.add(event.metadata.worldHistoryKey);
    }
    // Existing scenario/legacy assets are not newly built; do not invent dates for them.
    for (const definition of WORLD_FIRSTS) {
      if (existing.some(definition.matches)) this.seen.add(`first:${definition.id}`);
    }
    for (const era of Object.keys(WORLD_ERAS) as Era[]) {
      if (getEraRank(era) <= getEraRank(worldEra)) this.seen.add(`era:${era}`);
    }
    for (const id of existingCityIds) this.seen.add(`city-developed:${id}`);
    if (existingCityIds.length) this.seen.add('first:city');
    for (const id of existingIndustrialCityIds) this.seen.add(`city-evolved:${id}`);
    if (existingIndustrialCityIds.length) this.seen.add('first:industrial-city');
    for (const id of existingMetropolisIds) this.seen.add(`city-metropolis:${id}`);
    if (existingMetropolisIds.length) this.seen.add('first:metropolis');
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
  developedCity(city: City, buildings: CityBuildings, previousStage: SettlementStage): void {
    const next = getSettlementStage(buildings, city);
    if (!this.ready || next === previousStage || next === 'Village') return;
    const order = ['Village', 'Town', 'City', 'Metropolis'] as const;
    const stages = order.slice(order.indexOf(previousStage) + 1, order.indexOf(next) + 1).filter((stage): stage is Exclude<SettlementStage, 'Village'> => stage !== 'Village');
    for (const stage of stages) {
      // Retain the old keys for the renamed Town milestone in legacy saves.
      const key = `${stage === 'Town' ? 'city-developed' : stage === 'City' ? 'city-evolved' : 'city-metropolis'}:${city.id}`;
      const firstKey = stage === 'Town' ? 'first:city' : stage === 'City' ? 'first:industrial-city' : 'first:metropolis';
      if (this.seen.has(key)) continue;
      const firstCity = !this.seen.has(firstKey);
      this.seen.add(key); this.seen.add(firstKey);
      this.history.record({ type: 'cityDeveloped', icon: '🏙',
        text: firstCity ? `${city.name} becomes the world's first ${stage}.` : `${city.name} develops from a ${stage === 'Town' ? 'Village' : stage === 'City' ? 'Town' : 'City'} into a ${stage}.`,
        eventNationIds: [city.ownerId], newsImportance: firstCity ? 0 : 4,
        metadata: { cityId: city.id, cityName: city.name, firstCity, settlementStage: stage, worldHistoryKey: key } });
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
