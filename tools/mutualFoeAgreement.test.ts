import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { ALL_LEADERS, getActiveLeaderSelections, setActiveLeaderSelections, setActiveLeaderForNation, setScenarioLeaderOverrides } from '../src/data/leaders';
import { CapitulationSystem } from '../src/systems/CapitulationSystem';
import { Nation } from '../src/entities/Nation';
import { NationManager } from '../src/systems/NationManager';
import { DiplomacyManager } from '../src/systems/DiplomacyManager';
import { CityManager } from '../src/systems/CityManager';
import { ResourceSystem } from '../src/systems/ResourceSystem';
import { TileResourceGenerator } from '../src/systems/ResourceGenerator';
import { HappinessSystem } from '../src/systems/HappinessSystem';
import { TurnManager } from '../src/systems/TurnManager';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem';
import { MutualFoeAgreementSystem, type MutualFoeAnnouncement } from '../src/systems/MutualFoeAgreementSystem';
import { validateMutualFoeAgreements } from '../src/systems/MutualFoeAgreementValidation';
import { ScenarioLoader } from '../src/systems/ScenarioLoader';
import { SaveLoadService, type SaveLoadContext } from '../src/systems/SaveLoadService';
import { UnitManager } from '../src/systems/UnitManager';
import { PolicySystem } from '../src/systems/PolicySystem';
import { ProductionSystem } from '../src/systems/ProductionSystem';
import { DiscoverySystem } from '../src/systems/DiscoverySystem';
import { WonderSystem } from '../src/systems/WonderSystem';
import { NEWSPAPER_EVENT_DEFINITIONS } from '../src/data/newspaperContent';
import type { MutualFoeAgreement } from '../src/types/mutualFoe';
import type { ScenarioData } from '../src/types/scenario';
import { newMutualFoeAgreement, saveMutualFoeAgreement, removeMutualFoeAgreement, mutualFoeLeaderOptions } from '../src/editor/mutualFoeEditorModel';

const R = 'nation_russia', U = 'nation_ukraine', S = 'nation_sweden', G = 'nation_germany', F = 'nation_france';
const Z = 'leader_volodymyr_zelenskyy', P = 'leader_olof_palme', M = 'leader_angela_merkel';
const selections = { [U]: Z, [S]: P, [G]: M, [R]: 'leader_vladimir_putin' };
const members = [{ id: R, name: 'Russia' }, { id: U, name: 'Ukraine' }, { id: S, name: 'Sweden' }, { id: G, name: 'Germany' }, { id: F, name: 'France' }];
const agreement: MutualFoeAgreement = { id: 'european_mutual_defense', name: 'European Mutual Defense Agreement', antagonistNationId: R, memberLeaderIds: [Z, P, M], supportPercent: 20 };
const runtimes: MutualFoeAgreementSystem[] = [];
afterEach(() => { for (const system of runtimes.splice(0)) system.shutdown(); setActiveLeaderSelections(undefined); setScenarioLeaderOverrides([]); });

