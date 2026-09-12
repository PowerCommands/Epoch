import { resourceAnimalOffset } from '../src/systems/rendering/ResourceAnimalMotion';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { AMBIENT_PROFILES, ambientMotion, ambientSeed } from '../src/systems/rendering/AmbientProfiles';
import { FISH_SCHOOL_COUNT, fishSchoolPose } from '../src/systems/rendering/FishSchool';

test('school fish stay inside the tile and face their swimming direction', () => {
  for(let n=0;n<FISH_SCHOOL_COUNT;n++) for(let t=0;t<60;t+=.17) {
    const pose=fishSchoolPose(n,t,.31),next=fishSchoolPose(n,t+.001,.31);
    for(const dx of [-.5,.5]) for(const dy of [-.5,.5]) {
      const x=pose.x+pose.scale*(dx*Math.cos(pose.angle)-dy*Math.sin(pose.angle));
      const y=pose.y+pose.scale*(dx*Math.sin(pose.angle)+dy*Math.cos(pose.angle));
      assert.ok(x>=0&&x<=1&&y>=0&&y<=1,'fish quad stays within the resource bounds');
    }
    const heading=pose.angle-Math.PI/4;
    const velocity=Math.atan2(next.y-pose.y,next.x-pose.x);
    assert.ok(Math.cos(heading-velocity)>.99,'nose follows the orbit tangent');
  }
});

test('every shipped world sprite has an explicit animation or stillness decision', () => {
  for(const [kind,folder] of Object.entries({resource:'resources',improvement:'improvements',unit:'units',building:'buildings',wonder:'wonders',city:'cities'})) {
    const profiles=AMBIENT_PROFILES[kind as keyof typeof AMBIENT_PROFILES];
    const files=readdirSync(`public/assets/sprites/${folder}`).filter(f=>/\.(png|svg)$/.test(f)&&!f.includes('-broken'));
    for(const file of files) {
      const id=file.replace(/\.(png|svg)$/,'').replace(kind==='city'?/^city_/:/^$/,'');
      assert.ok(profiles[id],`${kind}/${id} needs an artwork review`);
    }
  }
});
test('all anchors and local displacements remain bounded', () => {
  for(const [kind, profiles] of Object.entries(AMBIENT_PROFILES))for(const [id, profile] of Object.entries(profiles)) {
    for(const e of profile.effects) {assert.ok(e.x>=0&&e.x<=1);assert.ok(e.y>=0&&e.y<=1);}
    const limit=.03;
    for(const joint of profile.joints??[]) {assert.ok(Math.abs(joint.dx)<=limit);assert.ok(Math.abs(joint.dy)<=limit);}
  }
});
test('organic idles have rests, independent phases and variation across cycles', () => {
  const values=Array.from({length:1000},(_,i)=>ambientMotion(i*.05,ambientSeed('cattle:20,3'),'idle'));
  assert.ok(values.filter(v=>v===0).length>500);
  assert.ok(values.some(v=>Math.abs(v)>.3));
  const phases=new Set(Array.from({length:100},(_,i)=>ambientSeed(`cattle:${i},3`)));
  assert.equal(phases.size,100);
  assert.notDeepEqual(Array.from({length:100},(_,i)=>ambientMotion(i*.1,.1,'work')),Array.from({length:100},(_,i)=>ambientMotion(i*.1,.2,'work')));
  assert.equal(ambientSeed('stable'),ambientSeed('stable'));
});
test('landmarks and cities never receive whole-structure movement', () => {
  for(const kind of ['city','building','wonder'] as const)for(const p of Object.values(AMBIENT_PROFILES[kind])) {assert.equal(p.joints,undefined);assert.equal(p.float,undefined);}
  for(const [id,p] of Object.entries(AMBIENT_PROFILES.wonder)) {
    assert.ok(p.effects.length,`${id} needs a signature`);
    if(id!=='hanging_gardens')assert.equal(p.joints,undefined);
  }
  for(const id of ['stone'])assert.equal(AMBIENT_PROFILES.resource[id].effects.length,0);
});
test('ambient source never uses the simulation clock, global random or save state', () => {
  const source=readFileSync('src/systems/rendering/AmbientSprites.ts','utf8')+readFileSync('src/systems/rendering/AmbientProfiles.ts','utf8');
  assert.doesNotMatch(source,/Math\.random|Phaser\.Math\.RND|SaveGame|TurnSystem|setInterval|setTimeout/);
});

