import { getLeaderByNationId } from '../data/leaders';
import { getNationDefinitionById } from '../data/nations';
import type { ScenarioData, ScenarioNation } from '../types/scenario';

export type ScenarioNationReplacementMap = Record<string, string>;

export type RuntimeScenarioNation = ScenarioNation & {
  /** Replacement definition used for identity while preserving this slot id. */
  replacementNationId?: string;
};

export function materializeScenarioNationReplacements(
  scenario: ScenarioData,
  replacements: ScenarioNationReplacementMap | undefined,
): { scenario: ScenarioData; idMap: ScenarioNationReplacementMap } {
  const normalized = normalizeScenarioNationReplacements(scenario.nations, replacements);
  if (Object.keys(normalized).length === 0) return { scenario, idMap: {} };

  const remapNationId = (nationId: string): string => normalized[nationId] ?? nationId;
  const nationDetails = Object.fromEntries(
    Object.entries(scenario.nationDetails ?? {}).map(([nationId, details]) => [remapNationId(nationId), details]),
  );

  return {
    idMap: normalized,
    scenario: {
      ...scenario,
      nations: scenario.nations.map((nation) => {
        const replacementNationId = normalized[nation.id];
        if (!replacementNationId) return nation;

        const replaced = applyScenarioNationReplacement(nation, replacementNationId);
        const materialized: ScenarioNation = { ...replaced };
        delete (materialized as RuntimeScenarioNation).replacementNationId;
        return {
          ...materialized,
          id: replacementNationId,
        };
      }),
      cities: scenario.cities.map((city) => ({
        ...city,
        nationId: remapNationId(city.nationId),
        originNationId: city.originNationId ? remapNationId(city.originNationId) : city.originNationId,
      })),
      units: scenario.units.map((unit) => ({
        ...unit,
        nationId: remapNationId(unit.nationId),
      })),
      nationDetails,
      initialDiplomacy: (scenario.initialDiplomacy ?? []).map((entry) => ({
        ...entry,
        nationA: remapNationId(entry.nationA),
        nationB: remapNationId(entry.nationB),
      })),
    },
  };
}

export function applyScenarioNationReplacement(
  nation: ScenarioNation,
  replacementNationId: string | undefined,
): RuntimeScenarioNation {
  if (!replacementNationId || replacementNationId === nation.id) return { ...nation };

  const definition = getNationDefinitionById(replacementNationId);
  if (!definition) return { ...nation };

  const replacementLeader = getLeaderByNationId(replacementNationId);
  return {
    ...nation,
    name: definition.name,
    color: definition.color,
    secondaryColor: definition.secondaryColor,
    leaderName: undefined,
    leaderDescription: undefined,
    leaderId: undefined,
    aiNationalAgendaId: replacementLeader?.aiNationalAgendaId,
    covertPersonalityId: replacementLeader?.covertPersonalityId,
    replacementNationId,
  };
}

export function normalizeScenarioNationReplacements(
  scenarioNations: readonly ScenarioNation[],
  replacements: ScenarioNationReplacementMap | undefined,
): ScenarioNationReplacementMap {
  if (!replacements) return {};

  const slotIds = new Set(scenarioNations.map((nation) => nation.id));
  const usedIdentityIds = new Set<string>();
  const normalized: ScenarioNationReplacementMap = {};

  for (const nation of scenarioNations) {
    const replacementNationId = replacements[nation.id];
    if (
      !replacementNationId ||
      replacementNationId === nation.id ||
      slotIds.has(replacementNationId) ||
      usedIdentityIds.has(replacementNationId)
    ) {
      usedIdentityIds.add(nation.id);
      continue;
    }

    if (!getNationDefinitionById(replacementNationId)) {
      usedIdentityIds.add(nation.id);
      continue;
    }

    normalized[nation.id] = replacementNationId;
    usedIdentityIds.add(replacementNationId);
  }

  return normalized;
}
