import type { CovertPersonality, CovertPersonalityId } from '../types/covertPersonality';

export const DEFAULT_COVERT_PERSONALITY_ID: CovertPersonalityId = 'pragmatist';

/**
 * Covert personality presets. Values are weighting inputs, not hard rules — the
 * AI stays capable of unusual behaviour. See {@link CovertPersonality} for the
 * meaning of each attribute.
 */
export const COVERT_PERSONALITIES: readonly CovertPersonality[] = [
  {
    id: 'pragmatist',
    name: 'Pragmatist',
    description: 'Treats covert warfare as one tool among many, with no strong leaning.',
    covertUsageBias: 0,
    suspicionSensitivity: 1.0,
    riskTolerance: 1.0,
    proxyWarPreference: 0.5,
    espionagePreference: 0.5,
    suspicionToWar: 1.0,
    suspicionToTrade: 1.0,
  },
  {
    id: 'honorable',
    name: 'Honorable',
    description: 'Considers covert warfare dishonorable; rarely uses it and reacts strongly when targeted.',
    covertUsageBias: -0.75,
    suspicionSensitivity: 1.3,
    riskTolerance: 0.4,
    proxyWarPreference: 0.1,
    espionagePreference: 0.2,
    suspicionToWar: 1.25,
    suspicionToTrade: 1.0,
  },
  {
    id: 'schemer',
    name: 'Schemer',
    description: 'Actively employs spies and agents and tolerates the diplomatic risk.',
    covertUsageBias: 0.75,
    suspicionSensitivity: 0.9,
    riskTolerance: 1.4,
    proxyWarPreference: 0.8,
    espionagePreference: 0.9,
    suspicionToWar: 1.0,
    suspicionToTrade: 0.8,
  },
  {
    id: 'opportunist',
    name: 'Opportunist',
    description: 'Uses covert actions mainly against weaker targets when the moment is favourable.',
    covertUsageBias: 0.4,
    suspicionSensitivity: 0.9,
    riskTolerance: 1.1,
    proxyWarPreference: 0.6,
    espionagePreference: 0.6,
    suspicionToWar: 1.1,
    suspicionToTrade: 0.9,
  },
  {
    id: 'paranoid',
    name: 'Paranoid',
    description: 'Rarely initiates covert operations but becomes suspicious very quickly and escalates.',
    covertUsageBias: -0.3,
    suspicionSensitivity: 1.6,
    riskTolerance: 0.6,
    proxyWarPreference: 0.3,
    espionagePreference: 0.4,
    suspicionToWar: 1.5,
    suspicionToTrade: 1.1,
  },
  {
    id: 'fanatic',
    name: 'Fanatic',
    description: 'Wields covert warfare against ideological rivals and escalates readily.',
    covertUsageBias: 0.5,
    suspicionSensitivity: 1.2,
    riskTolerance: 1.3,
    proxyWarPreference: 0.7,
    espionagePreference: 0.6,
    suspicionToWar: 1.4,
    suspicionToTrade: 1.0,
  },
  {
    id: 'merchant',
    name: 'Merchant',
    description: 'Avoids covert actions that threaten trade; punishes suspicion through commerce, not war.',
    covertUsageBias: -0.4,
    suspicionSensitivity: 1.0,
    riskTolerance: 0.5,
    proxyWarPreference: 0.2,
    espionagePreference: 0.4,
    suspicionToWar: 0.7,
    suspicionToTrade: 1.5,
  },
  {
    id: 'pirate',
    name: 'Pirate',
    description: 'Heavily favours privateers and maritime disruption; thrives on chaos.',
    covertUsageBias: 0.8,
    suspicionSensitivity: 0.8,
    riskTolerance: 1.5,
    proxyWarPreference: 0.9,
    espionagePreference: 0.5,
    suspicionToWar: 1.0,
    suspicionToTrade: 0.7,
  },
];

const BY_ID = new Map<string, CovertPersonality>(COVERT_PERSONALITIES.map((p) => [p.id, p]));

/** Resolve a covert personality by id, falling back to the neutral default. */
export function getCovertPersonalityById(id: string | undefined): CovertPersonality {
  return (id !== undefined && BY_ID.get(id)) || BY_ID.get(DEFAULT_COVERT_PERSONALITY_ID)!;
}

/** True when `id` is a known covert personality id. */
export function isCovertPersonalityId(id: string | undefined): id is CovertPersonalityId {
  return id !== undefined && BY_ID.has(id);
}
