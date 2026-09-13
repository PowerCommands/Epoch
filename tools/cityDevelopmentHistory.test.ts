import assert from 'node:assert/strict';
import test from 'node:test';
import { City } from '../src/entities/City';
import { CityBuildings } from '../src/entities/CityBuildings';
import { getBuildingById } from '../src/data/buildings';
import { URBAN_SLOTS, getSettlementStage } from '../src/systems/UrbanDevelopment';
import { WorldHistoryMilestones } from '../src/systems/WorldHistoryMilestones';
import { HistoricalTimelineService } from '../src/systems/HistoricalTimelineService';
import { NewspaperSystem, getSelectionPriority } from '../src/systems/NewspaperSystem';

function city(id: string, ownerId='human', requirements: Array<string|null>=URBAN_SLOTS.map(s=>s.buildingId)) {
  return new City({id,name:id,ownerId,tileX:4,tileY:4,urbanDevelopment:{requirements,waterMask:0}});
}
function complete(c: City, b: CityBuildings, milestones: WorldHistoryMilestones, id: string) {
  const before=getSettlementStage(b,c);
  b.add(getBuildingById(id)!);
  milestones.developedCity(c,b,before);
}
function harness() {
  const history=new HistoricalTimelineService(()=>2,()=> '2000 BC',id=>id==='human'?'England':'France');
  const milestones=new WorldHistoryMilestones(history);
  milestones.initialize(undefined,[],'ancient');
  return {history,milestones};
}

test('only sixth requirement records City history, and the first worldwide is bigger news',()=>{
  const {history,milestones}=harness();
  for(const [id,owner] of [['London','human'],['Paris','ai']]) {
    const c=city(id,owner),b=new CityBuildings(id),beforeCount=history.getEvents().length;
    for(const slot of URBAN_SLOTS.slice(0,5))complete(c,b,milestones,slot.buildingId);
    assert.equal(history.getEvents().length,beforeCount);
    complete(c,b,milestones,URBAN_SLOTS[5].buildingId);
    const event=history.getEvents().at(-1)!;
    assert.equal(event.type,'cityDeveloped');assert.equal(event.metadata?.cityId,id);
    assert.deepEqual(event.eventNationIds,[owner]);assert.equal(event.round,2);
    assert.equal(event.metadata?.firstCity,id==='London');
    complete(c,b,milestones,'library');
    assert.equal(history.getEvents().length,beforeCount+1);
    b.remove('sewers');complete(c,b,milestones,'sewers');
    b.setBroken('forge',true);b.setBroken('forge',false);milestones.developedCity(c,b,'City');
    c.ownerId='captor';milestones.developedCity(c,b,'Village');
    assert.equal(history.getEvents().length,beforeCount+1);
  }
  const events=history.getEvents();
  assert.equal(getSelectionPriority(events[0]),100);assert.equal(getSelectionPriority(events[1]),60);
  const paper=NewspaperSystem.forNewGame({humanNationId:'human',getTimelineEvents:()=>events,
    getDominationRanking:()=>['human','ai'],getNationName:id=>id,getLeaderName:id=>id,getWorldEra:()=> 'ancient',seed:'city-news'});
  const issue=paper.consumeDueIssue(11,'1000 BC')!;
  assert.equal(issue.mainArticle.eventType,'cityDeveloped');
  assert.match(issue.mainArticle.headline,/WORLD'S FIRST CITY: LONDON/);
  assert.ok(issue.secondaryArticles.some(a=>a.headline==='PARIS BECOMES A CITY'));
});

test('save/load retains the first-City fact and suppresses duplicate announcements',()=>{
  const {history,milestones}=harness(),c=city('London'),b=new CityBuildings(c.id);
  for(const slot of URBAN_SLOTS)complete(c,b,milestones,slot.buildingId);
  const saved=JSON.parse(JSON.stringify({events:history.serialize(),milestones:milestones.getState()}));
  for(const state of [saved.milestones,undefined]) {
    const restored=new HistoricalTimelineService(()=>3,()=> '1900 BC');restored.restore(saved.events);
    const next=new WorldHistoryMilestones(restored);next.initialize(state,[],'ancient');
    next.developedCity(c,b,'Village');assert.equal(restored.getEvents().length,1);
    const second=city('Paris','ai'),buildings=new CityBuildings(second.id);
    for(const slot of URBAN_SLOTS)complete(second,buildings,next,slot.buildingId);
    assert.equal(restored.getEvents().length,2);assert.equal(restored.getEvents()[1].metadata?.firstCity,false);
  }
});

test('scenario Cities seed the first fact without invented history; impossible sites never announce City',()=>{
  const {history,milestones}=harness();milestones.initialize(undefined,[],'ancient',['Existing City']);
  const impossible=city('Island','ai',URBAN_SLOTS.map(()=>null)),b=new CityBuildings(impossible.id);
  for(const slot of URBAN_SLOTS)complete(impossible,b,milestones,slot.buildingId);
  assert.equal(history.getEvents().length,0);
  const c=city('New City'),buildings=new CityBuildings(c.id);
  for(const slot of URBAN_SLOTS)complete(c,buildings,milestones,slot.buildingId);
  assert.equal(history.getEvents().length,1);assert.equal(history.getEvents()[0].metadata?.firstCity,false);
});
