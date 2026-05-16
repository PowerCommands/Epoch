import type { UnitType } from '../entities/UnitType';

export type MilitaryUnitRole =
  | 'melee'
  | 'ranged'
  | 'mounted'
  | 'siege'
  | 'navalMelee'
  | 'navalRanged'
  | 'air'
  | 'unknown';

const UNIT_ROLE_MAP: Readonly<Record<string, MilitaryUnitRole>> = {
  // Melee
  warrior: 'melee',
  spearman: 'melee',
  swordsman: 'melee',
  longswordsman: 'melee',
  musketman: 'melee',
  rifleman: 'melee',
  great_war_infantry: 'melee',
  infantry: 'melee',
  mechanized_infantry: 'melee',
  paratrooper: 'melee',
  xcom_squad: 'melee',
  // Ranged
  archer: 'ranged',
  composite_bowman: 'ranged',
  crossbowman: 'ranged',
  gatling_gun: 'ranged',
  machine_gun: 'ranged',
  bazooka: 'ranged',
  anti_aircraft_gun: 'ranged',
  anti_tank_gun: 'ranged',
  mobile_sam: 'ranged',
  // Mounted
  chariot_archer: 'mounted',
  horseman: 'mounted',
  knight: 'mounted',
  lancer: 'mounted',
  cavalry: 'mounted',
  landship: 'mounted',
  tank: 'mounted',
  modern_armor: 'mounted',
  helicopter_gunship: 'mounted',
  giant_death_robot: 'mounted',
  // Siege
  catapult: 'siege',
  trebuchet: 'siege',
  cannon: 'siege',
  artillery: 'siege',
  rocket_artillery: 'siege',
  // Naval melee
  trireme: 'navalMelee',
  caravel: 'navalMelee',
  privateer: 'navalMelee',
  ironclad: 'navalMelee',
  destroyer: 'navalMelee',
  // Naval ranged
  galleass: 'navalRanged',
  frigate: 'navalRanged',
  battleship: 'navalRanged',
  missile_cruiser: 'navalRanged',
  carrier: 'navalRanged',
  submarine: 'navalRanged',
  nuclear_submarine: 'navalRanged',
  // Air
  triplane: 'air',
  fighter: 'air',
  jet_fighter: 'air',
  great_war_bomber: 'air',
  bomber: 'air',
  stealth_bomber: 'air',
  atomic_bomb: 'air',
  guided_missile: 'air',
  nuclear_missile: 'air',
};

export function getMilitaryUnitRole(unitType: UnitType): MilitaryUnitRole {
  return UNIT_ROLE_MAP[unitType.id] ?? 'unknown';
}
