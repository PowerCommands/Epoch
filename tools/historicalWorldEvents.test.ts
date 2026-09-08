import assert from 'node:assert/strict';
import test from 'node:test';
import { HistoricalWorldEvents, ENERGY_RESOURCE_IDS, type HistoricalWorldEventContext } from '../src/systems/HistoricalWorldEvents';
import { historicalPopulation, cancelHistoricalTrade, cancelHistoricalBorders } from '../src/systems/HistoricalWorldEventAdapters';
import { ScenarioHistoricalEventSystem } from '../src/systems/ScenarioHistoricalEventSystem';
import { CityManager } from '../src/systems/CityManager';
import { NationManager } from '../src/systems/NationManager';
import { TurnManager } from '../src/systems/TurnManager';
import { CurrencySystem } from '../src/systems/CurrencySystem';
import { ResearchSystem } from '../src/systems/ResearchSystem';
import { DiplomacyManager } from '../src/systems/DiplomacyManager';
import { TradeDealSystem } from '../src/systems/TradeDealSystem';
import { AllianceManager } from '../src/systems/diplomacy/AllianceManager';
import { HappinessSystem } from '../src/systems/HappinessSystem';
import { Nation } from '../src/entities/Nation';
import { City } from '../src/entities/City';
import { getNaturalResourceById } from '../src/data/naturalResources';
import { createGameDate } from '../src/systems/GameDate';
import type { CityEconomySummary } from '../src/systems/CityEconomy';
import type { ScenarioTimedHistoricalEvent, ScenarioWorldEventType } from '../src/types/scenario';

const ids = ['nation_england', 'nation_france', 'nation_sweden', 'nation_india'];
const date = createGameDate(2000, false, 0);
const event = (type: ScenarioWorldEventType, id: string = type, overrides: Partial<ScenarioTimedHistoricalEvent> = {}): ScenarioTimedHistoricalEvent => ({ id, type, name: type, description: '', startYear: 2000, startMonth: 1, ...overrides });
const economy = (food: number, consumption = 0) => ({ food, foodConsumption: consumption, netFood: food-consumption } as CityEconomySummary);
function harness() {
  const nations = new NationManager();
  const cities = new CityManager();
  ids.forEach((id, i) => {
    nations.addNation(new Nation({ id, name: id, color: 0, researchedTechIds: ['currency'] }));
    nations.getResources(id).gold = (i+1)*100;
    const city = new City({ id: `city${i}`, name: `City ${i}`, ownerId: id, tileX:i, tileY:0 });
    city.population = i+1; cities.addCity(city);
  });
  const turns = new TurnManager(nations, undefined, { name: 'test', version: 1, startYear: 2000, startYearIsBC: false, timeProgression: { mode: 'monthly' } });
  const diplomacy = new DiplomacyManager(turns);
  const trade = new TradeDealSystem(diplomacy, () => turns.getCurrentRound(), {
    getGold: id => nations.getResources(id).gold,
    addGold: (id, amount) => { nations.getResources(id).gold += amount; },
  });
  trade.setCanExportResource(() => true);
  const research = new ResearchSystem(nations,cities,() => 1);
  const currency = new CurrencySystem(nations, research, { getGoldIncome: id => nations.getResources(id).gold, getActiveTradePartnerIds: () => [], getCorporationCount: () => 0, getActiveBankCount: () => 0 });
  currency.initializeAfterLoad(1);
  let council = false;
  const articles: string[] = [], logs: string[] = [], emergencies: string[] = [];
  const scores: Record<string,number> = {};
  const context: HistoricalWorldEventContext = {
    seed:'world-test', nations: () => nations.getAllNations().map(n => n.id),
    strongestCurrencies: () => currency.getActiveCurrencies().map(c => c.nationId),
    population: id => historicalPopulation(cities,id),
    foodSituation: () => ({production:100, consumption:50}),
    embassy: (a,b) => diplomacy.hasEmbassy(a,b),
    cancelTrade: (targets, resources) => cancelHistoricalTrade(trade,targets,resources),
    cancelBorders: targets => cancelHistoricalBorders(diplomacy,ids,targets),
    councilExists: () => council,
    createEmergency: target => { emergencies.push(target); },
    awardScore: (id, score) => { scores[id] = (scores[id] ?? 0)+score; },
    chooseAid: () => 0,
    article: (e,p) => { articles.push(`${e.eventId}:${p}`); }, changed: () => {}, log: m => { logs.push(m); },
  };
  const world = new HistoricalWorldEvents(context);
  trade.setHistoricalProviders(id => world.priceMultiplier(id), (id,gold) => world.gold(id,gold));
  function deal(resourceId: string, seller = ids[0], buyer = ids[1]) {
    diplomacy.establishEmbassy(seller,buyer); diplomacy.establishEmbassy(buyer,seller);
    diplomacy.establishTradeRelations(seller,buyer);
    const result = trade.createDeal({ sellerNationId:seller, buyerNationId:buyer, resourceId, goldPerTurn:4, turns:25 });
    assert.equal(result.ok,true,result.reason); return result.deal!;
  }
  return {world, context, nations, cities, turns, diplomacy, trade, currency, deal, articles, logs, emergencies, scores, setCouncil:(value:boolean) => {council=value;} };
}

