/** Independent tables allow fighter and surface defense balance to diverge later. */
export const FIGHTER_INTERCEPTION = [
  { radius: 2, chance: 0.1 }, { radius: 3, chance: 0.2 },
  { radius: 4, chance: 0.3 }, { radius: 4, chance: 0.4 },
  { radius: 5, chance: 0.5 }, { radius: 6, chance: 0.6 },
] as const;
export const GROUND_INTERCEPTION = FIGHTER_INTERCEPTION.map(tier => ({ ...tier }));
export function interceptionProfile(quality: number, fighter: boolean) {
  return (fighter ? FIGHTER_INTERCEPTION : GROUND_INTERCEPTION)[Math.max(0, Math.min(5, Math.floor(quality)))];
}
/** Stateless seeded roll: saves and animation speed cannot change the outcome. */
export function airMissionRoll(key: string): number {
  let hash = 2166136261;
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  hash ^= hash >>> 16; hash = Math.imul(hash, 0x7feb352d); hash ^= hash >>> 15;
  return (hash >>> 0) / 4294967296;
}
