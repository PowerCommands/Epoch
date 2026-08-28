/**
 * Repeatable city production projects.
 *
 * Unlike units, buildings, wonders, corporations or manufactured resources, a
 * project never completes and never produces a permanent object. While a
 * project is the active production it continuously converts part of the city's
 * production into another yield each turn (see {@link ProductionSystem}).
 *
 * Projects deliberately reuse the existing Producible/production pipeline
 * rather than introducing a parallel production economy.
 */
export interface ProjectDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /**
   * Fraction of the city's per-turn Production converted into national Gold
   * each turn while this project is the active production. 0.5 = 50%.
   */
  readonly productionToGoldRatio: number;
}

export const ECONOMIC_DEVELOPMENT: ProjectDefinition = {
  id: 'economic_development',
  name: 'Economic Development',
  description: "Convert 50% of this city's Production into Gold each turn.",
  productionToGoldRatio: 0.5,
};

export const ALL_PROJECTS: readonly ProjectDefinition[] = [ECONOMIC_DEVELOPMENT];

export function getProjectById(id: string): ProjectDefinition | undefined {
  return ALL_PROJECTS.find((project) => project.id === id);
}

/**
 * Gold produced by a project this turn, given the city's current production.
 * Deterministic and recomputed from live production so the value tracks
 * changes to the city's output.
 */
export function calculateProjectGoldPerTurn(
  project: ProjectDefinition,
  cityProductionPerTurn: number,
): number {
  return Math.floor(Math.max(0, cityProductionPerTurn) * project.productionToGoldRatio);
}
