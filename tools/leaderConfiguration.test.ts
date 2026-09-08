import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_LEADERS, getLeaderById, getLeaderByNationId, getLeaderCovertPersonalityId, getLeaderMilitaryDoctrineByNationId, setActiveLeaderSelections, setScenarioLeaderOverrides } from '../src/data/leaders';
import { setLeaderConfiguration, type LeaderConfiguration } from '../src/data/leaderConfiguration';
import { catalog, effectiveEra, effectiveLeader, profiles, profileUsers, serializeConfiguration, deserializeConfiguration, validateConfiguration } from '../src/editor/leaderEditorModel';
import { getAILeaderEraStrategyById, resolveLeaderEraStrategy, LEADER_ERA_STRATEGY_PROFILES } from '../src/data/aiLeaderEraStrategies';
import { getAINationalAgendaById } from '../src/data/aiNationalAgendas';
import { getAIMilitaryDoctrineById } from '../src/data/aiMilitaryDoctrines';
import { getCovertPersonalityById, isCovertPersonalityId } from '../src/data/covertPersonalities';
import { getIdeologyById } from '../src/data/ideologies';
import { getAIStrategyById } from '../src/data/aiStrategies';
import { getLeaderWarDeclarationPhrases } from '../src/data/leaderWarDeclarations';
import { getBehaviorWeights } from '../src/systems/AIStrategyService';
import { DEFAULT_AI_LEADER_PERSONALITY } from '../src/types/aiLeaderPersonality';

const empty: LeaderConfiguration = { version: 1 };
afterEach(() => { setLeaderConfiguration(); setScenarioLeaderOverrides([]); setActiveLeaderSelections(undefined); });

test('all existing leader identities and effective era strategies retain canonical behavior', () => {
  for (const leader of ALL_LEADERS) {
    assert.deepEqual(getLeaderById(leader.id), leader);
    const view = effectiveLeader(empty, leader.id);
    assert.deepEqual(view.aiPersonality, { ...DEFAULT_AI_LEADER_PERSONALITY, ...leader.aiPersonality });
    assert.equal(view.covertPersonalityId, getLeaderCovertPersonalityId(leader.id));
    const assignments = LEADER_ERA_STRATEGY_PROFILES.find(p => p.leaderId === leader.id)?.strategiesByEra ?? {};
    let expected = 'balancedGrowth';
    for (const { era } of catalog.eras) {
      expected = assignments[era] ?? expected;
      assert.equal(resolveLeaderEraStrategy(leader.id, era).id, expected, `${leader.name}/${era}`);
      assert.equal(effectiveEra(empty, leader.id, era).id, expected);
    }
  }
  for (const name of ['Gandhi', 'Genghis', 'Mad Jack', 'de Gaulle', 'Stalin', 'Mussolini']) assert.ok(ALL_LEADERS.some(l => l.name.includes(name)), name);
});

test('serialization preserves sparse personality, era changes, variants and flavor without mutating canonical data', () => {
  const leader = ALL_LEADERS.find(l => l.name.includes('Gandhi'))!;
  const original = JSON.stringify(ALL_LEADERS);
  const config: LeaderConfiguration = { version: 1, leaders: { [leader.id]: { aiPersonality: { aggressionBias: 21 }, title: 'Scenario title' } }, eraAssignments: { [leader.id]: { ancient: 'frontierExpansion', medieval: 'balancedGrowth', modern: 'conquestCampaign' } } };
  assert.deepEqual(deserializeConfiguration(serializeConfiguration(config)), config);
  assert.deepEqual(Object.keys(config.eraAssignments![leader.id]), ['ancient', 'medieval', 'modern']);
  setLeaderConfiguration(config);
  assert.equal(getLeaderById(leader.id)?.aiPersonality?.aggressionBias, 21);
  assert.equal(getLeaderById(leader.id)?.aiPersonality?.peacePreference, leader.aiPersonality?.peacePreference);
  assert.equal(effectiveEra(config, leader.id, 'classical').source, 'Inherited from ancient');
  assert.equal(resolveLeaderEraStrategy(leader.id, 'industrial').id, 'balancedGrowth');
  assert.equal(resolveLeaderEraStrategy(leader.id, 'future').id, 'conquestCampaign');
  assert.equal(JSON.stringify(ALL_LEADERS), original);
  setLeaderConfiguration();
  assert.deepEqual(getLeaderById(leader.id), leader);
});

test('no early era assignment uses scenario-modified balanced default, later assignments inherit', () => {
  const leader = ALL_LEADERS[0];
  const balanced = structuredClone(catalog.profiles.eraStrategies.find(p => p.id === 'balancedGrowth')!);
  balanced.name = 'Scenario Balanced';
  const config: LeaderConfiguration = { version: 1, profiles: { eraStrategies: [balanced] }, eraAssignments: { [leader.id]: { industrial: 'militaryPreparation' } } };
  setLeaderConfiguration(config);
  assert.equal(resolveLeaderEraStrategy(leader.id, 'ancient').name, 'Scenario Balanced');
  assert.equal(effectiveEra(config, leader.id, 'ancient').from, undefined);
  assert.equal(effectiveEra(config, leader.id, 'modern').from, 'industrial');
});

