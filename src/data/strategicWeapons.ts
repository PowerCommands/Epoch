/** Strategic ordnance balance. Damage is fixed HP, independent of ordinary ranged strength. */
export interface AreaWeaponDefinition {
  radius: number;
  unitDamage: number;
  cityDamage: number;
  populationLoss: number;
  buildingDamageFraction: number;
  nuclear: boolean;
  createsWaste: boolean;
  destroysImprovements: boolean;
  carrierIds: readonly string[];
  landLaunch: 'any' | 'silo' | 'none';
  /** Strategic targeting bypasses ordinary unit range for ICBM delivery. */
  globalRange?: boolean;
}
const ATOMIC_DAMAGE = { unitDamage: 120, cityDamage: 180, populationLoss: 0.5, buildingDamageFraction: 0.6 };
export const STRATEGIC_WEAPONS: Readonly<Record<string, AreaWeaponDefinition>> = {
  guided_missile: { radius: 1, unitDamage: 60, cityDamage: 70, populationLoss: 0, buildingDamageFraction: 0.15, nuclear: false, createsWaste: false, destroysImprovements: true, carrierIds: ['nuclear_submarine'], landLaunch: 'any' },
  atomic_bomb: { ...ATOMIC_DAMAGE, radius: 3, nuclear: true, createsWaste: true, destroysImprovements: true, carrierIds: ['bomber', 'stealth_bomber'], landLaunch: 'none' },
  nuclear_missile: { radius: 4, unitDamage: 160, cityDamage: 240, populationLoss: 0.65, buildingDamageFraction: 0.8, nuclear: true, createsWaste: true, destroysImprovements: true, carrierIds: ['nuclear_submarine'], landLaunch: 'silo' },
  icbm: { ...ATOMIC_DAMAGE, radius: 2, nuclear: false, createsWaste: false, destroysImprovements: true, carrierIds: [], landLaunch: 'silo', globalRange: true },
};
/** The legacy id remains canonical so old saves retain their launch facilities. */
export const MISSILE_LAUNCH_PAD_ID = 'nuclear_silo';
export const MISSILE_LAUNCH_PAD_CAPACITY = 4;
export const PATRIOT_MISSILE_BATTERY_ID = 'patriot_missile_battery';
export const PATRIOT_DEFENSE_RADIUS = 5;
export const PATRIOT_INTERCEPTION_CHANCE = 0.8;
export const PATRIOT_INTERCEPTION_GOLD_COST = 10_000;
export const INTERCEPTABLE_MISSILE_IDS: ReadonlySet<string> = new Set(['guided_missile', 'nuclear_missile', 'icbm']);

/** Armed ICBMs share the canonical Nuclear Missile damage and effects. Delivery stays on the unit id. */
export function getStrategicWeaponProfile(weapon: { unitType: { id: string }; nuclearArmed?: boolean }): AreaWeaponDefinition | undefined {
  return STRATEGIC_WEAPONS[weapon.unitType.id === 'icbm' && weapon.nuclearArmed ? 'nuclear_missile' : weapon.unitType.id];
}
export const NUCLEAR_SHELTER_DAMAGE_MULTIPLIER = 0.5;
export const NUCLEAR_CLEANUP_TURNS = 5;
export const NUCLEAR_DETERRENCE_STRENGTH = 350;

export function describeStrategicWeapon(id: string): string {
  const config = STRATEGIC_WEAPONS[id];
  if (!config) return '';
  const carriers = config.carrierIds.map(id => id.split('_').map(word => word[0].toUpperCase() + word.slice(1)).join(' ')).join(' or ');
  const platforms = [config.landLaunch === 'silo' ? 'a working Missile Launch Pad' : config.landLaunch === 'any' ? 'land' : '', carriers ? `${carriers} cargo` : ''].filter(Boolean).join(' or ');
  return `Consumable ${config.nuclear ? 'nuclear' : 'conventional'} blast, radius ${config.radius}. ${config.unitDamage} unit damage; ${config.cityDamage} city damage. Requires ${platforms}.${config.createsWaste ? ' Leaves Nuclear Waste.' : ' No Nuclear Waste or nuclear diplomatic consequences.'}${id === 'atomic_bomb' ? ' Uses the bomber’s strike range; cannot move independently.' : ''}${id === 'icbm' ? ' Global range. Mount a Nuclear Warhead at its Launch Pad for Nuclear Missile damage and effects.' : ''}`;
}