test('crash uses canonical strongest currencies, locks targets, preserves expenses and expires', () => {
  const h=harness(); const expected=h.currency.getActiveCurrencies().slice(0,2).map(c=>c.nationId);
  h.world.start(event('stockMarketCrash'),1,date);
  assert.deepEqual(h.world.getStates()[0].targets,expected);
  h.nations.getResources(ids[0]).gold=999999; h.currency.handleRoundStart(25);
  assert.deepEqual(h.world.getStates()[0].targets,expected);
  assert.equal(h.world.gold(expected[0],100)-80,-30);
  assert.equal(h.world.gold(expected[0],-80),-80);
  assert.equal(h.world.happiness(expected[0]),-20);
  h.world.endRound(24,date); assert.equal(h.world.gold(expected[0],100),50);
  h.world.endRound(25,date); assert.equal(h.world.gold(expected[0],100),100); assert.equal(h.world.happiness(expected[0]),0);
});

test('canonical happiness adds overlapping event modifiers and removes only expired instances', () => {
  const h=harness(); const id=ids[3];
  const happiness=new HappinessSystem(h.nations,h.cities); happiness.setHistoricalHappinessProvider(id=>h.world.happiness(id));
  happiness.recalculateNation(id); const base=happiness.getNetHappiness(id);
  h.world.start(event('stockMarketCrash','crash1',{duration:1}),1,date);
  h.world.start(event('stockMarketCrash','crash2',{duration:3}),1,date);
  h.world.start(event('famine'),1,date);
  happiness.recalculateNation(id); assert.equal(happiness.getNetHappiness(id),base-40);
  h.world.endRound(1,date); happiness.recalculateNation(id); assert.equal(happiness.getNetHappiness(id),base-20);
  h.world.endRound(3,date); happiness.recalculateNation(id); assert.equal(happiness.getNetHappiness(id),base);
});

test('famine sums all currently owned city populations and locks the largest nation', () => {
  const h=harness(); const c=new City({id:'extra',name:'extra',ownerId:ids[0],tileX:5,tileY:0}); c.population=5;h.cities.addCity(c);
  h.world.start(event('famine'),1,date); assert.deepEqual(h.world.getStates()[0].targets,[ids[0]]);
  c.population=1; h.cities.getCity('city3')!.population=100;
  const food=[economy(100,40)]; h.world.processFood(ids[0],food,1,true); assert.equal(food[0].food,50); assert.equal(food[0].netFood,10);
  assert.equal(h.emergencies.length,0);
  h.world.endRound(25,date); const after=[economy(100)]; h.world.processFood(ids[0],after,26,true); assert.equal(after[0].food,100);
  h.world.start(event('famine','second'),26,date); assert.deepEqual(h.world.getStates()[1].targets,[ids[3]]);
});

