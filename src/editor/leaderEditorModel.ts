import { NATION_DEFINITIONS } from '../data/nations';
import { getIdeologyCompatibilitySafe } from '../data/ideologyCompatibility';
import { resolveEraAssignment } from '../data/leaderEraResolution';
import { ALL_LEADERS, LEADER_COVERT_PERSONALITY_DEFAULTS } from '../data/leaders';
import { AI_NATIONAL_AGENDAS, BALANCED_AGENDA_ID } from '../data/aiNationalAgendas';
import { AI_MILITARY_DOCTRINES, DEFAULT_AI_MILITARY_DOCTRINE_ID } from '../data/aiMilitaryDoctrines';
import { COVERT_PERSONALITIES, DEFAULT_COVERT_PERSONALITY_ID } from '../data/covertPersonalities';
import { IDEOLOGIES, DEFAULT_IDEOLOGY_ID } from '../data/ideologies';
import { AI_STRATEGIES } from '../data/aiStrategies';
import { AI_STRATEGY_BEHAVIOR_WEIGHTS, BALANCED_BEHAVIOR_WEIGHTS } from '../data/aiStrategyBehaviorWeights';
import { ALL_AI_LEADER_ERA_STRATEGIES, LEADER_ERA_STRATEGY_PROFILES } from '../data/aiLeaderEraStrategies';
import { ERA_TIMELINE } from '../data/eraTimeline';
import { CULTURE_TREE } from '../data/cultureTree';
import { GAMES_OF_NATIONS_SPORT_DEFINITIONS } from '../data/gamesOfNationsSports';
import { LEADER_WAR_DECLARATIONS, FALLBACK_WAR_DECLARATIONS } from '../data/leaderWarDeclarations';
import { DEFAULT_AI_LEADER_PERSONALITY } from '../types/aiLeaderPersonality';
import type { BehavioralProfiles, LeaderConfiguration } from '../data/leaderConfiguration';
import type { Era } from '../data/technologies';
import type { ScenarioNation } from '../types/scenario';

export const catalog = {
  leaders: ALL_LEADERS, nations: NATION_DEFINITIONS, eras: ERA_TIMELINE, cultures: CULTURE_TREE,
  sports: GAMES_OF_NATIONS_SPORT_DEFINITIONS,
  profiles: { agendas: AI_NATIONAL_AGENDAS, doctrines: AI_MILITARY_DOCTRINES,
    covert: COVERT_PERSONALITIES, ideologies: IDEOLOGIES, strategies: AI_STRATEGIES,
    eraStrategies: ALL_AI_LEADER_ERA_STRATEGIES },
};
export type ProfileKind = keyof BehavioralProfiles;
export const personalityFields = {
  aggressionBias: [-100, 100, 1, 'Aggression', 'Adds to aggressive strategy selection; negative values favor defense.'],
  expansionBias: [-100, 100, 1, 'Expansion', 'Adds to expansionist strategy selection and settlement preferences.'],
  economyBias: [-100, 100, 1, 'Economy', 'Adds to economic strategy selection.'],
  cultureBias: [-100, 100, 1, 'Culture', 'Favors cultural dominance and also balanced and economic strategies.'],
  diplomacyBias: [-100, 100, 1, 'Diplomacy', 'Favors balanced strategy selection and diplomatic cooperation.'],
  warTolerance: [0, 100, 1, 'War Tolerance', 'Higher values increase willingness to remain at war; 50 is neutral.'],
  peacePreference: [0, 100, 1, 'Peace Preference', 'Higher values favor peace negotiations; 50 is neutral.'],
  minimumUnitsLostBeforePeace: [0, 10000, 1, 'Minimum Units Lost Before Peace', 'Own military losses required before considering peace. Other peace gates still apply.'],
  casualtyToleranceRatio: [0, 1, 0.01, 'Casualty Tolerance', 'Fraction of war-start military strength that must be lost before considering peace.'],
  resourceExploitationInterest: [0, 4, 1, 'Resource Exploitation Interest', 'Interest in foreign exploitation rights: 0 none, 1 low, 2 normal, 3 high, 4 very high.'],
} as const;
export function profiles<K extends ProfileKind>(config: LeaderConfiguration, kind: K): BehavioralProfiles[K][] {
  const merged = new Map<string, BehavioralProfiles[K]>(catalog.profiles[kind].map(p => [p.id, p as BehavioralProfiles[K]]));
  for (const p of config.profiles?.[kind] ?? []) merged.set(p.id, p as BehavioralProfiles[K]);
  return [...merged.values()];
}
export function assignments(config: LeaderConfiguration, leaderId: string) {
  return config.eraAssignments?.[leaderId] ?? LEADER_ERA_STRATEGY_PROFILES.find(p => p.leaderId === leaderId)?.strategiesByEra ?? {};
}
export function effectiveEra(config: LeaderConfiguration, leaderId: string, era: Era) {
  return resolveEraAssignment(assignments(config, leaderId), era);
}