function harness(definitions: unknown = [agreement], initialWars: [string, string][] = []) {
  setActiveLeaderSelections(selections);
  const nations = new NationManager();
  for (const n of members) nations.addNation(new Nation({ ...n, color: 0xabcdef, isHuman: n.id === U }));
  const cities = new CityManager();
  const turns = new TurnManager(nations);
  const diplomacy = new DiplomacyManager(turns, 0, undefined, 999);
  for (const [a,b] of initialWars) diplomacy.forceDeclareWar(a,b);
  const mapData = { width: 1, height: 1, tileSize: 32, tiles: [[{ x: 0, y: 0, type: 'plains' }]] } as any;
  const grid = new HexGridSystem();
  const happiness = new HappinessSystem(nations, cities);
  const income: Record<string, number> = { [S]: 100, [G]: 250, [U]: 0, [R]: 0, [F]: 100 };
  const resources = new ResourceSystem(nations, cities, turns, new TileResourceGenerator(), mapData, grid, happiness,
    undefined, undefined, id => income[id] ?? 0);
  for (const [id, gold] of [[S,10000],[G,25000],[U,100],[R,1000],[F,500]] as const) resources.setGold(id,gold);
  const logs: string[] = []; const events: MutualFoeAnnouncement[] = [];
  const system = new MutualFoeAgreementSystem(definitions, members, nations, diplomacy, {
    normalGoldPerTurn: id => resources.getNormalGoldIncome(id),
    transferGold: (a,b,amount) => resources.transferGold(a,b,amount),
  }, line => logs.push(line));
  runtimes.push(system);
  resources.setMutualFoeSupport(system); system.onAnnouncement(e=>events.push(e));
  const gold = (id: string) => nations.getResources(id).gold;
  const total = () => nations.getAllNations().reduce((sum,n)=>sum+gold(n.id),0);
  const attack = (target = U) => diplomacy.forceDeclareWar(R,target);
  const saveContext = (): SaveLoadContext => {
    const units = new UnitManager(mapData.width, mapData.height);
    return {
      mapKey: 'mutual-foe-test', humanNationId: U, activeNationIds: members.map(n=>n.id), gameSpeedId: 'standard',
      mapData, gridSystem: grid, nationManager: nations, cityManager: cities, unitManager: units,
      productionSystem: new ProductionSystem(cities, turns, happiness), policySystem: new PolicySystem(nations),
      diplomacyManager: diplomacy, discoverySystem: new DiscoverySystem(nations,cities,units,grid),
      turnManager: turns, wonderSystem: new WonderSystem(), mutualFoeAgreementSystem: system,
    } as SaveLoadContext;
  };
  return { system, nations, diplomacy, resources, turns, income, events, logs, gold, total, attack, saveContext };
}

for (const [description, a, b, activate] of [
  ['antagonist attacks protected Ukraine',R,U,true], ['third-party attack',F,U,false], ['member attacks antagonist',U,R,false],
  ['antagonist attacks protected Germany',R,G,true], ['internal member war',S,G,false],
] as const) test(`directional trigger: ${description}`,()=>{
  const h=harness(); h.diplomacy.forceDeclareWar(a,b); assert.equal(h.system.getCrises().length,activate?1:0);
});