test('scenario overrides compose with alternative selection and legacy nation name override', () => {
  const leader = ALL_LEADERS.find(l => l.name.includes('de Gaulle'))!;
  setLeaderConfiguration({ version: 1, leaders: { [leader.id]: { name: 'Profile name', aiMilitaryDoctrineId: 'balanced' } } });
  setActiveLeaderSelections({ [leader.nationId]: leader.id });
  setScenarioLeaderOverrides([{ id: leader.nationId, leaderName: 'Legacy name' }]);
  assert.equal(getLeaderByNationId(leader.nationId)?.name, 'Legacy name');
  assert.equal(getLeaderMilitaryDoctrineByNationId(leader.nationId).id, 'balanced');
  setScenarioLeaderOverrides([]);
  assert.equal(getLeaderByNationId(leader.nationId)?.name, 'Profile name');
});

test('all reusable accessors consume scenario definitions and reset between scenarios', () => {
  const config: LeaderConfiguration = { version: 1, profiles: {} };
  for (const kind of Object.keys(catalog.profiles) as (keyof typeof catalog.profiles)[]) {
    const copy = structuredClone(catalog.profiles[kind][0]); copy.name = `Modified ${kind}`;
    (config.profiles as any)[kind] = [copy];
  }
  config.behaviorWeights = { balanced: { exploration: 9, diplomacy: 8, trade: 7, aggression: 6, defense: 5 } };
  setLeaderConfiguration(config);
  assert.equal(getAINationalAgendaById('balanced').name, 'Modified agendas');
  assert.equal(getAIMilitaryDoctrineById(undefined).name, 'Modified doctrines');
  assert.equal(getCovertPersonalityById(undefined).name, 'Modified covert');
  assert.equal(getIdeologyById(catalog.profiles.ideologies[0].id).name, 'Modified ideologies');
  assert.equal(getAIStrategyById(undefined).name, 'Modified strategies');
  assert.equal(getAILeaderEraStrategyById(catalog.profiles.eraStrategies[0].id).name, 'Modified eraStrategies');
  assert.equal(getBehaviorWeights('balanced').trade, 7);
  setLeaderConfiguration();
  assert.equal(getAINationalAgendaById('balanced').name, catalog.profiles.agendas[0].name);
});

test('variants are dynamically usable by runtime and dependency lookup', () => {
  const leader = ALL_LEADERS.find(l => l.name.includes('Stalin'))!;
  const variant = { ...structuredClone(catalog.profiles.covert[0]), id: 'custom_covert', name: 'Custom' } as any;
  const config: LeaderConfiguration = { version: 1, profiles: { covert: [variant] }, leaders: { [leader.id]: { covertPersonalityId: variant.id } } };
  assert.deepEqual(validateConfiguration(config), []);
  assert.equal(profiles(config, 'covert').length, catalog.profiles.covert.length + 1);
  assert.deepEqual(profileUsers(config, 'covert', variant.id).map(u => u.leader.id), [leader.id]);
  setLeaderConfiguration(config);
  assert.equal(getLeaderCovertPersonalityId(leader.id), variant.id);
  assert.equal(getCovertPersonalityById(variant.id).name, 'Custom');
  assert.equal(isCovertPersonalityId(variant.id), true);
});

test('shared era usage reports explicit and inherited activity, and removes users after reassignment', () => {
  const users = profileUsers(empty, 'eraStrategies', 'militaryPreparation');
  assert.ok(users.some(u => u.leader.name.includes('Mussolini') && u.detail.includes('future (Inherited from ancient)')));
  const leader = users[0].leader;
  assert.ok(!profileUsers({ version: 1, eraAssignments: { [leader.id]: {} } }, 'eraStrategies', 'militaryPreparation').some(u => u.leader.id === leader.id));
});

test('war phrase overrides round trip and affect actual announcements', () => {
  const leader = ALL_LEADERS[0]; const phrases = structuredClone(getLeaderWarDeclarationPhrases(leader.id));
  (phrases.conquest as any)[0] = 'Scenario conquest';
  const config: LeaderConfiguration = { version: 1, warDeclarations: { [leader.id]: phrases } };
  setLeaderConfiguration(deserializeConfiguration(serializeConfiguration(config)));
  assert.equal(getLeaderWarDeclarationPhrases(leader.id).conquest[0], 'Scenario conquest');
});