export function effectiveLeader(config: LeaderConfiguration, id: string) {
  const base = ALL_LEADERS.find(l => l.id === id)!;
  const patch = config.leaders?.[id];
  const leader = { ...base, ...patch };
  return { ...leader,
    opportunism: leader.opportunism ?? false,
    impulsiveBully: leader.impulsiveBully ?? false,
    showman: leader.showman ?? false,
    maxPreferredCities: leader.maxPreferredCities ?? undefined,
    diplomacyFlavor: patch?.diplomacyFlavor ? { ...base.diplomacyFlavor, ...patch.diplomacyFlavor } : base.diplomacyFlavor,
    aiPersonality: { ...DEFAULT_AI_LEADER_PERSONALITY, ...base.aiPersonality, ...patch?.aiPersonality },
    aiNationalAgendaId: leader.aiNationalAgendaId ?? BALANCED_AGENDA_ID,
    aiMilitaryDoctrineId: leader.aiMilitaryDoctrineId ?? DEFAULT_AI_MILITARY_DOCTRINE_ID,
    ideologyId: leader.ideologyId ?? DEFAULT_IDEOLOGY_ID,
    covertPersonalityId: leader.covertPersonalityId ?? LEADER_COVERT_PERSONALITY_DEFAULTS[id] ?? DEFAULT_COVERT_PERSONALITY_ID,
  };
}
export const profileLeaderFields = { agendas: 'aiNationalAgendaId', doctrines: 'aiMilitaryDoctrineId',
  covert: 'covertPersonalityId', ideologies: 'ideologyId' } as const;
