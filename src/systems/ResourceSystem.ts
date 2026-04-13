import { NationManager } from './NationManager';
import { CityManager } from './CityManager';
import { TurnManager } from './TurnManager';
import type { IResourceGenerator } from './ResourceGenerator';
import type { TurnStartEvent } from '../types/events';
import type { ResourceChangedEvent, ResourceListener } from '../types/resources';

/**
 * ResourceSystem lyssnar på turnStart och genererar resurser för den
 * aktiva nationen och dess städer.
 *
 * Detta är det första "system som lyssnar på events och muterar tillstånd"-
 * mönstret i spelet. Framtida system (produktion, rörelse, AI) följer
 * samma mönster.
 */
export class ResourceSystem {
  private readonly nationManager: NationManager;
  private readonly cityManager: CityManager;
  private readonly generator: IResourceGenerator;
  private readonly listeners: ResourceListener[] = [];
  private hasSkippedInitialTurnStart = false;

  constructor(
    nationManager: NationManager,
    cityManager: CityManager,
    turnManager: TurnManager,
    generator: IResourceGenerator,
  ) {
    this.nationManager = nationManager;
    this.cityManager = cityManager;
    this.generator = generator;

    turnManager.on('turnStart', (e) => this.handleTurnStart(e));

    // Räkna ut per-turn-värden direkt så att UI visar korrekta "+X/turn"
    // redan vid spelstart, innan första genereringen.
    this.recalculatePerTurnForAll();
  }

  on(callback: ResourceListener): void {
    this.listeners.push(callback);
  }

  private handleTurnStart(e: TurnStartEvent): void {
    // TurnManager.start() emits the first turnStart so UI can initialize.
    // Resource accumulation begins on the next turnStart, matching the
    // "0 (+X/turn)" opening state for the first active nation.
    if (!this.hasSkippedInitialTurnStart) {
      this.hasSkippedInitialTurnStart = true;
      return;
    }

    this.onTurnStart(e);
  }

  private onTurnStart(e: TurnStartEvent): void {
    const nation = e.nation;
    const cities = this.cityManager.getCitiesByOwner(nation.id);
    const nationRes = this.nationManager.getResources(nation.id);

    // Räkna om per-turn (kan ändras om städer förstörts/skapats)
    nationRes.goldPerTurn = this.generator.calculateNationGoldPerTurn(nation, cities);
    nationRes.gold += nationRes.goldPerTurn;

    for (const city of cities) {
      const cityRes = this.cityManager.getResources(city.id);
      cityRes.foodPerTurn = this.generator.calculateCityFoodPerTurn(city);
      cityRes.productionPerTurn = this.generator.calculateCityProductionPerTurn(city);
      cityRes.food += cityRes.foodPerTurn;
      cityRes.production += cityRes.productionPerTurn;
    }

    this.notify({ nationId: nation.id });
  }

  /**
   * Räkna ut per-turn-värden för alla nationer och städer.
   * Anropas en gång vid skapande så att UI kan visa "+X/turn" innan
   * första turen faktiskt genererats.
   */
  private recalculatePerTurnForAll(): void {
    for (const nation of this.nationManager.getAllNations()) {
      const cities = this.cityManager.getCitiesByOwner(nation.id);
      const nationRes = this.nationManager.getResources(nation.id);
      nationRes.goldPerTurn = this.generator.calculateNationGoldPerTurn(nation, cities);

      for (const city of cities) {
        const cityRes = this.cityManager.getResources(city.id);
        cityRes.foodPerTurn = this.generator.calculateCityFoodPerTurn(city);
        cityRes.productionPerTurn = this.generator.calculateCityProductionPerTurn(city);
      }
    }
  }

  private notify(e: ResourceChangedEvent): void {
    for (const cb of this.listeners) cb(e);
  }
}