test('replaced leader before attack is not a protected government',()=>{
  const h=harness(); setActiveLeaderForNation(G,'hermann-the-cheruscan'); h.attack(G); assert.equal(h.system.getCrises().length,0);
});
test('antagonist leader is irrelevant before and during the crisis',()=>{
  const h=harness(); setActiveLeaderForNation(R,'ivan-iv'); h.attack(); assert.equal(h.system.getCrises().length,1);
  setActiveLeaderForNation(R,'leader_vladimir_putin'); assert.equal(h.system.getCrises().length,1); assert.equal(h.system.getGoldBreakdown(S).outgoing,20);
});
test('inactive configured leader is excluded from initial support, reconciliation, and activation text',()=>{
  const h=harness(); setActiveLeaderForNation(G,'hermann-the-cheruscan'); h.diplomacy.forceDeclareWar(G,S); h.attack();
  assert.equal(h.gold(G),25000); assert.equal(h.diplomacy.getState(G,S),'WAR'); assert.equal(h.system.getGoldBreakdown(G).outgoing,0);
  const event=h.events.find(e=>e.kind==='activated')!; assert.ok(!event.message.includes('Germany')); assert.ok(!event.nationIds.includes(G));
});
test('canonical leadership replacement immediately stops payments without refund, and return never repeats initial payment',()=>{
  const h=harness(); h.attack(); assert.equal(h.gold(G),20000);
  setActiveLeaderForNation(G,'hermann-the-cheruscan'); assert.equal(h.system.getGoldBreakdown(G).outgoing,0);
  h.system.settleIncome(G,2); assert.equal(h.gold(G),20000);
  setActiveLeaderForNation(G,M); assert.equal(h.system.getGoldBreakdown(G).outgoing,50); assert.equal(h.gold(G),20000);
  assert.equal(h.events.filter(e=>e.kind==='memberLeft').length,1);
});
test('activation reconciles internal wars immediately without negotiations, settlement listeners or memory changes',()=>{
  const h=harness(); h.diplomacy.forceDeclareWar(S,G);
  h.diplomacy.setMemoryValues(S,G,{trust:9, fear:18, suspicion:27, hostility:80, affinity:3});
  let accepted=0, ended=0; h.diplomacy.onPeaceAccepted(()=>accepted++); h.diplomacy.onWarEnded(()=>ended++);
  h.diplomacy.proposePeace(S,G,{goldReparations:999999}); assert.equal(h.diplomacy.canProposePeace(S,G,1),false);
  const before=h.diplomacy.getRelation(S,G); h.attack(); const after=h.diplomacy.getRelation(S,G);
  assert.equal(after.state,'PEACE'); assert.equal(accepted,0); assert.equal(ended,1); assert.equal(h.diplomacy.getPendingProposal(G),null);
  for (const key of ['trust','fear','suspicion','hostility','affinity'] as const) assert.equal(after[key],before[key]);
  assert.equal(h.gold(S),8000); assert.equal(h.gold(G),20000); assert.equal(h.events.filter(e=>e.kind==='activated').length,1);
});
for (const [label,host,vassal,replaced,removed] of [
  ['internal',G,S,false,true], ['outgoing external',G,F,false,false], ['incoming external',F,G,false,false], ['former member',G,S,true,false],
] as const) test(`vassal cleanup: ${label}`,()=>{
  const h=harness(); h.diplomacy.establishVassal(vassal,host); if(replaced) setActiveLeaderForNation(G,'hermann-the-cheruscan');
  h.attack(); assert.equal(h.diplomacy.getVassalHost(vassal),removed?undefined:host);
});
test('initial contributions use shared percentage, conserve Gold and never charge the defended member',()=>{
  const h=harness(); const before=h.total(); h.attack();
  assert.equal(h.gold(S),8000); assert.equal(h.gold(G),20000); assert.equal(h.gold(U),7100); assert.equal(h.total(),before);
  assert.deepEqual(h.system.getCrises()[0].initialContributors,[P,M]);
});
test('duplicate declaration and refresh cannot repeat the initial contribution',()=>{
  const h=harness(); h.attack(); const before=members.map(n=>h.gold(n.id)); assert.equal(h.attack(),false);
  h.system.refresh(); h.system.refresh(); assert.deepEqual(members.map(n=>h.gold(n.id)),before);
});
test('reserve transfers floor fractions, clamp available balance, and safely ignore invalid balances',()=>{
  const h=harness(); h.resources.setGold(S,101.75); h.resources.setGold(G,0); h.attack(); assert.equal(h.gold(S),81.75); assert.equal(h.gold(U),120);
  assert.equal(h.resources.transferGold(S,U,100000),81); assert.equal(h.gold(S),0.75);
  assert.equal(h.resources.transferGold(S,S,100),0); assert.equal(h.resources.transferGold(S,U,NaN),0);
  h.resources.setGold(S,-2); assert.equal(h.resources.transferGold(S,U,100),0); assert.equal(h.gold(S),-2);
});
test('positive normal income transfers exactly once per donor turn, conserving Gold',()=>{
  const h=harness(); h.attack(); const before=h.total(); h.system.settleIncome(S,2); h.system.settleIncome(G,2);
  assert.equal(h.gold(S),7980); assert.equal(h.gold(G),19950); assert.equal(h.gold(U),7170); assert.equal(h.total(),before);
  h.system.settleIncome(S,2); assert.equal(h.gold(S),7980); assert.deepEqual(h.system.getGoldBreakdown(U),{outgoing:0,incoming:70});
  assert.equal(h.nations.getResources(S).goldPerTurn,100); assert.equal(h.nations.getResources(S).effectiveGoldPerTurn,80);
});
for (const value of [0,-50]) test(`nonpositive normal Gold/turn ${value} contributes nothing`,()=>{
  const h=harness(); h.income[S]=value; h.attack(); const before=h.gold(S); h.system.settleIncome(S,2); assert.equal(h.gold(S),before); assert.equal(h.system.getGoldBreakdown(S).outgoing,0);
});
test('canonical income turn credits normal income then transfers support, recipient turn never credits it again',()=>{
  const h=harness(); h.turns.start(); h.attack(); const before=h.total();
  // Russia (initial skipped income), Ukraine, Sweden, Germany, France, Russia.
  for(let i=0;i<5;i++) h.turns.endCurrentTurn();
  assert.equal(h.gold(S),8080); assert.equal(h.gold(G),20200); assert.equal(h.gold(U),7170);
  assert.equal(h.total(),before+450);
});
for (const [description,from,to] of [['voluntary declaration',S,R],['antagonist attacks supporter',R,S]] as const) test(`military fulfillment: ${description}`,()=>{
  const h=harness(); h.attack(); const swedishGold=h.gold(S); h.diplomacy.forceDeclareWar(from,to);
  const c=h.system.getCrises()[0]; assert.equal(c.defendedNationId,U); assert.deepEqual(c.fulfilledByWarLeaderIds,[P]); assert.equal(h.system.getCrises().length,1);
  assert.equal(h.system.getGoldBreakdown(S).outgoing,0); assert.equal(h.system.getGoldBreakdown(G).outgoing,50);
  h.system.settleIncome(S,2); assert.equal(h.gold(S),swedishGold); assert.equal(h.events.filter(e=>e.kind==='activated').length,1);
});
test('a member already fighting the antagonist at activation fulfills militarily and never pays',()=>{
  const h=harness(); h.diplomacy.forceDeclareWar(S,R); h.attack(); assert.equal(h.gold(S),10000); assert.deepEqual(h.system.getCrises()[0].fulfilledByWarLeaderIds,[P]);
});
test('canonical vassal and nuclear-response war entry fulfill obligations without automatic Mutual Foe war entry',()=>{
  const h=harness(); h.attack(); assert.equal(h.diplomacy.getState(S,R),'PEACE');
  h.diplomacy.establishVassal(S,F); h.diplomacy.forceDeclareWar(F,R); assert.equal(h.diplomacy.joinWarForHost(S,F,R),true);
  h.diplomacy.joinCollectiveNuclearResponse(G,R,U);
  assert.deepEqual(h.system.getCrises()[0].fulfilledByWarLeaderIds,[P,M]);
});
test('separate peace, reattack, leader replacement/return do not undo fulfilledByWar or create another recipient',()=>{
  const h=harness(); h.attack(); h.diplomacy.forceDeclareWar(S,R); h.diplomacy.reconcileWar(S,R);
  setActiveLeaderForNation(S,'leader_gustav_vasa'); setActiveLeaderForNation(S,P);
  assert.equal(h.system.getGoldBreakdown(S).outgoing,0); h.diplomacy.forceDeclareWar(R,S);
  assert.equal(h.system.getCrises().length,1); assert.equal(h.system.getCrises()[0].defendedNationId,U); assert.deepEqual(h.system.getCrises()[0].fulfilledByWarLeaderIds,[P]);
});
test('triggering peace ends crisis despite unrelated wars; future attack resets all fulfillment',()=>{
  const h=harness(); h.attack(); h.diplomacy.forceDeclareWar(S,R); h.diplomacy.forceDeclareWar(U,F);
  h.diplomacy.reconcileWar(R,U); assert.equal(h.system.getCrises().length,0); assert.equal(h.system.getGoldBreakdown(G).outgoing,0);
  h.diplomacy.reconcileWar(R,S); h.diplomacy.forceDeclareWar(R,S);
  assert.equal(h.system.getCrises()[0].defendedNationId,S); assert.deepEqual(h.system.getCrises()[0].fulfilledByWarLeaderIds,[]);
});
test('defended government replacement ends crisis while war continues, without mutating definitions',()=>{
  const h=harness(); h.attack(); setActiveLeaderForNation(U,'leader_petro_poroshenko');
  assert.equal(h.diplomacy.getState(R,U),'WAR'); assert.equal(h.system.getCrises().length,0); assert.deepEqual(h.system.getDefinitions(),[agreement]);
  setActiveLeaderForNation(U,Z); assert.equal(h.system.getCrises().length,0);
});
test('eliminated supporter ceases payment safely; eliminated defended nation ends crisis',()=>{
  const h=harness(); h.attack(); h.nations.removeNation(S); h.system.settleIncome(S,2); assert.equal(h.system.getGoldBreakdown(U).incoming,50);
  h.nations.removeNation(U); assert.equal(h.system.getCrises().length,0);
});
test('runtime restoration is quiet and preserves payments and fulfillment after separate peace',()=>{
  const h=harness(); h.attack(); h.system.settleIncome(G,2); h.diplomacy.forceDeclareWar(S,R); h.diplomacy.reconcileWar(S,R);
  const saved=JSON.parse(JSON.stringify(h.system.serialize())); const gold=members.map(n=>h.gold(n.id)); const events=h.events.length;
  h.system.restore(saved); assert.deepEqual(h.system.serialize(),saved); assert.equal(h.events.length,events); assert.deepEqual(members.map(n=>h.gold(n.id)),gold);
  h.system.settleIncome(G,2); assert.deepEqual(members.map(n=>h.gold(n.id)),gold); assert.equal(h.system.getGoldBreakdown(S).outgoing,0);
  setActiveLeaderForNation(G,'hermann-the-cheruscan'); h.system.restore(saved); assert.equal(h.system.getGoldBreakdown(G).outgoing,0);
});
test('full canonical save/apply persists configuration, crisis history, treasuries and fulfilled status',()=>{
  const h=harness(); h.attack(); h.diplomacy.forceDeclareWar(S,R); h.diplomacy.reconcileWar(S,R);
  const context=h.saveContext(); const saved=SaveLoadService.serialize(context); const balances=members.map(n=>h.gold(n.id));
  assert.deepEqual(saved.mutualFoeAgreements,[agreement]); assert.deepEqual(saved.leaderSelections,getActiveLeaderSelections());
  h.system.restore(undefined); SaveLoadService.apply(JSON.parse(JSON.stringify(saved)),context);
  assert.deepEqual(h.system.serialize(),saved.mutualFoeCrises); assert.deepEqual(members.map(n=>h.gold(n.id)),balances);
  assert.equal(h.system.getGoldBreakdown(S).outgoing,0);
});
test('missing or malformed runtime state is empty and never activates a pre-existing war',()=>{
  const h=harness([agreement],[[R,U]]); assert.equal(h.system.getCrises().length,0);
  for(const state of [undefined,null,{},[{},null]]) { h.system.restore(state); assert.equal(h.system.getCrises().length,0); }
  const context=h.saveContext(); const saved=SaveLoadService.serialize(context); delete saved.mutualFoeCrises; delete saved.mutualFoeAgreements;
  SaveLoadService.apply(saved,context); assert.equal(h.system.getCrises().length,0);
});
test('shutdown/restart/scenario switch clear runtime and detach canonical global leader listeners',()=>{
  const h=harness(); h.attack(); const count=h.events.length; h.system.shutdown();
  setActiveLeaderForNation(U,'leader_petro_poroshenko'); assert.equal(h.events.length,count); assert.equal(h.system.getCrises().length,0);
  assert.equal(h.nations.getResources(G).mutualFoeGoldOutgoingPerTurn,0);
  const next=harness([]); next.attack(); assert.equal(next.system.getCrises().length,0);
});
test('multiple independently authored agreements use unmodified income, including incoming aid and aggregate limits',()=>{
  const second: MutualFoeAgreement={...agreement,id:'second',antagonistNationId:F,memberLeaderIds:[P,M],supportPercent:20};
  const h=harness([agreement,second]); h.attack(); h.diplomacy.forceDeclareWar(F,S);
  assert.equal(h.system.getCrises().length,2);
  // Sweden receives 50 from Germany but still contributes 20, calculated from its own 100.
  assert.deepEqual(h.system.getGoldBreakdown(S),{incoming:50,outgoing:20}); assert.equal(h.system.getGoldBreakdown(G).outgoing,100);
  const before=h.total(); h.system.settleIncome(G,2); h.system.settleIncome(S,2); assert.equal(h.total(),before);
});
test('separately authored simultaneous triggers remain independent and cannot overdraw positive income',()=>{
  const h=harness([{...agreement,supportPercent:80},{...agreement,id:'second',supportPercent:80}]); h.attack();
  assert.equal(h.system.getCrises().length,2); assert.equal(h.system.getGoldBreakdown(S).outgoing,100); assert.equal(h.system.getGoldBreakdown(G).outgoing,250);
  const before=h.total(); h.system.settleIncome(S,2); assert.equal(h.total(),before); assert.ok(h.gold(S)>=0);
});
test('activation produces one newspaper candidate and concise logs, no per-turn article spam',()=>{
  const h=harness(); h.attack(); h.system.settleIncome(S,2); h.system.settleIncome(G,2);
  assert.equal(h.events.length,1); assert.equal(h.events[0].kind,'activated'); assert.ok(NEWSPAPER_EVENT_DEFINITIONS.mutualFoeActivated);
  assert.ok(h.logs.every(l=>l.startsWith('[MutualFoe]'))); assert.ok(h.logs.some(l=>l.includes('gold=2000')));
});