export function profileUsers(config: LeaderConfiguration, kind: ProfileKind, id: string, nations: readonly ScenarioNation[] = []) {
  return ALL_LEADERS.flatMap(base => {
    const leader = effectiveLeader(config, base.id);
    if (kind === 'eraStrategies') {
      const eras = ERA_TIMELINE.filter(e => effectiveEra(config, leader.id, e.era).id === id)
        .map(e => `${e.era} (${effectiveEra(config, leader.id, e.era).source})`);
      return eras.length ? [{ leader, detail: eras.join(', ') }] : [];
    }
    if (kind === 'strategies') {
      const nation = nations.find(n => n.id === leader.nationId && (n.leaderId ?? ALL_LEADERS.find(l => l.nationId === n.id && l.isDefault)?.id) === leader.id);
      return [{ leader, detail: nation?.aiStrategyId === id ? 'Scenario starting strategy; runtime may reselect' : 'Potential runtime choice; depends on situation, personality and agenda' }];
    }
    const field = profileLeaderFields[kind];
    const nation = nations.find(n => n.id === leader.nationId && (n.leaderId ?? ALL_LEADERS.find(l => l.nationId === n.id && l.isDefault)?.id) === leader.id);
    const national = kind === 'agendas' ? nation?.aiNationalAgendaId : kind === 'covert' ? nation?.covertPersonalityId : undefined;
    return leader[field] === id || national === id ? [{ leader, detail: national ? `Leader: ${leader[field]}; scenario nation: ${national}` : 'Leader reference (including defaults)' }] : [];
  });
}
export function behaviorWeights(config: LeaderConfiguration, id: string) {
  return config.behaviorWeights?.[id] ?? AI_STRATEGY_BEHAVIOR_WEIGHTS[id] ?? BALANCED_BEHAVIOR_WEIGHTS;
}
export function warPhrases(config: LeaderConfiguration, id: string) {
  return config.warDeclarations?.[id] ?? LEADER_WAR_DECLARATIONS[id] ?? FALLBACK_WAR_DECLARATIONS;
}
export function serializeConfiguration(config: LeaderConfiguration): string { return JSON.stringify(config); }
export function deserializeConfiguration(json: string): LeaderConfiguration {
  const value = JSON.parse(json);
  const errors = validateConfiguration(value);
  if (errors.length) throw new Error(errors.join('\n'));
  return value;
}
export function validateConfiguration(config: LeaderConfiguration, nations: readonly ScenarioNation[] = []): string[] {
  const errors: string[] = [];
  if (!config || config.version !== 1) return ['Unsupported leader configuration version.'];
  const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
  for (const key of ['leaders', 'profiles', 'eraAssignments', 'behaviorWeights', 'warDeclarations'] as const) {
    if (config[key] !== undefined && !object(config[key])) errors.push(`${key}: expected an object`);
  }
  if (errors.length) return errors;
  for (const [kind, entries] of Object.entries(config.profiles ?? {})) {
    if (!(kind in catalog.profiles)) errors.push(`Unknown profile collection: ${kind}`);
    if (!Array.isArray(entries) || entries.some(p => !object(p))) errors.push(`${kind}: expected a list of definitions`);
  }
  for (const key of ['leaders', 'eraAssignments', 'behaviorWeights', 'warDeclarations'] as const) {
    for (const [id, value] of Object.entries(config[key] ?? {})) if (!object(value)) errors.push(`${key}.${id}: expected an object`);
  }
  for (const [id, patch] of Object.entries(config.leaders ?? {})) {
    if (!object(patch)) continue;
    for (const key of ['aiPersonality', 'gamesOfNationsPreferences', 'diplomacyFlavor'] as const) if (patch[key] !== undefined && !object(patch[key])) errors.push(`${id}.${key}: expected an object`);
    if (patch.culturePriorities !== undefined && !Array.isArray(patch.culturePriorities)) errors.push(`${id}.culturePriorities: expected a list`);
    for (const key of ['name', 'title', 'image', 'description'] as const) if (patch[key] !== undefined && typeof patch[key] !== 'string') errors.push(`${id}.${key}: expected text`);
    for (const key of ['id', 'nationId', 'isDefault']) if (key in patch) errors.push(`${id}.${key}: canonical identity cannot be overridden`);
  }
  if (errors.length) return errors;
  const knownLeader = (id: string) => { if (!ALL_LEADERS.some(l => l.id === id)) errors.push(`Unknown leader: ${id}`); };
  const ref = (kind: ProfileKind, id: unknown, context: string) => {
    if (!profiles(config, kind).some(p => p.id === id)) errors.push(`${context}: unknown ${kind} ${String(id)}`);
  };
  const finiteTree = (value: unknown, path: string) => {
    if (typeof value === 'number' && !Number.isFinite(value)) errors.push(`${path}: must be finite`);
    if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) finiteTree(child, `${path}.${key}`);
  };
  finiteTree(config, 'Configuration');
  for (const kind of Object.keys(catalog.profiles) as ProfileKind[]) {
    const list = config.profiles?.[kind] ?? [];
    if (!Array.isArray(list)) { errors.push(`${kind}: expected a list`); continue; }
    const seen = new Set<string>();
    for (const p of list) {
      if (!p || typeof p.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(p.id)) { errors.push(`${kind}: invalid ID`); continue; }
      if (seen.has(p.id)) errors.push(`${kind}: duplicate ID ${p.id}`);
      seen.add(p.id);
      if (typeof p.name !== 'string' || !p.name.trim()) errors.push(`${kind}.${p.id}: name is required`);
      // Required canonical shape; optional tuning blocks can be added from other presets.
      const template = catalog.profiles[kind].find(t => t.id === p.id) ?? catalog.profiles[kind][0];
      const shape = (a: any, b: any, path: string) => {
        for (const key of Object.keys(a)) {
          if (key === 'description' || key === 'strategyBias' || key === 'targetComposition') continue;
          const optional = ['foundingPreferences', 'foundingRules', 'resourcePriorities', 'tilePurchase', 'happinessBehavior', 'cityFocusRules', 'productionRhythm', 'navalExpeditions', 'navalSaturationControl', 'scienceBuilding', 'cultureBuilding', 'worker', 'workBoat', 'culture', 'wonder', 'settlerInterval', 'cultureBuildingWeight', 'wonderWeight'].includes(key);
          if (b?.[key] === undefined && optional) continue;
          if (b?.[key] === undefined) { errors.push(`${path}.${key}: missing parameter`); continue; }
          if (typeof a[key] !== typeof b[key]) errors.push(`${path}.${key}: expected ${typeof a[key]}`);
          else if (typeof a[key] === 'object' && a[key] !== null) shape(a[key], b[key], `${path}.${key}`);
        }
      };
      shape(template, p, `${kind}.${p.id}`);
      if ((kind === 'strategies' || kind === 'ideologies') && !catalog.profiles[kind].some(t => t.id === p.id)) errors.push(`${kind}: new IDs require runtime selector/compatibility support; edit existing definitions instead`);
      const domains = (value: any, path: string[]) => {
        for (const [key, child] of Object.entries(value)) {
          if (child && typeof child === 'object') domains(child, [...path, key]);
          if (typeof child !== 'number') continue;
          const ratio = path.includes('targetComposition') || ['proxyWarPreference', 'espionagePreference', 'minAttackHealthRatio'].includes(key);
          if (ratio && (child < 0 || child > 1)) errors.push(`${p.id}.${[...path, key].join('.')}: expected 0–1`);
          if (key === 'covertUsageBias' && (child < -1 || child > 1)) errors.push(`${p.id}.${key}: expected −1–1`);
        }
      };
      domains(p, []);
      if (kind === 'eraStrategies') {
        const focus = (p as BehavioralProfiles['eraStrategies']).cityFocusRules?.primaryCityFocus;
        if (focus && !['balanced', 'cultural', 'military', 'economic', 'naval', 'scientific'].includes(focus)) errors.push(`${p.id}: invalid city focus ${focus}`);
      }
      if (kind === 'agendas') for (const id of Object.keys((p as BehavioralProfiles['agendas']).strategyBias ?? {})) ref('strategies', id, p.id);
    }
  }
  for (const [id, patch] of Object.entries(config.leaders ?? {})) {
    knownLeader(id);
    if (patch.showman !== undefined && typeof patch.showman !== 'boolean') errors.push(`${id}: showman must be true or false`);
    if (patch.impulsiveBully !== undefined && typeof patch.impulsiveBully !== 'boolean') errors.push(`${id}: impulsiveBully must be true or false`);
    if (patch.opportunism !== undefined && typeof patch.opportunism !== 'boolean') errors.push(`${id}: opportunism must be true or false`);
    if (patch.name !== undefined && !patch.name.trim()) errors.push(`${id}: leader name is required`);
    if (patch.gamesOfNationsPreferences && (!patch.gamesOfNationsPreferences.traditionalFavourite || !patch.gamesOfNationsPreferences.additionalFavourite)) errors.push(`${id}: both favorite sport categories are required`);
    for (const [kind, field] of Object.entries(profileLeaderFields)) if (patch[field as keyof typeof patch] !== undefined) ref(kind as ProfileKind, patch[field as keyof typeof patch], id);
    for (const [key, value] of Object.entries(patch.aiPersonality ?? {})) {
      const field = personalityFields[key as keyof typeof personalityFields];
      if (!field || typeof value !== 'number' || !Number.isFinite(value) || value < field[0] || value > field[1] || (field[2] === 1 && !Number.isInteger(value))) errors.push(`${id}: invalid personality ${key} (${value})`);
    }
    if (patch.maxPreferredCities != null && (!Number.isInteger(patch.maxPreferredCities) || patch.maxPreferredCities < 1)) errors.push(`${id}: city limit must be a positive integer`);
    for (const node of patch.culturePriorities ?? []) if (!CULTURE_TREE.some(n => n.id === node)) errors.push(`${id}: unknown culture priority ${node}`);
    for (const [key, category] of [['traditionalFavourite', 'traditional'], ['additionalFavourite', 'additional']] as const) {
      const sport = patch.gamesOfNationsPreferences?.[key];
      if (sport !== undefined && !catalog.sports.some(s => s.id === sport && s.category === category)) errors.push(`${id}: invalid ${category} sport ${sport}`);
    }
  }
  for (const [id, eras] of Object.entries(config.eraAssignments ?? {})) {
    knownLeader(id);
    for (const [era, strategy] of Object.entries(eras)) {
      if (!ERA_TIMELINE.some(e => e.era === era)) errors.push(`${id}: unknown era ${era}`);
      ref('eraStrategies', strategy, `${id} / ${era}`);
    }
  }
  for (const [id, phrases] of Object.entries(config.warDeclarations ?? {})) {
    knownLeader(id);
    for (const reason of Object.keys(FALLBACK_WAR_DECLARATIONS)) {
      const lines = (phrases as any)[reason];
      if (!Array.isArray(lines) || lines.length !== 2 || lines.some(l => typeof l !== 'string' || !l.trim())) errors.push(`${id}: ${reason} requires two nonempty phrases`);
    }
  }
  for (const [id, weights] of Object.entries(config.behaviorWeights ?? {})) {
    ref('strategies', id, 'Behavior weights');
    for (const key of Object.keys(BALANCED_BEHAVIOR_WEIGHTS)) if (typeof (weights as any)[key] !== 'number' || !Number.isFinite((weights as any)[key])) errors.push(`${id}.behaviorWeights.${key}: expected a finite number`);
  }
  for (const nation of nations) {
    if (nation.leaderId && !ALL_LEADERS.some(l => l.id === nation.leaderId && l.nationId === nation.id)) errors.push(`${nation.name}: leader does not belong to this nation`);
    if (nation.aiNationalAgendaId) ref('agendas', nation.aiNationalAgendaId, nation.name);
    if (nation.covertPersonalityId) ref('covert', nation.covertPersonalityId, nation.name);
    if (nation.aiStrategyId) ref('strategies', nation.aiStrategyId, nation.name);
  }
  return errors;
}

export function ideologyRelationships(id: string) {
  return IDEOLOGIES.map(other => ({ id: other.id, name: other.name, score: getIdeologyCompatibilitySafe(id, other.id) }));
}

export function warPhraseSource(config: LeaderConfiguration, id: string): string {
  return config.warDeclarations?.[id] ? 'Scenario Override' : LEADER_WAR_DECLARATIONS[id] ? 'Explicit · Built-in Leader Phrase Library' : 'Inherited · Generic War Phrases';
}