test('humanitarian aid debits real production, survives load in transit, and rewards proportionally once', () => {
  const h=harness();h.setCouncil(true); h.world.start(event('famine','aid',{duration:10}),1,date);
  assert.deepEqual(h.emergencies,[ids[3]]); assert.ok(h.articles.includes('aid:aid'));
  assert.equal(h.world.setDonation('aid',ids[0],10),true);
  const donor=[economy(60),economy(40)]; h.world.processFood(ids[0],donor,1,true);
  assert.equal(donor.reduce((sum,e)=>sum+e.food,0),90); assert.equal(h.scores[ids[0]],2);
  const saved=JSON.parse(JSON.stringify(h.world.serialize())); const restored=new HistoricalWorldEvents(h.context); restored.restore(saved);
  restored.processFood(ids[0],[economy(100)],1,true); assert.equal(h.scores[ids[0]],2);
  const recipient=[economy(100)]; restored.processFood(ids[3],recipient,1,true); assert.equal(recipient[0].food,60);
  assert.equal(donor.reduce((s,e)=>s+e.food,0)+recipient[0].food,150);
  const second=[economy(100)];restored.processFood(ids[3],second,1,true);assert.equal(second[0].food,50);
  assert.equal(restored.serialize().foodInTransit[ids[3]],0);
  restored.setDonation('aid',ids[0],0); restored.processFood(ids[0],[economy(100)],2,true); assert.equal(h.scores[ids[0]],2);
});

test('overlapping aid commitments cannot donate more than available production; previews never settle', () => {
  const h=harness();h.setCouncil(true); h.world.start(event('famine','a'),1,date);h.world.start(event('famine','b'),1,date);
  h.world.setDonation('a',ids[0],80);h.world.setDonation('b',ids[0],80);
  assert.equal(h.world.getStates()[1].emergency!.commitments[ids[0]],20);
  h.world.processFood(ids[0],[economy(100)],1,false); assert.deepEqual(h.world.serialize().foodInTransit,{});
  const food=[economy(100)]; h.world.processFood(ids[0],food,1,true); assert.equal(food[0].food,0);
  assert.equal(h.world.serialize().foodInTransit[ids[3]],100);
  h.setCouncil(false);const noAid=[economy(100)];h.world.processFood(ids[0],noAid,2,true);assert.equal(noAid[0].food,100);
});

test('pandemic selects reproducible origin and fixed embassy set; terminates trades and borders, preserves embassies', () => {
  const h=harness(), probe=harness();probe.world.start(event('pandemic'),1,date);
  const origin=probe.world.getStates()[0].origin!; const others=ids.filter(id=>id!==origin);
  h.diplomacy.establishEmbassy(origin,others[0]);
  h.diplomacy.toggleOpenBorders(origin,others[0]);h.diplomacy.toggleOpenBorders(others[0],origin);
  h.deal('coal',origin,others[0]); h.deal('wheat',others[1],others[2]);
  h.world.start(event('pandemic'),1,date);
  const state=h.world.getStates()[0]; assert.equal(state.origin,origin);assert.deepEqual(new Set(state.targets),new Set([origin,others[0]]));
  assert.equal(h.trade.getAllDeals().length,1);assert.equal(h.trade.getAllDeals()[0].resourceId,'wheat');
  assert.equal(h.diplomacy.isOpenBorderGrantedFrom(origin,others[0]),false);assert.equal(h.diplomacy.isOpenBorderGrantedFrom(others[0],origin),false);
  assert.equal(h.diplomacy.hasEmbassy(origin,others[0]),true);
  h.diplomacy.establishEmbassy(origin,others[1]); assert.equal(h.world.happiness(others[1]),0);
  const loaded=new HistoricalWorldEvents(h.context);loaded.restore(JSON.parse(JSON.stringify(h.world.serialize())));
  assert.deepEqual(loaded.getStates()[0].targets,state.targets);
  loaded.endRound(25,date);assert.equal(loaded.happiness(origin),0);assert.equal(h.trade.getAllDeals().length,1);assert.equal(h.diplomacy.isOpenBorderGrantedFrom(origin,others[0]),false);
});