function scenario(definitions?: unknown): ScenarioData {
  return { meta:{name:'Mutual Foe Test'}, map:{width:1,height:1,tileSize:32,tiles:[]}, nations: members.map(n=>({...n,color:'#abcdef',isHuman:n.id===U,startTerritoryCenter:{q:0,r:0}})), cities:[],units:[],nationDetails:{},initialDiplomacy:[], ...(definitions===undefined?{}:{mutualFoeAgreements:definitions}) } as ScenarioData;
}
test('old scenarios load unchanged; new scenario configurations are normalized safely',()=>{
  assert.deepEqual(ScenarioLoader.parse(scenario()).mutualFoeAgreements,[]);
  assert.deepEqual(ScenarioLoader.parse(scenario([agreement])).mutualFoeAgreements,[agreement]);
});
for (const [label,patch] of [
  ['missing ID',{id:''}], ['missing name',{name:' '}], ['unknown antagonist',{antagonistNationId:'missing'}],
  ['one member',{memberLeaderIds:[M]}], ['duplicate leader',{memberLeaderIds:[M,M]}],
  ['duplicate nation',{memberLeaderIds:[M,'hermann-the-cheruscan']}], ['missing leader',{memberLeaderIds:[Z,'missing']}],
  ['non-scenario member',{memberLeaderIds:[Z,'leader_george_washington']}], ['antagonist member',{memberLeaderIds:[Z,'ivan-iv']}],
  ['NaN percentage',{supportPercent:NaN}], ['infinite percentage',{supportPercent:Infinity}], ['negative percentage',{supportPercent:-1}], ['excess percentage',{supportPercent:101}],
] as const) test(`configuration validation rejects ${label}`,()=>{
  const result=validateMutualFoeAgreements([{...agreement,...patch}],members); assert.equal(result.agreements.length,0); assert.ok(result.errors.length);
});
test('validation accepts 0 and 100, rejects duplicate agreement IDs, ignores malformed external objects',()=>{
  for(const supportPercent of [0,100]) assert.equal(validateMutualFoeAgreements([{...agreement,supportPercent}],members).errors.length,0);
  assert.equal(validateMutualFoeAgreements([agreement,agreement],members).agreements.length,1);
  assert.doesNotThrow(()=>ScenarioLoader.parse(scenario([null,{}, {...agreement,memberLeaderIds:[null,Z]}])));
});
test('editor creates, edits, deletes and roundtrips one shared percentage and stable ID',()=>{
  const draft=newMutualFoeAgreement([]); Object.assign(draft,{...agreement,id:draft.id});
  const created=saveMutualFoeAgreement([],draft,members); assert.equal(created.errors.length,0);
  const edited=saveMutualFoeAgreement(created.agreements,{...draft,name:'Updated name',supportPercent:37.5},members);
  assert.equal(edited.agreements[0].id,draft.id); assert.equal(edited.agreements[0].supportPercent,37.5);
  assert.deepEqual(ScenarioLoader.parse(scenario(JSON.parse(JSON.stringify(edited.agreements)))).mutualFoeAgreements,edited.agreements);
  assert.deepEqual(removeMutualFoeAgreement(edited.agreements,draft.id),[]);
  assert.notEqual(newMutualFoeAgreement(created.agreements).id,draft.id);
});
test('editor leader selector includes nation names, filters scenario nations and validates member additions/removals',()=>{
  const options=mutualFoeLeaderOptions(members); assert.ok(options.some(l=>l.label==='Angela Merkel — Germany'));
  assert.ok(options.every(l=>members.some(n=>n.id===l.nationId)));
  const edited=saveMutualFoeAgreement([agreement],{...agreement,memberLeaderIds:[Z,M]},members); assert.equal(edited.errors.length,0);
  assert.ok(saveMutualFoeAgreement([agreement],{...agreement,memberLeaderIds:[Z,M,M]},members).errors.length);
  assert.ok(ALL_LEADERS.length>options.length);
});


