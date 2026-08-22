import type { ScenarioNationCustomization } from '../types/gameConfig';
import type { ScenarioData, ScenarioNation } from '../types/scenario';

export type ScenarioNationCustomizationMap = Record<string, ScenarioNationCustomization>;

/**
 * Apply transient Game Setup changes to a cloned scenario. Customizations are
 * keyed by scenario slot, so an optional replacement id map is used to find the
 * materialized runtime nation without changing map ownership references.
 */
export function applyScenarioNationCustomizations(
  scenario: ScenarioData,
  customizations: ScenarioNationCustomizationMap | undefined,
  replacementIdMap: Record<string, string> = {},
): ScenarioData {
  if (!customizations || Object.keys(customizations).length === 0) return scenario;

  const byRuntimeId = new Map<string, ScenarioNationCustomization>();
  for (const [slotId, customization] of Object.entries(customizations)) {
    byRuntimeId.set(replacementIdMap[slotId] ?? slotId, customization);
  }

  const nations = scenario.nations.map((nation): ScenarioNation => {
    const customization = byRuntimeId.get(nation.id);
    if (!customization) return nation;
    const customized: ScenarioNation = {
      ...nation,
      gold: Math.max(0, Math.floor(customization.gold)),
    };
    if (customization.leaderName) customized.leaderName = customization.leaderName;
    else delete customized.leaderName;
    if (customization.leaderDescription) customized.leaderDescription = customization.leaderDescription;
    else delete customized.leaderDescription;
    if (customization.covertPersonalityId) customized.covertPersonalityId = customization.covertPersonalityId;
    else delete customized.covertPersonalityId;
    return customized;
  });

  const nationDetails = { ...(scenario.nationDetails ?? {}) };
  for (const [runtimeId, customization] of byRuntimeId) {
    if (!nations.some((nation) => nation.id === runtimeId)) continue;
    nationDetails[runtimeId] = {
      researchedTechIds: [...new Set(customization.researchedTechIds)],
      unlockedCultureNodeIds: [...new Set(customization.unlockedCultureNodeIds)],
    };
  }

  return { ...scenario, nations, nationDetails };
}