test('energy crisis cancels exactly canonical energy contracts; completion compounds without changing definitions', () => {
  const h=harness(); const base=JSON.stringify(ENERGY_RESOURCE_IDS.map(getNaturalResourceById));
  // Use separate seller/buyer pairs to respect per-pair connection capacity.
  h.trade.setConnectionCapacityProvider(()=>10);
  for(const resource of ENERGY_RESOURCE_IDS) h.deal(resource);
  h.deal('wheat');h.world.start(event('energyCrisis','first',{duration:2}),1,date);
  assert.deepEqual(h.trade.getAllDeals().map(d=>d.resourceId),['wheat']);assert.equal(h.world.priceMultiplier('coal'),1);
  h.world.endRound(2,date);assert.equal(h.world.priceMultiplier('coal'),1.25);assert.equal(h.trade.effectivePrice('coal',100),125);
  h.world.start(event('energyCrisis','second',{duration:1}),3,date);h.world.endRound(3,date);
  for(const id of ENERGY_RESOURCE_IDS) assert.equal(h.world.priceMultiplier(id),1.5625);
  assert.equal(h.world.priceMultiplier('wheat'),1);assert.equal(JSON.stringify(ENERGY_RESOURCE_IDS.map(getNaturalResourceById)),base);
  const articles=h.articles.length;const loaded=new HistoricalWorldEvents(h.context);loaded.restore(JSON.parse(JSON.stringify(h.world.serialize())));
  loaded.start(event('energyCrisis','first'),4,date);loaded.endRound(50,date);
  assert.equal(loaded.priceMultiplier('oil'),1.5625);assert.equal(h.articles.length,articles);assert.equal(h.trade.getAllDeals().length,1);
});

test('no targets and elimination are safe; repeated failed instances do not restart', () => {
  const h=harness();h.context.nations=()=>[];h.context.strongestCurrencies=()=>[];
  for(const type of ['stockMarketCrash','famine','pandemic','energyCrisis'] as const) h.world.start(event(type),1,date);
  assert.equal(h.world.getStates().length,4);assert.ok(h.world.getStates().every(s=>s.status==='completed'));
  h.world.endRound(100,date);assert.equal(h.world.priceMultiplier('coal'),1);assert.equal(h.articles.length,0);
  assert.ok(h.logs.every(s=>s.startsWith('[HistoricalEvent]')));
});

test('scenario coordinator schedules overlapping world events without switching the World War calendar and saves lifecycle', () => {
  const h=harness();const definitions=[event('energyCrisis','e',{duration:2}),event('famine','f',{duration:3})];
  const runtime=new ScenarioHistoricalEventSystem(definitions,h.turns,h.diplomacy,new AllianceManager(),{world:h.context});
  h.turns.start(); assert.equal(runtime.hasTriggered('e'),true);assert.equal(runtime.hasActiveWorldWar(),false);
  assert.equal(runtime.getRuntimeStates().length,2);
  const saved=JSON.parse(JSON.stringify(runtime.serialize()));runtime.restore(saved);assert.equal(runtime.hasTriggered('e'),true);
  assert.equal(h.articles.filter(a=>a==='e:started').length,1);
  for(let i=0;i<ids.length*3;i++) h.turns.endCurrentTurn();
  assert.equal(runtime.worldEvents!.priceMultiplier('coal'),1.25);
  assert.equal(h.articles.filter(a=>a==='e:ended').length,1);
});