test('Overthrow Leadership changes membership through the canonical setter without any Mutual Foe coupling',()=>{
  const h=harness(); h.attack(); h.diplomacy.establishVassal(G,F);
  const capitulation=new CapitulationSystem({ diplomacyManager:h.diplomacy } as any);
  const result=capitulation.convertVassalageToOverthrow(F,G,'hermann-the-cheruscan');
  assert.ok(result); assert.equal(h.system.getGoldBreakdown(G).outgoing,0); assert.equal(h.gold(G),20000);
  assert.equal(h.diplomacy.getVassalHost(G),undefined);
});
test('canonical standard declaration activates, ordinary hostility alone does not',()=>{
  const h=harness(); h.diplomacy.setMemoryValues(R,U,{hostility:100}); assert.equal(h.system.getCrises().length,0);
  assert.equal(h.diplomacy.declareWar(R,U),true); assert.equal(h.system.getCrises().length,1);
});
test('a response to nuclear aggression is not mistaken for antagonist initiation',()=>{
  const h=harness(); h.diplomacy.forceDeclareWar(U,F);
  assert.equal(h.diplomacy.joinCollectiveNuclearResponse(R,U,F),true); assert.equal(h.system.getCrises().length,0);
});
test('load restores current leaders before crisis eligibility is evaluated',()=>{
  const h=harness(); h.attack(); const context=h.saveContext(); const saved=SaveLoadService.serialize(context);
  setActiveLeaderForNation(U,'leader_petro_poroshenko'); assert.equal(h.system.getCrises().length,0);
  SaveLoadService.apply(saved,context); assert.equal(h.system.getCrises().length,1); assert.equal(h.system.getGoldBreakdown(G).outgoing,50);
});
test('restored supporter absence and antagonist replacement use canonical current leadership',()=>{
  const h=harness(); h.attack(); setActiveLeaderForNation(G,'hermann-the-cheruscan'); setActiveLeaderForNation(R,'ivan-iv');
  const context=h.saveContext(); const saved=SaveLoadService.serialize(context); SaveLoadService.apply(saved,context);
  assert.equal(h.system.getCrises().length,1); assert.equal(h.system.getGoldBreakdown(G).outgoing,0); assert.equal(h.system.getGoldBreakdown(S).outgoing,20);
});
test('eliminated supporter does not invalidate saved agreement configuration or remaining support',()=>{
  const h=harness(); h.attack(); h.nations.removeNation(S); const saved=h.system.serialize();
  const restored=new MutualFoeAgreementSystem(h.system.getDefinitions(),members,h.nations,h.diplomacy,{normalGoldPerTurn:id=>h.income[id],transferGold:()=>{throw Error('restore must not transfer');}},()=>{});
  runtimes.push(restored); restored.restore(saved); assert.equal(restored.getCrises().length,1); assert.equal(restored.getGoldBreakdown(G).outgoing,50);
});
test('foreign/invalid saved crises cannot introduce signatories or recipients',()=>{
  const h=harness(); h.attack(); const saved=h.system.serialize()[0];
  h.system.restore([{...saved,defendedNationId:F},{...saved,agreementId:'unknown'}, {...saved,antagonistNationId:F}]);
  assert.equal(h.system.getCrises().length,0);
});
test('zero percent agreement still reconciles members but transfers no money',()=>{
  const h=harness([{...agreement,supportPercent:0}]); h.diplomacy.forceDeclareWar(S,G); const before=h.total(); h.attack();
  assert.equal(h.diplomacy.getState(S,G),'PEACE'); assert.equal(h.gold(S),10000); assert.equal(h.total(),before); assert.equal(h.system.getGoldBreakdown(U).incoming,0);
});
test('100 percent cannot overdraw reserves or positive income, even when treasury is insufficient',()=>{
  const h=harness([{...agreement,supportPercent:100}]); h.attack(); assert.equal(h.gold(S),0);
  h.system.settleIncome(S,2); assert.equal(h.gold(S),0); h.resources.addGold(S,10); const before=h.total();
  h.system.settleIncome(S,3); assert.equal(h.gold(S),0); assert.equal(h.total(),before);
});
test('ending a crisis discards fulfilled history without ending unrelated wars',()=>{
  const h=harness(); h.attack(); h.diplomacy.forceDeclareWar(S,R); h.diplomacy.reconcileWar(R,U);
  assert.deepEqual(h.system.serialize(),[]); assert.equal(h.diplomacy.getState(S,R),'WAR');
});
test('restoring an earlier war identity cannot sustain a crisis in a different triggering war',()=>{
  const h=harness(); h.attack(); const saved=h.system.serialize();
  h.diplomacy.restoreState(R,U,{state:'WAR',lastWarDeclarationTurn:99}); h.system.restore(saved); assert.deepEqual(h.system.serialize(),[]);
});
test('editor antagonist changes are validated as nation IDs independently of current leader choices',()=>{
  const updated={...agreement,antagonistNationId:F}; const result=saveMutualFoeAgreement([agreement],updated,members);
  assert.equal(result.errors.length,0); assert.equal(result.agreements[0].antagonistNationId,F);
  assert.ok(saveMutualFoeAgreement([agreement],{...agreement,antagonistNationId:'leader_vladimir_putin'},members).errors.length);
});


test('reusing canonical war metadata never suppresses a genuinely new crisis',()=>{
  const h=harness(); const metadata={source:'scenarioHistoricalEvent' as const};
  h.diplomacy.forceDeclareWar(R,U,metadata); h.diplomacy.reconcileWar(R,U); h.diplomacy.forceDeclareWar(R,U,metadata);
  assert.equal(h.events.filter(e=>e.kind==='activated').length,2);
});
test('duplicate war event cannot recreate a crisis after the protected leader leaves and returns',()=>{
  const h=harness(); h.attack(); setActiveLeaderForNation(U,'leader_petro_poroshenko'); setActiveLeaderForNation(U,Z);
  for(const listener of (h.diplomacy as any).warDeclaredListeners) listener(R,U,{source:'standard'});
  assert.equal(h.system.getCrises().length,0); assert.equal(h.events.filter(e=>e.kind==='activated').length,1);
});
