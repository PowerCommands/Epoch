import { getBuildingById } from '../data/buildings';
import { POWER_PLANTS } from '../data/powerPlants';
import type { City } from '../entities/City';
import type { Nation } from '../entities/Nation';
import type { CityPowerPlantState } from './PowerPlantSystem';

export interface CityEnergyDiagnostic {
  cityId: string;
  cityName: string;
  population: number;
  populationCapacity: number;
  energyShortageTurns: number;
  inEnergyShortage: boolean;
  powerPlant: {
    buildingId: string;
    name: string;
    age: number;
    lifespan: number;
    remainingLifespan: number;
    active: boolean;
  } | null;
}

export interface PowerPlantTypeCount {
  buildingId: string;
  name: string;
  count: number;
}

export interface NationCityEnergyDiagnostic {
  nationId: string;
  nationName: string;
  cityCount: number;
  population: number;
  plantCount: number;
  noPlantCount: number;
  energyShortageCityCount: number;
  plantCounts: PowerPlantTypeCount[];
  cities: CityEnergyDiagnostic[];
}

export interface CityEnergyDiagnosticSource {
  getCityPowerPlant(cityId: string): CityPowerPlantState | undefined;
  getCityPopulationCapacity(cityId: string): number;
}

/**
 * Build a read-only autorun snapshot from canonical city and power-plant query
 * APIs. The caller supplies the active nation list, so eliminated nations are
 * naturally absent without diagnostics having to reproduce elimination rules.
 */
export function buildCityEnergyDiagnostics(
  nations: readonly Nation[],
  getCitiesByOwner: (nationId: string) => readonly City[],
  powerPlants: CityEnergyDiagnosticSource,
): NationCityEnergyDiagnostic[] {
  return nations.map((nation) => {
    const cities = getCitiesByOwner(nation.id).map((city): CityEnergyDiagnostic => {
      const state = powerPlants.getCityPowerPlant(city.id);
      const populationCapacity = powerPlants.getCityPopulationCapacity(city.id);
      return {
        cityId: city.id,
        cityName: city.name,
        population: city.population,
        populationCapacity,
        energyShortageTurns: city.energyShortageTurns ?? 0,
        inEnergyShortage: city.energyShortageTurns !== undefined,
        powerPlant: state
          ? {
            buildingId: state.buildingId,
            name: getBuildingById(state.buildingId)?.name ?? state.buildingId,
            age: state.age,
            lifespan: state.lifespan,
            remainingLifespan: state.remainingLifespan,
            active: state.active,
          }
          : null,
      };
    });

    const plantCounts = POWER_PLANTS.map((metadata) => ({
      buildingId: metadata.buildingId,
      name: getBuildingById(metadata.buildingId)?.name ?? metadata.buildingId,
      count: cities.filter((city) => city.powerPlant?.buildingId === metadata.buildingId).length,
    }));
    const plantCount = plantCounts.reduce((sum, entry) => sum + entry.count, 0);

    return {
      nationId: nation.id,
      nationName: nation.name,
      cityCount: cities.length,
      population: cities.reduce((sum, city) => sum + city.population, 0),
      plantCount,
      noPlantCount: cities.length - plantCount,
      energyShortageCityCount: cities.filter((city) => city.inEnergyShortage).length,
      plantCounts,
      cities,
    };
  });
}

function compactPlantLabel(name: string): string {
  return name.replace(/ Power Plant$/, '').replace(/ Plant$/, '');
}

/** Compact, grep-friendly checkpoint lines for autorun console logs. */
export function formatCityEnergyDiagnostics(
  diagnostics: readonly NationCityEnergyDiagnostic[],
): string[] {
  const lines: string[] = [];
  for (const nation of diagnostics) {
    lines.push(
      `[PowerPlantDiag] ${nation.nationName} cities=${nation.cityCount} pop=${nation.population} plants=${nation.plantCount}`,
    );
    lines.push(
      `  ${nation.plantCounts.map((entry) => `${compactPlantLabel(entry.name)}=${entry.count}`).join(' ')} `
      + `None=${nation.noPlantCount} CitiesInEnergyShortage=${nation.energyShortageCityCount}`,
    );
    lines.push(`[CityDiag] ${nation.nationName}`);
    for (const city of nation.cities) {
      const plant = city.powerPlant;
      lines.push(
        `  ${city.cityName} pop=${city.population} capacity=${city.populationCapacity} `
        + `plant=${plant?.name ?? 'None'} age=${plant ? `${plant.age}/${plant.lifespan}` : '-'} `
        + `shortage=${city.energyShortageTurns}`,
      );
      if (city.inEnergyShortage) {
        lines.push(
          `[PowerPlantDiag][WARN] ${nation.nationName} / ${city.cityName}: `
          + `pop=${city.population} capacity=${city.populationCapacity} `
          + `plant=${plant?.name ?? 'None'} shortage=${city.energyShortageTurns}`,
        );
      }
    }
  }
  return lines;
}
