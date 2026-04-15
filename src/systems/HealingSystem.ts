import { UnitManager } from './UnitManager';
import { CityManager } from './CityManager';
import { TurnManager } from './TurnManager';
import { CITY_BASE_HEALTH, CITY_HEAL_PER_TURN, CITY_HEAL_COOLDOWN_TURNS } from '../data/cities';
import type { TurnStartEvent } from '../types/events';

export interface CityHealedEvent {
  cityId: string;
}

type CityHealedListener = (e: CityHealedEvent) => void;

/**
 * HealingSystem läker enheter och städer vid turnStart.
 *
 * Enheter: +10 HP per varv (capped vid baseHealth).
 * Städer: +10 HP per varv om inte attackerad förra rundan.
 */
export class HealingSystem {
  private readonly unitManager: UnitManager;
  private readonly cityManager: CityManager;
  private readonly turnManager: TurnManager;
  private readonly cityHealedListeners: CityHealedListener[] = [];

  constructor(
    unitManager: UnitManager,
    cityManager: CityManager,
    turnManager: TurnManager,
  ) {
    this.unitManager = unitManager;
    this.cityManager = cityManager;
    this.turnManager = turnManager;

    turnManager.on('turnStart', (e) => this.handleTurnStart(e));
  }

  onCityHealed(listener: CityHealedListener): void {
    this.cityHealedListeners.push(listener);
  }

  private handleTurnStart(e: TurnStartEvent): void {
    // Läk enheter
    const units = this.unitManager.getUnitsByOwner(e.nation.id);
    for (const unit of units) {
      if (unit.health >= unit.unitType.baseHealth) continue;
      unit.health = Math.min(unit.unitType.baseHealth, unit.health + 10);
      this.unitManager.notifyDamaged(unit);
    }

    // Läk städer
    const cities = this.cityManager.getCitiesByOwner(e.nation.id);
    const currentRound = this.turnManager.getCurrentRound();

    for (const city of cities) {
      if (city.health >= CITY_BASE_HEALTH) continue;

      const recentlyAttacked =
        city.lastTurnAttacked !== null &&
        currentRound - city.lastTurnAttacked < CITY_HEAL_COOLDOWN_TURNS + 1;

      if (recentlyAttacked) continue;

      city.health = Math.min(CITY_BASE_HEALTH, city.health + CITY_HEAL_PER_TURN);
      for (const cb of this.cityHealedListeners) {
        cb({ cityId: city.id });
      }
    }
  }
}