test('invalid references, ranges, sport categories and duplicate variants are actionable errors', () => {
  const id = ALL_LEADERS[0].id;
  const config = { version: 1, leaders: { [id]: { aiNationalAgendaId: 'missing', aiMilitaryDoctrineId: 'missing', covertPersonalityId: 'missing', ideologyId: 'missing', culturePriorities: ['missing'], gamesOfNationsPreferences: { traditionalFavourite: 'boxing', additionalFavourite: 'missing' }, aiPersonality: { aggressionBias: 101, casualtyToleranceRatio: -1, resourceExploitationInterest: 2.5 } } }, eraAssignments: { [id]: { future: 'missing' } }, profiles: { covert: [catalog.profiles.covert[0], catalog.profiles.covert[0]] } } as any;
  const errors = validateConfiguration(config);
  for (const key of ['agendas', 'doctrines', 'covert', 'ideologies', 'culture priority', 'sport', 'aggressionBias', 'casualtyToleranceRatio', 'resourceExploitationInterest', 'eraStrategies', 'duplicate ID']) assert.ok(errors.some(e => e.includes(key)), key);
  assert.throws(() => deserializeConfiguration(JSON.stringify(config)));
});

test('explicitly removing Mad Jack city cap differs from inheriting it', () => {
  const leader = ALL_LEADERS.find(l => l.name === 'Mad Jack')!;
  assert.equal(leader.maxPreferredCities, 1);
  const config: LeaderConfiguration = { version: 1, leaders: { [leader.id]: { maxPreferredCities: null } } };
  assert.deepEqual(validateConfiguration(config), []);
  setLeaderConfiguration(deserializeConfiguration(serializeConfiguration(config)));
  assert.equal(getLeaderById(leader.id)?.maxPreferredCities, undefined);
  assert.equal(effectiveLeader(config, leader.id).maxPreferredCities, undefined);
  setLeaderConfiguration();
  assert.equal(getLeaderById(leader.id)?.maxPreferredCities, 1);
});

test('naval doctrine variants preserve formerly ID-specific behavior', () => {
  const original = catalog.profiles.doctrines.find(p => p.id === 'navalPower')!;
  assert.equal(original.navalExpeditions, true);
  assert.equal(original.navalSaturationControl, true);
  assert.ok(catalog.profiles.doctrines.filter(p => p.id !== 'navalPower').every(p => !p.navalExpeditions && !p.navalSaturationControl));
  const variant = { ...original, id: 'scenario_naval' };
  setLeaderConfiguration({ version: 1, profiles: { doctrines: [variant] } });
  assert.equal(getAIMilitaryDoctrineById(variant.id).navalExpeditions, true);
});

test('every agenda can be duplicated without requiring unrelated bias keys', () => {
  for (const agenda of catalog.profiles.agendas) {
    const variant = { ...agenda, id: `variant_${agenda.id}` };
    assert.deepEqual(validateConfiguration({ version: 1, profiles: { agendas: [variant] } }), [], agenda.id);
  }
});

test('malformed serialized authoring data produces validation messages', () => {
  for (const value of [null, {}, { version: 2 }, { version: 1, profiles: [] }, { version: 1, profiles: { covert: null } }, { version: 1, leaders: { broken: null } }, { version: 1, leaders: { broken: { culturePriorities: 4 } } }]) {
    assert.ok(validateConfiguration(value as any).length);
    assert.throws(() => deserializeConfiguration(JSON.stringify(value)));
  }
});

test('nation override users show the masking layer without losing leader reference visibility', () => {
  const leader = ALL_LEADERS.find(l => l.name === 'Gandhi')!;
  const nation = { id: leader.nationId, name: 'India', covertPersonalityId: 'paranoid' } as any;
  const paranoia = profileUsers(empty, 'covert', 'paranoid', [nation]).find(u => u.leader.id === leader.id)!;
  assert.match(paranoia.detail, /scenario nation: paranoid/);
  const normal = profileUsers(empty, 'covert', 'honorable', [nation]).find(u => u.leader.id === leader.id)!;
  assert.match(normal.detail, /Leader: honorable/);
});

test('every reusable era strategy, doctrine and covert definition can be cloned', () => {
  for (const kind of ['eraStrategies', 'doctrines', 'covert'] as const) for (const profile of catalog.profiles[kind]) {
    assert.deepEqual(validateConfiguration({ version: 1, profiles: { [kind]: [{ ...profile, id: `variant_${profile.id}` }] } }), [], profile.id);
  }
});

test('sparse diplomacy overrides retain other built-in flavor lines', () => {
  const leader = ALL_LEADERS.find(l => l.name.includes('de Gaulle'))!;
  const config: LeaderConfiguration = { version: 1, leaders: { [leader.id]: { diplomacyFlavor: { greeting: 'Scenario greeting' } } } };
  setLeaderConfiguration(config);
  assert.equal(getLeaderById(leader.id)?.diplomacyFlavor?.greeting, 'Scenario greeting');
  assert.equal(getLeaderById(leader.id)?.diplomacyFlavor?.hostile, leader.diplomacyFlavor?.hostile);
  assert.deepEqual(effectiveLeader(config, leader.id).diplomacyFlavor, getLeaderById(leader.id)?.diplomacyFlavor);
});
