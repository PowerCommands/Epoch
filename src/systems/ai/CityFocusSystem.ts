import type { City, CityFocusType } from '../../entities/City';
import { getBuildingById } from '../../data/buildings';
import type { MapData, Tile } from '../../types/map';
import { TileType } from '../../types/map';
import { EMPTY_MODIFIERS } from '../../types/modifiers';
import type { AILeaderEraStrategy } from '../../types/aiLeaderEraStrategy';
import { calculateCityEconomy } from '../CityEconomy';
import type { CityManager } from '../CityManager';
import type { NationManager } from '../NationManager';
import { cityHasWaterTile } from '../ProductionRules';
import type { IGridSystem } from '../grid/IGridSystem';
import type { AILogFormatter } from './AILogFormatter';

const SPECIALIZATION_POPULATION_THRESHOLD = 10;
const CLEAR_DOMINANCE_RATIO = 1.35;

const fallbackFormatLog: AILogFormatter = (nationId, message) => `[r?] [?] ${nationId} (era: ancient, gold: 0, happiness: 0) ${message}`;

export class CityFocusSystem {
  constructor(
    private readonly cityManager: CityManager,
    private readonly nationManager: NationManager,
    private readonly mapData: MapData,
    private readonly gridSystem: IGridSystem,
    private readonly formatLog: AILogFormatter = fallbackFormatLog,
    private readonly getEraStrategy?: (nationId: string) => AILeaderEraStrategy | undefined,
    private readonly logStrategicEvent?: (nationId: string, message: string) => void,
  ) {}

  updateFocusForNation(nationId: string): void {
    const nation = this.nationManager.getNation(nationId);
    if (!nation || nation.isHuman) return;

    const eraStrategy = this.getEraStrategy?.(nationId);
    const primaryCity = this.getPrimaryCity(nationId);
    for (const city of this.cityManager.getCitiesByOwner(nationId)) {
      this.updateFocusForCity(city, eraStrategy, primaryCity);
    }
  }

  updateFocusForCity(
    city: City,
    eraStrategy: AILeaderEraStrategy | undefined = this.getEraStrategy?.(city.ownerId),
    primaryCity: City | undefined = this.getPrimaryCity(city.ownerId),
  ): void {
    const nation = this.nationManager.getNation(city.ownerId);
    if (!nation || nation.isHuman) return;

    const primaryCityFocus = eraStrategy?.cityFocusRules?.primaryCityFocus;
    if (primaryCityFocus && primaryCity?.id === city.id) {
      this.assignFocus(city, primaryCityFocus, [
        `${nation.name} assigned ${city.name} as ${primaryCityFocus} primary city focus.`,
        `${city.name} shifted from ${city.focus ?? 'balanced'} to ${primaryCityFocus} focus due to strategy primaryCityFocus.`,
      ]);
      return;
    }

    const specializationThreshold =
      eraStrategy?.cityFocusRules?.largeCityPopulationThreshold ?? SPECIALIZATION_POPULATION_THRESHOLD;
    if (city.population < specializationThreshold) return;

    const currentFocus = city.focus ?? 'balanced';
    const evaluation = this.evaluateSpecialization(city);
    if (!evaluation) return;

    if (currentFocus === 'balanced' || evaluation.dominanceRatio >= CLEAR_DOMINANCE_RATIO) {
      this.assignFocus(
        city,
        evaluation.focus,
        [`${city.name} shifted from ${currentFocus} to ${evaluation.focus} focus due to ${evaluation.reason}.`],
      );
    }
  }

  private getPrimaryCity(nationId: string): City | undefined {
    const cities = this.cityManager.getCitiesByOwner(nationId);
    return cities.find((city) => city.isCapital) ?? cities[0];
  }

  private evaluateSpecialization(city: City): { focus: CityFocusType; reason: string; dominanceRatio: number } | null {
    const buildings = this.cityManager.getBuildings(city.id);
    const economy = calculateCityEconomy(city, this.mapData, buildings, this.gridSystem, EMPTY_MODIFIERS);
    const infrastructure = this.getInfrastructureSignals(buildings.getAll());
    const waterUsage = this.getWorkedWaterTileCount(city);

    const unsortedScores: Array<{ focus: CityFocusType; score: number; reason: string }> = [
      {
        focus: 'cultural',
        score: economy.culture + infrastructure.culture * 2,
        reason: 'high culture output',
      },
      {
        focus: 'military',
        score: economy.production + infrastructure.production * 2,
        reason: 'high production',
      },
      {
        focus: 'economic',
        score: economy.gold + infrastructure.gold * 2,
        reason: 'high gold output',
      },
      {
        focus: 'scientific',
        score: economy.science + infrastructure.science * 2,
        reason: 'high science output',
      },
      {
        focus: 'naval',
        score: (cityHasWaterTile(city, this.mapData) ? 2 : 0) + waterUsage * 3 + infrastructure.naval * 2,
        reason: 'coastal development',
      },
    ];
    const scores = unsortedScores.sort((a, b) => b.score - a.score);

    const best = scores[0];
    if (!best || best.score <= 0) return null;
    const runnerUp = scores[1]?.score ?? 0;
    return {
      focus: best.focus,
      reason: best.reason,
      dominanceRatio: best.score / Math.max(runnerUp, 1),
    };
  }

  private getInfrastructureSignals(buildingIds: readonly string[]): {
    culture: number;
    production: number;
    gold: number;
    science: number;
    naval: number;
  } {
    const signals = { culture: 0, production: 0, gold: 0, science: 0, naval: 0 };
    for (const id of buildingIds) {
      const building = getBuildingById(id);
      if (!building) continue;
      const modifiers = building.modifiers;
      signals.culture += (modifiers.culturePerTurn ?? 0) + (modifiers.culturePercent ?? 0) / 10;
      signals.production += (modifiers.productionPerTurn ?? 0) + (modifiers.productionPercent ?? 0) / 10;
      signals.gold += (modifiers.goldPerTurn ?? 0) + (modifiers.goldPercent ?? 0) / 10;
      signals.science += (modifiers.sciencePerTurn ?? 0) + (modifiers.sciencePercent ?? 0) / 10;
      if (building.placement === 'water' || /harbor|lighthouse|sea[_ -]?port/i.test(building.id)) {
        signals.naval += 1;
      }
    }
    return signals;
  }

  private getWorkedWaterTileCount(city: City): number {
    let count = 0;
    for (const coord of city.workedTileCoords) {
      const tile = this.mapData.tiles[coord.y]?.[coord.x];
      if (this.isWater(tile)) count++;
    }
    return count;
  }

  private isWater(tile: Tile | undefined): boolean {
    return tile?.type === TileType.Coast || tile?.type === TileType.Ocean;
  }

  private assignFocus(city: City, nextFocus: CityFocusType, messages: readonly string[]): void {
    const currentFocus = city.focus ?? 'balanced';
    if (currentFocus === nextFocus) return;

    city.focus = nextFocus;
    for (const message of messages) {
      console.log(this.formatLog(city.ownerId, message));
      this.logStrategicEvent?.(city.ownerId, this.formatLog(city.ownerId, message));
    }
  }
}
