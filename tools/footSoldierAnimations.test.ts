import assert from 'node:assert/strict';
import test from 'node:test';
import { FOOT_SOLDIER_PROFILES, weaponMotion, weaponPhase, WEAPON_PERIOD, WEAPON_RELEASE } from '../src/systems/rendering/FootSoldierProfiles';
import { AMBIENT_PROFILES, ambientMotion } from '../src/systems/rendering/AmbientProfiles';

test('armed foot units use recurring weapon gestures with visible displacement',()=>{
  assert.equal(Object.keys(FOOT_SOLDIER_PROFILES).length,21);
  for(const [id,p] of Object.entries(FOOT_SOLDIER_PROFILES)) {
    assert.equal(AMBIENT_PROFILES.unit[id],p);
    assert.ok(p.parts?.length);
    for(const part of p.parts!) {
      const positions=Array.from({length:80},(_,i)=>{
        const motion=ambientMotion(i/80*WEAPON_PERIOD,0,part.rhythm),angle=part.angle*motion;
        return part.polygon.map(([x,y])=>[
          part.pivot[0]+(x-part.pivot[0])*Math.cos(angle)-(y-part.pivot[1])*Math.sin(angle)+(part.dx??0)*motion,
          part.pivot[1]+(x-part.pivot[0])*Math.sin(angle)+(y-part.pivot[1])*Math.cos(angle)+(part.dy??0)*motion,
        ]);
      });
      let span=0;
      for(let i=0;i<part.polygon.length;i++) {
        const xs=positions.map(p=>p[i][0]),ys=positions.map(p=>p[i][1]);
        span=Math.max(span,Math.hypot(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys)));
      }
      assert.ok(span>.025,`${id} gesture must span more than 2.5% of sprite size`);
    }
  }
});
test('shots follow a real moving weapon and release at its strike/recoil phase',()=>{
  for(const p of Object.values(FOOT_SOLDIER_PROFILES))for(const shot of p.shots??[]) {
    const part=p.parts![shot.part];assert.ok(part);
    assert.ok(Math.abs(Math.hypot(...shot.direction)-1)<.04 || shot.kind==='arrow');
    for(const n of shot.muzzle)assert.ok(n>=0&&n<=1);
  }
  for(const seed of [0,.173,.82]) {
    const t=(1+WEAPON_RELEASE-seed)*WEAPON_PERIOD;
    assert.ok(Math.abs(weaponPhase(t,seed)-WEAPON_RELEASE)<1e-12);
    for(const rhythm of ['thrust','slash','draw','recoil'] as const) {
      assert.ok(weaponMotion(t,seed,rhythm)>.99,`${rhythm} peaks at release`);
      assert.ok(Math.abs(weaponMotion(t,seed,rhythm)-weaponMotion(t+WEAPON_PERIOD,seed,rhythm))<1e-12);
    }
  }
});
test('civilian, mounted and Scout Boat profiles retain their own animations',()=>{
  for(const id of ['scout','worker','settler','horseman','knight','cavalry','scout_boat'])assert.equal(FOOT_SOLDIER_PROFILES[id],undefined);
  assert.equal(AMBIENT_PROFILES.unit.scout_boat.parts![0].rhythm,'scan');
});
