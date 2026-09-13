import assert from 'node:assert/strict';
import test from 'node:test';
import { offshorePose, OFFSHORE_PERIOD } from '../src/systems/rendering/OffshorePlatformMotion';
import { AMBIENT_PROFILES } from '../src/systems/rendering/AmbientProfiles';
import { weaponMotion, WEAPON_PERIOD, WEAPON_RELEASE } from '../src/systems/rendering/FootSoldierProfiles';

test('crane slews counterclockwise and pays out a vertical cable before recovery', () => {
  const start = offshorePose(0, 0), slew = offshorePose(4, 0), lowered = offshorePose(6, 0);
  assert.ok(slew.angle < start.angle);
  assert.equal(lowered.angle, slew.angle);
  assert.ok(lowered.load[1] - lowered.tip[1] > start.load[1] - start.tip[1] + .14);
  for (let t = 0; t < OFFSHORE_PERIOD; t += .1) {
    const pose = offshorePose(t, 0);
    assert.ok(Math.abs(pose.load[0] - pose.tip[0]) < .002);
    assert.ok(pose.load[1] > pose.tip[1]);
  }
});

test('helicopter descends, rests on the helipad, departs and repeats without drift', () => {
  assert.ok(offshorePose(3, 0).flight[1] < 0);
  assert.deepEqual(offshorePose(6, 0).flight, [0, 0]);
  assert.equal(offshorePose(6, 0).landed, true);
  assert.ok(offshorePose(10, 0).flight[1] < 0);
  assert.equal(offshorePose(14, 0).helicopterVisible, false);
  for (const t of [0, 3, 6, 10, 14]) {
    const a = offshorePose(t, .25), b = offshorePose(t + OFFSHORE_PERIOD, .25);
    assert.deepEqual(a, b);
  }
});

test('spy pistol effects use the same release clock as the recoiling hand', () => {
  const spy = AMBIENT_PROFILES.unit.spy, shot = spy.shots![0], part = spy.parts![shot.part];
  assert.equal(shot.kind, 'pistol');
  assert.equal(part.rhythm, 'recoil');
  assert.equal(weaponMotion(WEAPON_PERIOD * WEAPON_RELEASE, 0, 'recoil'), 1);
  assert.equal(weaponMotion(WEAPON_PERIOD * .9, 0, 'recoil'), 0);
});
