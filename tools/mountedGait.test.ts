import assert from 'node:assert/strict';
import test from 'node:test';
import { RIDING_GAIT, mountedOffset } from '../src/systems/rendering/MountedGait';
import { AMBIENT_PROFILES } from '../src/systems/rendering/AmbientProfiles';

test('mounted gait keeps the texture connected through a full stride',()=>{
  const grid=32;
  for(let frame=0;frame<40;frame++) {
    const at=(x:number,y:number)=>{
      const u=x/grid,v=y/grid,[dx,dy]=mountedOffset(u,v,frame/40*RIDING_GAIT.period,0,RIDING_GAIT);
      assert.ok(Math.abs(dx)<.065&&Math.abs(dy)<.055);
      return [u+dx,v+dy];
    };
    const area=(a:number[],b:number[],c:number[])=>(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);
    for(let y=0;y<grid;y++)for(let x=0;x<grid;x++) {
      const a=at(x,y),b=at(x+1,y),c=at(x,y+1),d=at(x+1,y+1);
      assert.ok(area(a,b,c)>0,'no folded or inverted mesh triangles');
      assert.ok(area(b,d,c)>0,'no folded or inverted mesh triangles');
    }
  }
});
test('horse legs take visible opposing strides while rider stays with the saddle',()=>{
  const t=RIDING_GAIT.period/4;
  const front=mountedOffset(.45,.91,t,0,RIDING_GAIT);
  const back=mountedOffset(.67,.78,t,0,RIDING_GAIT);
  assert.ok(front[0]>.045&&back[0]<-.04);
  const torso=mountedOffset(.55,.45,0,0,RIDING_GAIT);
  const shoulder=mountedOffset(.55,.28,0,0,RIDING_GAIT);
  assert.ok(Math.abs(torso[1]-shoulder[1])<.01);
  for(const id of ['horseman','knight']) assert.equal(AMBIENT_PROFILES.unit[id].gait,RIDING_GAIT);
  assert.equal(AMBIENT_PROFILES.unit.cavalry.gait,undefined);
});