test('worker articulation and machinery preserve fixed structures', () => {
  const worker=AMBIENT_PROFILES.unit.worker;
  assert.equal(worker.joints,undefined);
  assert.equal(worker.parts?.length,3);
  assert.ok(worker.parts![0].feature.includes('pickaxe'));
  for(const part of worker.parts!.slice(1))assert.ok(part.link,'arm bones must follow the tool grip');
  assert.equal(AMBIENT_PROFILES.resource.cattle.joints,undefined);
  assert.equal(AMBIENT_PROFILES.resource.cattle.animal,'cattle');
  assert.ok(AMBIENT_PROFILES.resource.cattle.effects.some(e=>e.kind==='cowbell'));
  assert.equal(AMBIENT_PROFILES.improvement.oil_well.joints,undefined);
  assert.ok(AMBIENT_PROFILES.improvement.oil_well.parts?.[0].feature.includes('beam'));
  for(const id of ['trireme','battleship','work_boat','carrier']) {
    assert.equal(AMBIENT_PROFILES.unit[id].joints,undefined,`${id} must not bend its hull`);
    assert.ok(AMBIENT_PROFILES.unit[id].float);
  }
  assert.equal(AMBIENT_PROFILES.improvement.fishing_boats.parts?.length,2);
});
test('cutout masks and linked bones have valid image-space metadata', () => {
  for(const profiles of Object.values(AMBIENT_PROFILES))for(const p of Object.values(profiles))for(const [i,part] of (p.parts??[]).entries()) {
    assert.ok(part.feature.length>10);
    assert.ok(part.polygon.length>=3);
    for(const point of [...part.polygon,part.pivot])for(const n of point)assert.ok(n>=0&&n<=1);
    if(part.link){assert.ok(part.link.part<i);assert.ok(part.link.bone===0||part.link.bone===1);}
  }
});
test('fire and stillness decisions follow visible artwork', () => {
  const flames=AMBIENT_PROFILES.building.temple.effects.filter(e=>e.kind==='fire');
  assert.equal(flames.length,3);
  assert.ok(flames.some(e=>Math.abs(e.x-.503)<.01&&Math.abs(e.y-.533)<.01));
  for(const id of ['oracle','forbidden-city'])assert.ok(!AMBIENT_PROFILES.wonder[id].effects.some(e=>e.kind==='fire'||e.kind==='smoke'));
  for(const id of ['worker_action','worker_action_improvement','workboat_action'])assert.equal(AMBIENT_PROFILES.unit[id].effects.length,0);
  const audit=readFileSync('docs/ambient-art-review.md','utf8');
  for(const profiles of Object.values(AMBIENT_PROFILES))for(const id of Object.keys(profiles))assert.ok(audit.includes(`| ${id} |`),`${id} needs a recorded artwork decision`);
});

test('resource animals move continuously and return without drifting', () => {
  for(const [kind,period] of [['horses',.8],['cattle',1.6],['deer',3.2],['crabs',3.2],['sheep',9.6]] as const) {
    const start=resourceAnimalOffset(kind,.43,.70,.17,.3);
    const end=resourceAnimalOffset(kind,.43,.70,.17+period,.3);
    assert.ok(Math.abs(start[0]-end[0])<1e-8&&Math.abs(start[1]-end[1])<1e-8,kind);
    const samples=Array.from({length:12},(_,i)=>resourceAnimalOffset(kind,.43,.70,.17+i*period/12,.3));
    assert.ok(samples.some(next=>Math.hypot(next[0]-start[0],next[1]-start[1])>.005),kind);
  }
});