test('resource access loses energy imports while domestic sources remain usable', async () => {
  const { ResourceAccessSystem } = await import('../src/systems/ResourceAccessSystem');
  const { TileType } = await import('../src/types/map');
  const h=harness();h.trade.setConnectionCapacityProvider(()=>10);
  const map={width:4,height:1,tileSize:1,tiles:[ENERGY_RESOURCE_IDS.map((resourceId,x)=>({x,y:0,type:TileType.Plains,ownerId:ids[0],resourceId}))]};
  const access=new ResourceAccessSystem(map,h.trade);
  for(const id of ENERGY_RESOURCE_IDS) { h.deal(id); assert.equal(access.hasImportedResource(ids[1],id),true);assert.equal(access.hasOwnResource(ids[0],id),true); }
  h.world.start(event('energyCrisis'),1,date);
  for(const id of ENERGY_RESOURCE_IDS) { assert.equal(access.hasImportedResource(ids[1],id),false);assert.equal(access.hasOwnResource(ids[0],id),true); }
  h.world.endRound(25,date);
  for(const id of ENERGY_RESOURCE_IDS) assert.equal(access.hasImportedResource(ids[1],id),false);
});

test('normal ResourceSystem turn pipeline applies famine to buildings and maritime Food, settles aid before growth', async () => {
  const { ResourceSystem } = await import('../src/systems/ResourceSystem');
  const { TileResourceGenerator } = await import('../src/systems/ResourceGenerator');
  const { HexGridSystem } = await import('../src/systems/grid/HexGridSystem');
  const { GRANARY } = await import('../src/data/buildings');
  const { TileType } = await import('../src/types/map');
  const h=harness();
  const map={width:4,height:1,tileSize:1,tiles:[ids.map((ownerId,x)=>({x,y:0,type:TileType.Plains,ownerId}))]};
  const happiness=new HappinessSystem(h.nations,h.cities);
  const resources=new ResourceSystem(h.nations,h.cities,h.turns,new TileResourceGenerator(),map,new HexGridSystem(),happiness);
  resources.setMaritimeFoodProvider(id=>new Map(h.cities.getCitiesByOwner(id).map(c=>[c.id,10])));
  h.cities.getBuildings('city3').add(GRANARY);
  for(const id of ids) resources.recalculateForNation(id);
  h.setCouncil(true);h.world.start(event('famine'),1,date);h.world.setDonation('famine',ids[0],10);
  resources.setHistoricalProviders((id,value)=>h.world.gold(id,value),(id,e,r,c)=>h.world.processFood(id,e,r,c));
  h.turns.start();
  for(let i=0;i<ids.length;i++) h.turns.endCurrentTurn(); // donor's first producing turn, round 2
  const donorGross=resources.getNationalFoodProduction(ids[0]);
  assert.equal(h.cities.getResources('city0').foodPerTurn,donorGross*0.9);
  const sent=h.world.serialize().foodInTransit[ids[3]];
  assert.ok(Math.abs(sent-donorGross*0.1)<1e-9);
  for(let i=1;i<ids.length;i++) h.turns.endCurrentTurn();
  const gross=resources.getNationalFoodProduction(ids[3]);
  assert.equal(h.cities.getResources('city3').foodPerTurn,gross*0.5+sent);
  assert.equal(h.world.serialize().foodInTransit[ids[3]],0);
});

test('trade accounting reduces positive crash receipts without discounting import expenses', () => {
  const h=harness();h.context.strongestCurrencies=()=>[ids[0]];
  h.deal('wheat',ids[0],ids[1]);h.deal('coal',ids[2],ids[0]);
  h.world.start(event('stockMarketCrash'),1,date);
  assert.equal(h.trade.getGoldPerTurnDeltaForNation(ids[0]),-2);
  const buyerBefore=h.nations.getResources(ids[1]).gold,sellerBefore=h.nations.getResources(ids[0]).gold;
  h.trade.advanceTurnForNation(ids[1]);
  assert.equal(h.nations.getResources(ids[1]).gold,buyerBefore-4);
  assert.equal(h.nations.getResources(ids[0]).gold,sellerBefore+2);
});

