/** Pure presentation geometry and timing, independent of combat state and Phaser. */
export interface AirPoint { x: number; y: number }
export interface AircraftAnimationProfile {
  size: number;
  /** Nose direction in the original artwork, clockwise from right. */
  heading: number;
  propellers: readonly AirPoint[];
  exhausts: readonly AirPoint[];
}

export const AIRCRAFT_ANIMATIONS: Readonly<Record<string, AircraftAnimationProfile>> = {
  triplane: { size: 68, heading: 90, propellers: [{ x: .50, y: .68 }], exhausts: [] },
  fighter: { size: 76, heading: 135, propellers: [{ x: .28, y: .47 }, { x: .57, y: .65 }], exhausts: [] },
  jet_fighter: { size: 80, heading: 90, propellers: [], exhausts: [{ x: .5, y: .22 }] },
  great_war_bomber: { size: 88, heading: 135, propellers: [{ x: .26, y: .53 }, { x: .53, y: .70 }], exhausts: [] },
  bomber: { size: 98, heading: 45, propellers: [{ x: .30, y: .75 }, { x: .51, y: .65 }, { x: .72, y: .41 }, { x: .83, y: .29 }], exhausts: [] },
  stealth_bomber: { size: 96, heading: 90, propellers: [], exhausts: [{ x: .40, y: .25 }, { x: .59, y: .25 }] },
};

export const AIR_SMOKE_MS = 1800;
export const AIR_DIRECTION = { x: -.8, y: .6 };
export const AIR_HEADING = Math.atan2(AIR_DIRECTION.y, AIR_DIRECTION.x);
export const clampAir = (n: number): number => Math.max(0, Math.min(1, n));
export const mixAir = (a: AirPoint, b: AirPoint, t: number): AirPoint => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export interface AirWeapon {
  kind: 'missile' | 'bomb';
  releaseMs: number;
  impactMs: number;
  origin: AirPoint;
  target: AirPoint;
}
export interface AirAttackPlan {
  start: AirPoint;
  end: AirPoint;
  altitude: number;
  passMs: number;
  flightMs: number;
  endMs: number;
  weapons: AirWeapon[];
}

export function airPosition(plan: AirAttackPlan, age: number): AirPoint {
  return mixAir(plan.start, plan.end, clampAir(age / plan.flightMs));
}

export function planAirAttack(target: AirPoint, role: 'fighter' | 'bomber', intercepted: boolean,
  view: { x: number; y: number; width: number; height: number }): AirAttackPlan {
  const altitude = 34;
  const overhead = { x: target.x, y: target.y - altitude };
  // Extend both ends beyond the viewport, regardless of the actual base position.
  const entry = Math.max(300, Math.min((view.x + view.width + 100 - overhead.x) / .8, (overhead.y - view.y + 100) / .6));
  const exit = Math.max(300, Math.min((overhead.x - view.x + 100) / .8, (view.y + view.height + 100 - overhead.y) / .6));
  const speed = Math.min(entry / .85, Math.max(260, (entry + exit) / 3.2));
  const plan: AirAttackPlan = {
    start: { x: overhead.x - AIR_DIRECTION.x * entry, y: overhead.y - AIR_DIRECTION.y * entry },
    end: { x: overhead.x + AIR_DIRECTION.x * exit, y: overhead.y + AIR_DIRECTION.y * exit },
    altitude, passMs: entry / speed * 1000, flightMs: (entry + exit) / speed * 1000,
    endMs: 0, weapons: [],
  };
  // An aborted mission cannot schedule weapons or impacts, even if the aircraft survives.
  if (!intercepted) {
    const count = role === 'fighter' ? 2 : 3;
    for (let i = 0; i < count; i++) {
      const releaseMs = plan.passMs + (role === 'fighter' ? -490 + i * 85 : (i - 1) * Math.min(100, 20 / speed * 1000));
      const origin = airPosition(plan, releaseMs);
      if (role === 'fighter') { origin.x += (i ? 1 : -1) * 9; origin.y += (i ? 1 : -1) * 12; }
      plan.weapons.push({ kind: role === 'fighter' ? 'missile' : 'bomb', releaseMs,
        impactMs: role === 'fighter' ? plan.passMs + (i - .5) * 50 : releaseMs + 470,
        origin, target: { x: target.x - (i - (count - 1) / 2) * 12, y: target.y + (i - (count - 1) / 2) * 5 } });
    }
  }
  plan.endMs = Math.max(plan.flightMs, ...plan.weapons.map(weapon => weapon.impactMs + AIR_SMOKE_MS));
  return plan;
}

export function airWeaponPosition(weapon: AirWeapon, age: number): AirPoint {
  const p = clampAir((age - weapon.releaseMs) / (weapon.impactMs - weapon.releaseMs));
  const point = mixAir(weapon.origin, weapon.target, p);
  // Bombs accelerate down from flight altitude; missiles take a direct powered path.
  if (weapon.kind === 'bomb') point.y = weapon.origin.y + (weapon.target.y - weapon.origin.y) * p * p;
  return point;
}

/** Apply damage after the final explosion flash (smoke may still linger). */
export function airDamageApplyMs(plan: AirAttackPlan): number {
  return plan.weapons.length ? Math.max(...plan.weapons.map(weapon => weapon.impactMs)) + 420 : plan.flightMs;
}
