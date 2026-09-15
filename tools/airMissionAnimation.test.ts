import assert from 'node:assert/strict';
import test from 'node:test';
import { ALL_UNIT_TYPES } from '../src/data/units';
import { AIRCRAFT_ANIMATIONS, AIR_SMOKE_MS, airDamageApplyMs, airPosition, airWeaponPosition, planAirAttack } from '../src/renderers/AirMissionAnimation';

const view = { x: 0, y: 0, width: 1280, height: 720 };
const target = { x: 640, y: 360 };
const aircraft = ALL_UNIT_TYPES.filter(type => type.aircraftRole);

test('each of the six aircraft has its own oriented artwork and animated engines', () => {
  assert.equal(aircraft.length, 6);
  assert.deepEqual(Object.keys(AIRCRAFT_ANIMATIONS).sort(), aircraft.map(type => type.id).sort());
  for (const type of aircraft) {
    const profile = AIRCRAFT_ANIMATIONS[type.id];
    assert.ok(profile.propellers.length + profile.exhausts.length > 0, type.id);
    for (const anchor of [...profile.propellers, ...profile.exhausts]) {
      assert.ok(anchor.x > 0 && anchor.x < 1 && anchor.y > 0 && anchor.y < 1);
    }
  }
});

for (const type of aircraft) {
  test(`${type.name} enters diagonally, crosses the target and exits the viewport`, () => {
    const plan = planAirAttack(target, type.aircraftRole!, false, view);
    assert.ok(plan.start.x > target.x && plan.start.y < target.y);
    assert.ok(plan.start.x > view.width || plan.start.y < 0);
    assert.ok(plan.end.x < target.x && plan.end.y > target.y);
    assert.ok(plan.end.x < 0 || plan.end.y > view.height);
    const pass = airPosition(plan, plan.passMs);
    assert.ok(Math.abs(pass.x - target.x) < 1e-8);
    assert.ok(Math.abs(pass.y + plan.altitude - target.y) < 1e-8);
    for (const weapon of plan.weapons) {
      assert.deepEqual(airWeaponPosition(weapon, weapon.releaseMs), weapon.origin);
      assert.deepEqual(airWeaponPosition(weapon, weapon.impactMs), weapon.target);
      assert.ok(plan.endMs >= weapon.impactMs + AIR_SMOKE_MS);
      if (type.aircraftRole === 'fighter') {
        assert.equal(weapon.kind, 'missile');
        assert.ok(Math.hypot(weapon.origin.x - target.x, weapon.origin.y - target.y) > 100);
        assert.ok(weapon.releaseMs < plan.passMs - 300);
        assert.ok(Math.abs(weapon.impactMs - plan.passMs) <= 30);
      } else {
        assert.equal(weapon.kind, 'bomb');
        assert.ok(Math.abs(weapon.origin.x - target.x) < 35);
        assert.ok(weapon.origin.y < target.y);
        assert.ok(weapon.impactMs > plan.passMs + 300);
        const half = airWeaponPosition(weapon, (weapon.releaseMs + weapon.impactMs) / 2);
        assert.ok(half.y < (weapon.origin.y + weapon.target.y) / 2, 'bomb accelerates downward');
      }
    }
  });
  test(`${type.name} interception schedules no weapons or explosions`, () => {
    const plan = planAirAttack(target, type.aircraftRole!, true, view);
    assert.deepEqual(plan.weapons, []);
    assert.equal(plan.endMs, plan.flightMs);
  });
}

test('edge targets and zoomed-out views leave enough approach time for weapon release', () => {
  for (const width of [640, 1280, 5120]) for (const x of [1, width / 2, width - 1]) for (const y of [1, 359, 719]) {
    const plan = planAirAttack({ x, y }, 'fighter', false, { ...view, width });
    assert.ok(plan.weapons.every(weapon => weapon.releaseMs >= 0 && weapon.releaseMs < weapon.impactMs));
    assert.ok(plan.start.x > width || plan.start.y < 0);
    assert.ok(plan.end.x < 0 || plan.end.y > 720);
  }
});

test('damage appears after the final explosion flash, independently of aircraft departure', () => {
  for (const type of aircraft) {
    const plan = planAirAttack(target, type.aircraftRole!, false, view);
    const finalImpact = Math.max(...plan.weapons.map(weapon => weapon.impactMs));
    assert.equal(airDamageApplyMs(plan), finalImpact + 420);
    assert.ok(airDamageApplyMs(plan) < plan.endMs);
  }
});
