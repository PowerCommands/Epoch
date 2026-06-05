import type { City } from '../entities/City';
import type { WonderState, WonderType } from '../entities/Wonder';
import type { ModifierSet } from '../types/modifiers';
import { addModifiers, EMPTY_MODIFIERS } from '../types/modifiers';
import { getWonderById } from '../data/wonders';
import type { ResearchSystem } from './ResearchSystem';

type WonderCompletedListener = (state: WonderState, wonderType: WonderType) => void;

export interface CanCityBuildWonderContext {
  readonly researchSystem?: ResearchSystem;
}

/**
 * WonderSystem tracks completed World Wonders globally.
 *
 * Each wonder may be built only once across all nations. The system
 * exposes ModifierSet aggregates so wonders contribute to the existing
 * modifier pipeline without special-casing other systems.
 */
export class WonderSystem {
  private readonly completed = new Map<string, WonderState>();
  private readonly listeners: WonderCompletedListener[] = [];

  constructor(private readonly researchSystem?: ResearchSystem) {}

  isWonderBuilt(wonderId: string): boolean {
    return this.completed.has(wonderId);
  }

  isWonderAvailable(wonderId: string): boolean {
    return !this.isWonderBuilt(wonderId);
  }

  getAvailableWonders(wonders: readonly WonderType[]): WonderType[] {
    return wonders.filter((wonder) => this.isWonderAvailable(wonder.id));
  }

  getCompletedWonder(wonderId: string): WonderState | undefined {
    return this.completed.get(wonderId);
  }

  getCompletedWonders(): WonderState[] {
    return [...this.completed.values()];
  }

  getCompletedWondersForCity(cityId: string): WonderState[] {
    return [...this.completed.values()].filter((state) => state.cityId === cityId);
  }

  isWonderBroken(wonderId: string): boolean {
    return this.completed.get(wonderId)?.broken === true;
  }

  /**
   * Set the broken status of a completed wonder. Returns true if the wonder
   * exists and the status actually changed.
   */
  setWonderBroken(wonderId: string, broken: boolean): boolean {
    const state = this.completed.get(wonderId);
    if (state === undefined || (state.broken === true) === broken) return false;
    this.completed.set(wonderId, { ...state, broken });
    return true;
  }

  canCityBuildWonder(
    city: City,
    wonderType: WonderType,
    context: CanCityBuildWonderContext = {},
  ): boolean {
    return this.getCityWonderBlockReason(city, wonderType, context) === undefined;
  }

  /**
   * Returns a human-readable reason a city cannot begin this wonder, or
   * undefined when construction is allowed. Shared by human UI and AI so
   * eligibility stays consistent across both.
   */
  getCityWonderBlockReason(
    city: City,
    wonderType: WonderType,
    context: CanCityBuildWonderContext = {},
  ): string | undefined {
    if (this.isWonderBuilt(wonderType.id)) return 'Already built';

    const research = context.researchSystem ?? this.researchSystem;
    if (research && !research.isWonderUnlocked(city.ownerId, wonderType.id)) {
      return 'Requires technology';
    }

    if (
      wonderType.minimumPopulation !== undefined
      && city.population < wonderType.minimumPopulation
    ) {
      return `Requires population ${wonderType.minimumPopulation} (city has ${city.population})`;
    }

    return undefined;
  }

  /**
   * Register completion of a wonder. Returns false if the wonder is
   * already built globally so the caller can block production.
   */
  completeWonder(
    city: City,
    wonderType: WonderType,
    turn: number,
    placement?: { tileX: number; tileY: number },
  ): boolean {
    if (this.isWonderBuilt(wonderType.id)) return false;

    const state: WonderState = {
      wonderId: wonderType.id,
      cityId: city.id,
      ownerId: city.ownerId,
      tileX: placement?.tileX,
      tileY: placement?.tileY,
      completedTurn: turn,
    };
    this.completed.set(wonderType.id, state);
    for (const listener of this.listeners) listener(state, wonderType);
    return true;
  }

  /**
   * Restore a completed wonder from a saved game. Skips unknown wonder
   * IDs with a warning so save format additions remain forward-compatible.
   */
  restoreCompletedWonder(state: WonderState): void {
    if (!getWonderById(state.wonderId)) {
      console.warn(`[WonderSystem] Unknown wonder id during restore: ${state.wonderId}`);
      return;
    }
    this.completed.set(state.wonderId, { ...state });
  }

  clearAll(): void {
    this.completed.clear();
  }

  onWonderCompleted(listener: WonderCompletedListener): void {
    this.listeners.push(listener);
  }

  getCityModifiers(cityId: string): ModifierSet {
    const sets: ModifierSet[] = [];
    for (const state of this.completed.values()) {
      if (state.cityId !== cityId) continue;
      if (state.broken) continue; // broken wonders provide no effects
      const wonder = getWonderById(state.wonderId);
      if (!wonder || wonder.scope !== 'city') continue;
      sets.push(wonder.modifiers);
    }
    if (sets.length === 0) return EMPTY_MODIFIERS;
    return addModifiers(...sets);
  }

  getNationModifiers(nationId: string): ModifierSet {
    const sets: ModifierSet[] = [];
    for (const state of this.completed.values()) {
      if (state.ownerId !== nationId) continue;
      if (state.broken) continue; // broken wonders provide no effects
      const wonder = getWonderById(state.wonderId);
      if (!wonder) continue;
      if (wonder.scope === 'nation' || wonder.scope === 'global') {
        sets.push(wonder.modifiers);
      }
    }
    if (sets.length === 0) return EMPTY_MODIFIERS;
    return addModifiers(...sets);
  }
}
