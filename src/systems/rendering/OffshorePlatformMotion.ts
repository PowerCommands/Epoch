import type { AmbientProfile, Point } from './AmbientProfiles';

export const OFFSHORE_PERIOD = 16;
export const CRANE_PIVOT: Point = [.331, .416];
export const CRANE_TIP: Point = [.14, .155];
export const CRANE_LOAD: Point = [.139, .371];
const ease = (n: number) => { const q = Math.max(0, Math.min(1, n)); return q * q * (3 - 2 * q); };

/** One visual clock coordinates crane slew, cable payout and helicopter visit. */
export function offshorePose(time: number, seed: number) {
  const t = ((time + seed * OFFSHORE_PERIOD) % OFFSHORE_PERIOD + OFFSHORE_PERIOD) % OFFSHORE_PERIOD;
  const angle = -.58 * ease(t / 4) * (1 - ease((t - 12) / 4));
  const x = CRANE_TIP[0] - CRANE_PIVOT[0], y = CRANE_TIP[1] - CRANE_PIVOT[1];
  const tip: Point = [CRANE_PIVOT[0] + x * Math.cos(angle) - y * Math.sin(angle), CRANE_PIVOT[1] + x * Math.sin(angle) + y * Math.cos(angle)];
  const payout = .15 * ease((t - 3) / 3) * (1 - ease((t - 9) / 3));
  const load: Point = [CRANE_LOAD[0] + tip[0] - CRANE_TIP[0], CRANE_LOAD[1] + tip[1] - CRANE_TIP[1] + payout];
  // Coordinates are offsets from the parked aircraft, whose wheels meet the H.
  let flight: Point = [0, 0];
  if (t < 3) { const q = 1 - ease(t / 3); flight = [.2 * q, -.72 * q - .12]; }
  else if (t < 5) flight = [0, -.12 * (1 - ease((t - 3) / 2))];
  else if (t > 8) { const q = ease((t - 8) / 4); flight = [.24 * q, -.84 * q]; }
  return { angle, tip, load, flight, helicopterVisible: t < 12, landed: t >= 5 && t <= 8 };
}

export const OFFSHORE_PROFILE: AmbientProfile = {
  effects: [{ kind: 'water', x: .49, y: .78, size: .7 }, { kind: 'light', x: .56, y: .29, size: .65, color: 0xff9a63 }],
  offshore: true,
  parts: [
    { feature: 'yellow crane boom and cab slewing counterclockwise on the fixed pedestal',
      polygon: [[.085,.105],[.20,.105],[.40,.34],[.405,.45],[.285,.46],[.24,.36],[.15,.24]],
      pivot: CRANE_PIVOT, angle: 0, rhythm: 'machine', offshore: 'boom' },
    { feature: 'original crane cable replaced by a vertical cable following the boom tip',
      polygon: [[.128,.168],[.151,.168],[.151,.35],[.126,.35]], pivot: CRANE_TIP, angle: 0, rhythm: 'machine', offshore: 'rope' },
    { feature: 'suspended steel cargo lowered and raised beneath the rotating boom',
      polygon: [[.091,.355],[.17,.336],[.193,.363],[.184,.388],[.098,.407]], pivot: CRANE_LOAD, angle: 0, rhythm: 'machine', offshore: 'load' },
    { feature: 'visiting helicopter approaching, landing on the H, waiting and departing',
      polygon: [[.735,.335],[.975,.335],[.975,.575],[.735,.575]], pivot: [.855,.575], angle: 0, rhythm: 'machine',
      offshore: 'helicopter', texture: 'unit_helicopter_gunship', textureRect: [.735,.335,.24,.24] },
  ],
  note: 'Sixteen-second synchronized loop: counterclockwise crane slew, vertical load lowering and recovery; helicopter lands, waits and departs. Platform and helipad remain fixed.',
};