test('overlapping pandemic and crash stack; active targets and article counts survive restored coordinator', () => {
  const h=harness();h.context.embassy=()=>true;
  const runtime=new ScenarioHistoricalEventSystem([event('pandemic'),event('stockMarketCrash')],h.turns,h.diplomacy,new AllianceManager(),{world:h.context});
  h.turns.start();assert.equal(runtime.worldEvents!.happiness(ids[3]),-40);
  const saved=JSON.parse(JSON.stringify(runtime.serialize())); const articleCount=h.articles.length;
  runtime.restore(saved);assert.equal(runtime.worldEvents!.happiness(ids[3]),-40);assert.equal(h.articles.length,articleCount);
  const states=runtime.worldEvents!.getStates();states[0].targets.length=0;
  assert.ok(runtime.worldEvents!.getStates()[0].targets.length>0,'external snapshots cannot mutate targets');
});

test('Council famine emergency and Food contribution score use canonical saved member state', async () => {
  const {WorldCouncilSystem}=await import('../src/systems/WorldCouncilSystem');
  const h=harness();
  const council=new WorldCouncilSystem(h.nations,h.cities,{addGold:()=>0} as never);
  assert.equal(council.found({foundingCityId:'city0',foundingNationId:ids[0],foundingTurn:1,founderOffer:{gold:0,sciencePercent:5,culturePercent:5}}),true);
  const initial=council.getState()!;
  council.restore({...initial,status:'active',constructionTurnsRemaining:0});
  const meeting=council.triggerEmergencyMeeting(2,{eventType:'famine',targetNationId:ids[3]});
  assert.equal(meeting?.emergencyTrigger?.eventType,'famine');
  assert.equal(meeting?.proposals,undefined,'Food emergency must not create unrelated war resolutions');
  const before=council.getDiplomaticScoreBreakdown(ids[0]).total;
  assert.equal(council.awardHumanitarianDiplomacyScore(ids[0],2),true);
  assert.equal(council.getDiplomaticScoreBreakdown(ids[0]).total,before+2);
  const saved=JSON.parse(JSON.stringify(council.getState()));council.restore(saved);
  assert.equal(council.getDiplomaticScoreBreakdown(ids[0]).total,before+2);
  assert.equal(council.awardHumanitarianDiplomacyScore('eliminated',2),false);
});

test('all four Chronicle definitions use dedicated existing PNGs and distinguish beginning, response and ending', async () => {
  const {NEWSPAPER_EVENT_DEFINITIONS}=await import('../src/data/newspaperContent');
  const {existsSync}=await import('node:fs');
  for(const type of ['stockMarketCrash','famine','pandemic','energyCrisis'] as const) {
    const definition=NEWSPAPER_EVENT_DEFINITIONS[type];assert.equal(definition.priority,100);
    assert.equal(existsSync(`public${definition.imagePath}`),true);
    for(const phase of ['started','ended','aid'] as const) {
      const context={event:{type,text:'History',metadata:{worldEventPhase:phase,scenarioHistoricalEventDescription:'Historical consequence'}},nationNames:[],leaderNames:[]} as never;
      assert.match(definition.buildHeadline(context),phase==='ended'?/ENDS/:phase==='aid'?/HUMANITARIAN RESPONSE/:/BEGINS/);
      assert.equal(definition.buildBody(context),'Historical consequence');
    }
  }
});

test('aid reward reaches configured maximum only for substantial cumulative Food; elimination stops new aid', () => {
  const h=harness();h.setCouncil(true);h.world.start(event('famine','scale',{duration:10,diplomaticScoreReward:100}),1,date);
  h.world.setDonation('scale',ids[0],1);h.world.processFood(ids[0],[economy(100)],1,true);
  assert.equal(h.scores[ids[0]] ?? 0,0);
  h.world.setDonation('scale',ids[0],100);
  for(let round=2;round<=6;round++) h.world.processFood(ids[0],[economy(100)],round,true);
  assert.equal(h.scores[ids[0]],100);
  h.context.nations=()=>ids.slice(0,3);
  const next=[economy(100)];h.world.processFood(ids[0],next,7,true);assert.equal(next[0].food,100);
  h.world.endRound(10,date);assert.equal(h.world.getStates()[0].status,'completed');
});
