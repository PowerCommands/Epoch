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
}
export const STRATEGIC_WEAPONS: Readonly<Record<string, AreaWeaponDefinition>> = {
  guided_missile: { radius: 1, unitDamage: 60, cityDamage: 70, populationLoss: 0, buildingDamageFraction: 0.15, nuclear: false, createsWaste: false, destroysImprovements: true, carrierIds: ['nuclear_submarine'], landLaunch: 'any' },
  atomic_bomb: { radius: 3, unitDamage: 120, cityDamage: 180, populationLoss: 0.5, buildingDamageFraction: 0.6, nuclear: true, createsWaste: true, destroysImprovements: true, carrierIds: ['bomber', 'stealth_bomber'], landLaunch: 'none' },
  nuclear_missile: { radius: 4, unitDamage: 160, cityDamage: 240, populationLoss: 0.65, buildingDamageFraction: 0.8, nuclear: true, createsWaste: true, destroysImprovements: true, carrierIds: ['nuclear_submarine'], landLaunch: 'silo' },
};
export const NUCLEAR_SHELTER_DAMAGE_MULTIPLIER = 0.5;
export const NUCLEAR_CLEANUP_TURNS = 5;
export const NUCLEAR_DETERRENCE_STRENGTH = 350;

export function describeStrategicWeapon(id: string): string {
  const config = STRATEGIC_WEAPONS[id];
  if (!config) return '';
  const carriers = config.carrierIds.map(id => id.split('_').map(word => word[0].toUpperCase() + word.slice(1)).join(' ')).join(' or ');
  const land = config.landLaunch === 'silo' ? 'a working Nuclear Silo in its city or ' : config.landLaunch === 'any' ? 'land or ' : '';
  return `Consumable ${config.nuclear ? 'nuclear' : 'conventional'} blast, radius ${config.radius}. ${config.unitDamage} unit damage; ${config.cityDamage} city damage. Requires ${land}${carriers} cargo.${config.createsWaste ? ' Leaves Nuclear Waste.' : ' No Nuclear Waste or nuclear diplomatic consequences.'}${id === 'atomic_bomb' ? ' Uses the bomber’s strike range; cannot move independently.' : ''}`;
}
