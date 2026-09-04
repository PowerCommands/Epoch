import type { WorldCouncilOrganizationKind } from '../types/worldCouncil';
import { ENLIGHTENMENT_CULTURE_NODE_ID, LIBERALISM_CULTURE_NODE_ID } from '../data/cultureTree';

export interface WorldCouncilCultureProgressionNation {
  readonly id: string;
  readonly unlockedCultureNodeIds: readonly string[];
}

export interface WorldCouncilCultureProgressionCandidate {
  readonly nationId: string;
  readonly foundingCityId: string;
  readonly organizationKind: WorldCouncilOrganizationKind;
}

export interface WorldCouncilCultureProgressionContext {
  readonly nations: readonly WorldCouncilCultureProgressionNation[];
  readonly hasCouncil: boolean;
  readonly organizationKind: WorldCouncilOrganizationKind;
  readonly getFoundingCityId: (nationId: string) => string | undefined;
}

/**
 * Derives the next institutional milestone entirely from current culture and
 * Council state so live games and restored saves follow the same path.
 */
export function getWorldCouncilCultureProgressionCandidate(
  context: WorldCouncilCultureProgressionContext,
): WorldCouncilCultureProgressionCandidate | undefined {
  if (context.hasCouncil && context.organizationKind === 'un') return undefined;

  const cultureNodeId = context.hasCouncil ? LIBERALISM_CULTURE_NODE_ID : ENLIGHTENMENT_CULTURE_NODE_ID;
  const organizationKind: WorldCouncilOrganizationKind = context.hasCouncil ? 'un' : 'worldCouncil';

  for (const nation of context.nations) {
    if (!nation.unlockedCultureNodeIds.includes(cultureNodeId)) continue;
    const foundingCityId = context.getFoundingCityId(nation.id);
    if (!foundingCityId) continue;
    return { nationId: nation.id, foundingCityId, organizationKind };
  }

  return undefined;
}
