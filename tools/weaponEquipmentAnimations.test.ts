import assert from 'node:assert/strict';
import test from 'node:test';
import { ambientMotion, AMBIENT_PROFILES } from '../src/systems/rendering/AmbientProfiles';
import { burstAge, BURST_COUNT, BURST_INTERVAL, WEAPON_PERIOD, WEAPON_RELEASE } from '../src/systems/rendering/FootSoldierProfiles';
import { WEAPON_EQUIPMENT_PROFILES } from '../src/systems/rendering/WeaponEquipmentProfiles';

test('each machine gun round starts with recoil and recovers before the next shot',()=>{
  for(const seed of [0,.173,.82]) {
    const release=(1+WEAPON_RELEASE-seed)*WEAPON_PERIOD;
    assert.equal(burstAge(release-.01,seed),undefined);
    for(let round=0;round<BURST_COUNT;round++) {
      const t=release+round*BURST_INTERVAL;
      assert.ok(Math.abs(burstAge(t,seed)!)<1e-9);
      assert.ok(ambientMotion(t,seed,'burst')>.99);
      assert.equal(ambientMotion(t+.14,seed,'burst'),0);
    }
    assert.equal(burstAge(release+BURST_COUNT*BURST_INTERVAL,seed),undefined);
    assert.equal(ambientMotion(release+.9,seed,'burst'),0);
  }
});

test('vehicle and artillery barrels recoil opposite their shot direction',()=>{
  for(const id of ['cannon','anti_aircraft_gun','gatling_gun','landship','tank','modern_armor']) {
    const p=WEAPON_EQUIPMENT_PROFILES[id],shot=p.shots![0],part=p.parts![shot.part];
    assert.equal(AMBIENT_PROFILES.unit[id],p);
    const along=(part.dx??0)*shot.direction[0]+(part.dy??0)*shot.direction[1];
    assert.ok(along<-.02,`${id} must kick backward along the barrel`);
    assert.equal(part.angle,0,'keep gun aligned with its bore');
  }
  const wheels=WEAPON_EQUIPMENT_PROFILES.landship.parts!.filter(p=>p.spin);
  assert.equal(wheels.length,2);
  for(const wheel of wheels)assert.ok(wheel.spin!.aspect>0&&wheel.spin!.period>0);
  for(const id of ['tank','modern_armor'])for(const belt of WEAPON_EQUIPMENT_PROFILES[id].tracks!) {
    assert.ok(belt.links>=15&&belt.period>0);
    for(let i=0;i<belt.path.length;i++) {
      const p=belt.path[i],q=belt.path[(i+1)%belt.path.length];
      assert.ok(Math.hypot(p[0]-q[0],p[1]-q[1])>0,'no degenerate track segments');
    }
  }
});

test('catapult winds back, swings to release and recovers without a cycle jump',()=>{
  const motion=(phase:number)=>ambientMotion(phase*WEAPON_PERIOD,0,'throw');
  assert.ok(motion(.28)<0);
  assert.ok(motion(.40)>motion(.32));
  assert.ok(Math.abs(motion(WEAPON_RELEASE)-1)<1e-9);
  assert.ok(motion(.7)<motion(.57));
  assert.ok(Math.abs(motion(.99)-motion(0))<1e-9);
  const profile=AMBIENT_PROFILES.unit.catapult;
  assert.equal(profile.shots![0].kind,'stone');
  const arm=profile.parts![profile.shots![0].part];
  assert.ok(Math.abs(arm.angle)>.9,'arm must swing visibly through a large arc');
  for(const id of ['catapult','machine_gun']) {
    assert.equal(AMBIENT_PROFILES.unit[id].joints,undefined);
    assert.equal(AMBIENT_PROFILES.unit[id].float,undefined);
  }
});
