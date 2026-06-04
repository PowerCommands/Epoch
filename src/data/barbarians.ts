import { BARBARIAN_CAMP_BUILDING_ID } from './buildings';

/**
 * Barbarian (neutral) faction + Barbarian Camp tuning.
 *
 * Barbarians are modelled as a single synthetic, non-playable nation that owns
 * all barbarian units. It is registered with NationManager so unit ownership,
 * colour and combat resolve normally, but it is deliberately excluded from the
 * participant nation list (NationManager.getAllNations), so it never takes a
 * normal turn, is never a diplomacy/economy/victory participant, and is never
 * selectable. Barbarian behaviour is driven separately by BarbarianSystem.
 */
export const BARBARIAN_NATION_ID = 'nation_barbarian';
export const BARBARIAN_NATION_NAME = 'Barbarians';
/** Dark crimson primary / bone secondary — reads clearly as a neutral threat. */
export const BARBARIAN_NATION_COLOR = 0x7a1f1f;
export const BARBARIAN_NATION_SECONDARY_COLOR = 0xd8cab0;

export function isBarbarianNation(nationId: string | undefined): boolean {
  return nationId === BARBARIAN_NATION_ID;
}

/** Re-export so barbarian call sites have one import home. */
export { BARBARIAN_CAMP_BUILDING_ID };

/**
 * Safety distance (hex tiles) the AI keeps between a new city and any active
 * Barbarian Camp. Humans are only blocked from founding ON the camp tile itself;
 * this extra spacing is an AI-only avoidance.
 */
export const BARBARIAN_CAMP_CITY_SAFETY_DISTANCE = 3;

/** Unit spawned by ancient-era camps. Tech scaling can be layered on later. */
export const BARBARIAN_SPAWN_UNIT_ID = 'warrior';

/**
 * Default rounds between barbarian spawns from a camp, used when a scenario does
 * not author its own value. Scenario authors override this per-map in the
 * Editor's Scenario Details (ScenarioMeta.barbarianSpawnInterval).
 */
export const DEFAULT_BARBARIAN_SPAWN_INTERVAL = 10;

/**
 * Resolve a usable spawn interval (rounds) from a scenario-authored value,
 * falling back to {@link DEFAULT_BARBARIAN_SPAWN_INTERVAL} when absent or invalid.
 */
export function resolveBarbarianSpawnInterval(value: number | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 1) {
    return Math.floor(value);
  }
  return DEFAULT_BARBARIAN_SPAWN_INTERVAL;
}

/**
 * Barbarian spawning tuning. Camps themselves are authored by scenario designers
 * in the Editor — the game never generates them — so there are no placement
 * constants here, only how existing camps spawn units. The spawn interval is
 * scenario-driven (see {@link resolveBarbarianSpawnInterval}); these are the
 * remaining crowding knobs. Kept as named constants so the system stays simple.
 */
export const BARBARIAN_CONFIG = {
  /** Don't spawn if at least this many barbarians already exist within radius. */
  maxNearbyBarbarians: 2,
  /** Radius (hex distance) used for the nearby-barbarian crowding check. */
  nearbyRadius: 4,
} as const;
