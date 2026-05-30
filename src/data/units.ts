import type { UnitCategory, UnitType } from '../entities/UnitType';
import type { Era } from './technologies';

interface UnitDefinitionInput {
  id: string;
  name: string;
  era: Era;
  cost: number;
  upkeepGold?: number;
  upgradeToUnitId?: string;
  cargoCapacity?: number;
  allowedCargoCategories?: readonly UnitCategory[];
  combatStrength: number;
  rangedStrength?: number;
  range?: number;
  movement: number;
  category: UnitCategory;
  canFound?: boolean;
  canBuildImprovements?: boolean;
  maxImprovementCharges?: number;
  isNaval?: boolean;
  ignoresUnitCollision?: boolean;
  canTraverseWater?: boolean;
  mustEndOnLand?: boolean;
  uniquePerNation?: boolean;
  residenceCapitalOnly?: boolean;
  requiredResource?: {
    readonly resourceId: string;
    readonly amount: number;
  };
  serviceLifeRounds?: number;
}

function unit(input: UnitDefinitionInput): UnitType {
  return {
    id: input.id,
    name: input.name,
    era: input.era,
    category: input.category,
    productionCost: input.cost,
    upkeepGold: input.upkeepGold ?? getDefaultUpkeepGold(input.category, input.era),
    upgradeToUnitId: input.upgradeToUnitId,
    cargoCapacity: input.cargoCapacity,
    allowedCargoCategories: input.allowedCargoCategories,
    movementPoints: input.movement,
    baseHealth: input.combatStrength > 0 ? 100 : 50,
    baseStrength: input.combatStrength,
    rangedStrength: input.rangedStrength,
    range: input.range,
    canFound: input.canFound,
    canBuildImprovements: input.canBuildImprovements,
    maxImprovementCharges: input.maxImprovementCharges,
    isNaval: input.isNaval,
    ignoresUnitCollision: input.ignoresUnitCollision,
    canTraverseWater: input.canTraverseWater,
    mustEndOnLand: input.mustEndOnLand,
    uniquePerNation: input.uniquePerNation,
    residenceCapitalOnly: input.residenceCapitalOnly,
    requiredResource: input.requiredResource,
    serviceLifeRounds: input.serviceLifeRounds,
  };
}

function getDefaultUpkeepGold(category: UnitCategory, era: Era): number {
  if (category === 'civilian' || category === 'recon' || category === 'naval_recon') return 0;

  switch (era) {
    case 'ancient':
    case 'classical':
      return 1;
    case 'medieval':
    case 'renaissance':
      return 6;
    case 'industrial':
      return 9;
    case 'modern':
      return 9;
    case 'atomic':
      return 9;
    case 'information':
      return 12;
    case 'future':
      return 15;
  }
}

export const WARRIOR = unit({ id: 'warrior', name: 'Warrior', era: 'ancient', cost: 40, combatStrength: 8, movement: 2, category: 'melee', upkeepGold: 3, upgradeToUnitId: 'swordsman', serviceLifeRounds: 100 });
export const SCOUT = unit({ id: 'scout', name: 'Scout', era: 'ancient', cost: 25, combatStrength: 0, movement: 4, category: 'recon', serviceLifeRounds: 80 });
export const SCOUT_BOAT = unit({ id: 'scout_boat', name: 'Scout Boat', era: 'ancient', cost: 35, combatStrength: 0, movement: 5, category: 'naval_recon', isNaval: true, upkeepGold: 0, serviceLifeRounds: 100 });
export const ARCHER = unit({ id: 'archer', name: 'Archer', era: 'ancient', cost: 40, combatStrength: 5, rangedStrength: 7, range: 2, movement: 2, category: 'ranged', upkeepGold: 3, upgradeToUnitId: 'composite_bowman', serviceLifeRounds: 100 });
export const SPEARMAN = unit({ id: 'spearman', name: 'Spearman', era: 'ancient', cost: 56, combatStrength: 11, movement: 2, category: 'melee', upkeepGold: 3, upgradeToUnitId: 'pikeman', serviceLifeRounds: 110 });
export const CHARIOT_ARCHER = unit({ id: 'chariot_archer', name: 'Chariot Archer', era: 'ancient', cost: 56, combatStrength: 6, rangedStrength: 10, range: 2, movement: 4, category: 'mounted' , upkeepGold: 3, upgradeToUnitId: 'horseman', serviceLifeRounds: 100 });
export const WORK_BOAT = unit({ id: 'work_boat', name: 'Work Boat', era: 'ancient', cost: 50, combatStrength: 0, movement: 4, category: 'civilian', canBuildImprovements: true, maxImprovementCharges: 1, isNaval: true });
export const TRIREME = unit({ id: 'trireme', name: 'Trireme', era: 'ancient', cost: 45, combatStrength: 10, movement: 4, category: 'naval_melee', isNaval: true, upkeepGold: 3, upgradeToUnitId: 'archer_galley', serviceLifeRounds: 100 });
export const CARGO_SHIP = unit({ id: 'cargo_ship', name: 'Cargo Ship', era: 'ancient', cost: 100, combatStrength: 0, movement: 4, category: 'civilian', isNaval: true, cargoCapacity: 1, allowedCargoCategories: ['civilian'] });

export const ARCHER_GALLEY = unit({ id: 'archer_galley', name: 'Archer Galley', era: 'classical', cost: 50, combatStrength: 10, rangedStrength: 12, range: 4, movement: 3, category: 'naval_ranged', isNaval: true, upkeepGold: 3, upgradeToUnitId: 'galleass', serviceLifeRounds: 120 }); // raised: align with classical standard
export const HORSEMAN = unit({ id: 'horseman', name: 'Horseman', era: 'classical', cost: 75, combatStrength: 12, movement: 4, category: 'mounted', requiredResource: { resourceId: 'horses', amount: 1 }, upkeepGold: 3, upgradeToUnitId: 'knight', serviceLifeRounds: 120 });
export const COMPOSITE_BOWMAN = unit({ id: 'composite_bowman', name: 'Composite Bowman', era: 'classical', cost: 75, combatStrength: 8, rangedStrength: 11, range: 2, movement: 2, category: 'ranged' , upkeepGold: 3, upgradeToUnitId: 'crossbowman', serviceLifeRounds: 120 });
export const CATAPULT = unit({ id: 'catapult', name: 'Catapult', era: 'classical', cost: 75, combatStrength: 7, rangedStrength: 8, range: 2, movement: 2, category: 'siege', upkeepGold: 3, upgradeToUnitId: 'trebuchet', serviceLifeRounds: 120 });
export const SWORDSMAN = unit({ id: 'swordsman', name: 'Swordsman', era: 'classical', cost: 75, combatStrength: 14, movement: 2, category: 'melee', requiredResource: { resourceId: 'iron', amount: 1 }, upkeepGold: 3, upgradeToUnitId: 'longswordsman', serviceLifeRounds: 120 });

export const PIKEMAN = unit({ id: 'pikeman', name: 'Pikeman', era: 'medieval', cost: 90, combatStrength: 17, movement: 2, category: 'melee', upkeepGold: 6, upgradeToUnitId: 'lancer', serviceLifeRounds: 120 });
export const CROSSBOWMAN = unit({ id: 'crossbowman', name: 'Crossbowman', era: 'medieval', cost: 120, combatStrength: 13, rangedStrength: 18, range: 2, movement: 2, category: 'ranged', upkeepGold: 6, upgradeToUnitId: 'gatling_gun', serviceLifeRounds: 120 });
export const LONGSWORDSMAN = unit({ id: 'longswordsman', name: 'Longswordsman', era: 'medieval', cost: 120, combatStrength: 21, movement: 2, category: 'melee', requiredResource: { resourceId: 'iron', amount: 1 }, upkeepGold: 6, upgradeToUnitId: 'musketman', serviceLifeRounds: 120 });
export const KNIGHT = unit({ id: 'knight', name: 'Knight', era: 'medieval', cost: 120, combatStrength: 20, movement: 4, category: 'mounted', requiredResource: { resourceId: 'horses', amount: 1 }, upkeepGold: 6, upgradeToUnitId: 'lancer', serviceLifeRounds: 120 });
export const TREBUCHET = unit({ id: 'trebuchet', name: 'Trebuchet', era: 'medieval', cost: 120, combatStrength: 12, rangedStrength: 14, range: 5, movement: 2, category: 'siege' , upkeepGold: 6, upgradeToUnitId: 'cannon', serviceLifeRounds: 120 }); // raised: align with medieval standard
export const GALLEASS = unit({ id: 'galleass', name: 'Galleass', era: 'medieval', cost: 100, combatStrength: 16, rangedStrength: 18, range: 6, movement: 4, category: 'naval_ranged', isNaval: true, upkeepGold: 6, upgradeToUnitId: 'frigate', serviceLifeRounds: 120 }); // raised: align with medieval standard

export const MUSKETMAN = unit({ id: 'musketman', name: 'Musketman', era: 'renaissance', cost: 150, combatStrength: 32, movement: 2, category: 'melee' , upkeepGold: 6, upgradeToUnitId: 'rifleman' });
export const CARAVEL = unit({ id: 'caravel', name: 'Caravel', era: 'renaissance', cost: 120, combatStrength: 25, movement: 4, category: 'naval_melee', isNaval: true, upkeepGold: 4, upgradeToUnitId: 'privateer' }); // raised: renaissance warship
export const FRIGATE = unit({ id: 'frigate', name: 'Frigate', era: 'renaissance', cost: 185, combatStrength: 25, rangedStrength: 28, range: 7, movement: 5, category: 'naval_ranged', isNaval: true, upkeepGold: 6, upgradeToUnitId: 'battleship' }); // raised: capital ship of the age, 3→6
export const PRIVATEER = unit({ id: 'privateer', name: 'Privateer', era: 'renaissance', cost: 150, combatStrength: 30, movement: 5, category: 'naval_melee', isNaval: true, upkeepGold: 5, upgradeToUnitId: 'ironclad' }); // raised: strong fast raider
export const CANNON = unit({ id: 'cannon', name: 'Cannon', era: 'renaissance', cost: 185, combatStrength: 18, rangedStrength: 20, range: 2, movement: 2, category: 'siege', upkeepGold: 6, upgradeToUnitId: 'artillery' });
export const LANCER = unit({ id: 'lancer', name: 'Lancer', era: 'renaissance', cost: 185, combatStrength: 30, movement: 4, category: 'mounted', upkeepGold: 6, upgradeToUnitId: 'cavalry' });

export const RIFLEMAN = unit({ id: 'rifleman', name: 'Rifleman', era: 'industrial', cost: 225, combatStrength: 48, movement: 2, category: 'melee', requiredResource: { resourceId: 'iron', amount: 1 }, upkeepGold: 9, upgradeToUnitId: 'great_war_infantry' });
export const CAVALRY = unit({ id: 'cavalry', name: 'Cavalry', era: 'industrial', cost: 225, combatStrength: 45, movement: 4, category: 'mounted', requiredResource: { resourceId: 'horses', amount: 1 }, upkeepGold: 9, upgradeToUnitId: 'landship' });
export const ARTILLERY = unit({ id: 'artillery', name: 'Artillery', era: 'industrial', cost: 250, combatStrength: 27, rangedStrength: 28, range: 3, movement: 2, category: 'siege', upkeepGold: 9, upgradeToUnitId: 'rocket_artillery' }); // raised: industrial siege matches rifleman tier, 6→9
export const IRONCLAD = unit({ id: 'ironclad', name: 'Ironclad', era: 'industrial', cost: 250, combatStrength: 50, movement: 3, category: 'naval_melee', isNaval: true, upkeepGold: 9, upgradeToUnitId: 'destroyer' }); // raised: steam warship matches industrial tier, 6→9
export const GATLING_GUN = unit({ id: 'gatling_gun', name: 'Gatling Gun', era: 'industrial', cost: 225, combatStrength: 36, rangedStrength: 36, range: 1, movement: 2, category: 'ranged', upkeepGold: 8, upgradeToUnitId: 'machine_gun' }); // raised: industrial support weapon, 5→8
export const ARCHAEOLOGIST = unit({ id: 'archaeologist', name: 'Archaeologist', era: 'industrial', cost: 200, combatStrength: 0, movement: 4, category: 'civilian' });

export const GREAT_WAR_INFANTRY = unit({ id: 'great_war_infantry', name: 'Great War Infantry', era: 'modern', cost: 320, combatStrength: 72, movement: 2, category: 'melee' , upkeepGold: 9, upgradeToUnitId: 'infantry' }); // raised: modern standard, 6→9
export const LANDSHIP = unit({ id: 'landship', name: 'Landship', era: 'modern', cost: 350, combatStrength: 68, movement: 4, category: 'mounted', requiredResource: { resourceId: 'oil', amount: 1 }, upkeepGold: 9, upgradeToUnitId: 'tank' });
export const MACHINE_GUN = unit({ id: 'machine_gun', name: 'Machine Gun', era: 'modern', cost: 350, combatStrength: 60, rangedStrength: 60, range: 1, movement: 2, category: 'ranged', upkeepGold: 9, upgradeToUnitId: 'bazooka' }); // raised: modern standard, 6→9
export const TRIPLANE = unit({ id: 'triplane', name: 'Triplane', era: 'modern', cost: 325, combatStrength: 0, rangedStrength: 35, range: 5, movement: 2, category: 'air', upkeepGold: 15, upgradeToUnitId: 'fighter' });
export const GREAT_WAR_BOMBER = unit({ id: 'great_war_bomber', name: 'Great War Bomber', era: 'modern', cost: 325, combatStrength: 0, rangedStrength: 50, range: 6, movement: 2, category: 'air', upkeepGold: 15, upgradeToUnitId: 'bomber' });
export const DESTROYER = unit({ id: 'destroyer', name: 'Destroyer', era: 'modern', cost: 375, combatStrength: 75, movement: 6, category: 'naval_melee', isNaval: true, upkeepGold: 9 });
export const SUBMARINE = unit({ id: 'submarine', name: 'Submarine', era: 'modern', cost: 325, combatStrength: 35, rangedStrength: 60, range: 5, movement: 5, category: 'naval_ranged', isNaval: true, upkeepGold: 9, upgradeToUnitId: 'nuclear_submarine' });
export const BATTLESHIP = unit({ id: 'battleship', name: 'Battleship', era: 'modern', cost: 375, combatStrength: 55, rangedStrength: 65, range: 10, movement: 5, category: 'naval_ranged', isNaval: true, requiredResource: { resourceId: 'oil', amount: 1 }, upkeepGold: 15, upgradeToUnitId: 'missile_cruiser' });
export const CARRIER = unit({ id: 'carrier', name: 'Carrier', era: 'modern', cost: 375, combatStrength: 50, movement: 5, category: 'naval_ranged', isNaval: true, requiredResource: { resourceId: 'oil', amount: 1 }, upkeepGold: 15, cargoCapacity: 3, allowedCargoCategories: ['air'] });

export const INFANTRY = unit({ id: 'infantry', name: 'Infantry', era: 'atomic', cost: 375, combatStrength: 108, movement: 2, category: 'melee', upkeepGold: 9, upgradeToUnitId: 'mechanized_infantry' });
export const ANTI_AIRCRAFT_GUN = unit({ id: 'anti_aircraft_gun', name: 'Anti-Aircraft Gun', era: 'atomic', cost: 375, combatStrength: 50, range: 2, movement: 2, category: 'ranged', upkeepGold: 6, upgradeToUnitId: 'mobile_sam' }); // raised: atomic-era specialist was underpriced, 3→6
export const PARATROOPER = unit({ id: 'paratrooper', name: 'Paratrooper', era: 'atomic', cost: 375, combatStrength: 65, movement: 2, category: 'melee', upkeepGold: 9, upgradeToUnitId: 'xcom_squad' });
export const TANK = unit({ id: 'tank', name: 'Tank', era: 'atomic', cost: 375, combatStrength: 102, movement: 5, category: 'mounted', requiredResource: { resourceId: 'oil', amount: 1 }, upkeepGold: 9, upgradeToUnitId: 'modern_armor' });
export const FIGHTER = unit({ id: 'fighter', name: 'Fighter', era: 'atomic', cost: 375, combatStrength: 0, rangedStrength: 45, range: 8, movement: 2, category: 'air', upkeepGold: 15, upgradeToUnitId: 'jet_fighter' });
export const BOMBER = unit({ id: 'bomber', name: 'Bomber', era: 'atomic', cost: 375, combatStrength: 0, rangedStrength: 65, range: 10, movement: 2, category: 'air', upkeepGold: 9, upgradeToUnitId: 'stealth_bomber' });
export const ANTI_TANK_GUN = unit({ id: 'anti_tank_gun', name: 'Anti-Tank Gun', era: 'atomic', cost: 300, combatStrength: 50, movement: 2, category: 'ranged', upkeepGold: 6, upgradeToUnitId: 'bazooka' }); // raised: atomic-era specialist was underpriced, 3→6
export const ROCKET_ARTILLERY = unit({ id: 'rocket_artillery', name: 'Rocket Artillery', era: 'atomic', cost: 425, combatStrength: 45, rangedStrength: 60, range: 3, movement: 2, category: 'siege', upkeepGold: 9 });
export const MOBILE_SAM = unit({ id: 'mobile_sam', name: 'Mobile SAM', era: 'atomic', cost: 425, combatStrength: 75, range: 2, movement: 3, category: 'ranged', upkeepGold: 9 });
export const NUCLEAR_SUBMARINE = unit({ id: 'nuclear_submarine', name: 'Nuclear Submarine', era: 'atomic', cost: 425, combatStrength: 53, rangedStrength: 85, range: 12, movement: 6, category: 'naval_ranged', isNaval: true, requiredResource: { resourceId: 'uranium', amount: 1 }, upkeepGold: 15 });
export const ATOMIC_BOMB = unit({ id: 'atomic_bomb', name: 'Atomic Bomb', era: 'atomic', cost: 600, combatStrength: 0, range: 10, movement: 2, category: 'air', requiredResource: { resourceId: 'uranium', amount: 1 }, upkeepGold: 30 });
export const HELICOPTER_GUNSHIP = unit({ id: 'helicopter_gunship', name: 'Helicopter Gunship', era: 'atomic', cost: 425, combatStrength: 60, movement: 6, category: 'mounted', upkeepGold: 9, upgradeToUnitId: 'giant_death_robot' });
export const BAZOOKA = unit({ id: 'bazooka', name: 'Bazooka', era: 'atomic', cost: 375, combatStrength: 90, rangedStrength: 85, range: 1, movement: 2, category: 'ranged', upkeepGold: 6 }); // raised: atomic-era specialist was underpriced, 3→6

export const MECHANIZED_INFANTRY = unit({ id: 'mechanized_infantry', name: 'Mechanized Infantry', era: 'information', cost: 375, combatStrength: 162, movement: 3, category: 'melee', upkeepGold: 9 });
export const MODERN_ARMOR = unit({ id: 'modern_armor', name: 'Modern Armor', era: 'information', cost: 425, combatStrength: 200, movement: 5, category: 'mounted', upkeepGold: 15});
export const JET_FIGHTER = unit({ id: 'jet_fighter', name: 'Jet Fighter', era: 'information', cost: 425, combatStrength: 0, rangedStrength: 75, range: 10, movement: 2, category: 'air', upkeepGold: 15 });
export const STEALTH_BOMBER = unit({ id: 'stealth_bomber', name: 'Stealth Bomber', era: 'information', cost: 425, combatStrength: 0, rangedStrength: 85, range: 20, movement: 2, category: 'air', upkeepGold: 15 });
export const GUIDED_MISSILE = unit({ id: 'guided_missile', name: 'Guided Missile', era: 'information', cost: 150, combatStrength: 0, rangedStrength: 60, range: 8, movement: 2, category: 'air', upkeepGold: 30 });
export const NUCLEAR_MISSILE = unit({ id: 'nuclear_missile', name: 'Nuclear Missile', era: 'information', cost: 1000, combatStrength: 0, range: 12, movement: 2, category: 'air', requiredResource: { resourceId: 'uranium', amount: 1 }, upkeepGold: 30 });
export const XCOM_SQUAD = unit({ id: 'xcom_squad', name: 'XCOM Squad', era: 'information', cost: 400, combatStrength: 100, movement: 2, category: 'melee', upkeepGold: 9 });
export const GIANT_DEATH_ROBOT = unit({ id: 'giant_death_robot', name: 'Giant Death Robot', era: 'information', cost: 425, combatStrength: 150, movement: 5, category: 'mounted', upkeepGold: 30 });
export const MISSILE_CRUISER = unit({ id: 'missile_cruiser', name: 'Missile Cruiser', era: 'information', cost: 425, combatStrength: 83, rangedStrength: 100, range: 13, movement: 7, category: 'naval_ranged', isNaval: true, upkeepGold: 15 }); // raised: top-tier naval ranged should match battleship/carrier tier, 9→15

export const WORKER = unit({ id: 'worker', name: 'Worker', era: 'ancient', cost: 70, combatStrength: 0, movement: 2, category: 'civilian', canBuildImprovements: true, maxImprovementCharges: 2 });
export const SETTLER = unit({ id: 'settler', name: 'Settler', era: 'ancient', cost: 106, combatStrength: 0, movement: 2, category: 'civilian', canFound: true });
// Leader is a special strategic entity, not a normal producible unit.
// It is intentionally excluded from ALL_UNIT_TYPES and may only be spawned by
// dedicated political residence / evacuation systems.
export const LEADER = unit({
  id: 'leader',
  name: 'Leader',
  era: 'ancient',
  cost: 0,
  combatStrength: 8,
  movement: 10,
  category: 'leader',
  upkeepGold: 0,
  ignoresUnitCollision: true,
  canTraverseWater: true,
  mustEndOnLand: true,
  uniquePerNation: true,
  residenceCapitalOnly: true,
});

export const TRANSPORT_SHIP = unit({ id: 'transport_ship', name: 'Transport Ship', era: 'renaissance', cost: 120, combatStrength: 0, movement: 4, category: 'civilian', isNaval: true, cargoCapacity: 3, allowedCargoCategories: ['civilian', 'melee', 'ranged', 'mounted', 'siege'] });

export const SPECIAL_UNIT_TYPES: UnitType[] = [
  LEADER,
];

export const ALL_UNIT_TYPES: UnitType[] = [
  WARRIOR, SCOUT, SCOUT_BOAT, ARCHER, SPEARMAN, CHARIOT_ARCHER, WORK_BOAT, TRIREME, ARCHER_GALLEY, CARGO_SHIP,
  HORSEMAN, COMPOSITE_BOWMAN, CATAPULT, SWORDSMAN,
  PIKEMAN, CROSSBOWMAN, LONGSWORDSMAN, KNIGHT, TREBUCHET, GALLEASS,
  MUSKETMAN, CARAVEL, FRIGATE, PRIVATEER, CANNON, LANCER,
  RIFLEMAN, CAVALRY, ARTILLERY, IRONCLAD, GATLING_GUN, ARCHAEOLOGIST,
  GREAT_WAR_INFANTRY, LANDSHIP, MACHINE_GUN, TRIPLANE, GREAT_WAR_BOMBER, DESTROYER, SUBMARINE, BATTLESHIP, CARRIER,
  INFANTRY, ANTI_AIRCRAFT_GUN, PARATROOPER, TANK, FIGHTER, BOMBER, ANTI_TANK_GUN, ROCKET_ARTILLERY, MOBILE_SAM,
  NUCLEAR_SUBMARINE, ATOMIC_BOMB, HELICOPTER_GUNSHIP, BAZOOKA,
  MECHANIZED_INFANTRY, MODERN_ARMOR, JET_FIGHTER, STEALTH_BOMBER, GUIDED_MISSILE, NUCLEAR_MISSILE, XCOM_SQUAD,
  GIANT_DEATH_ROBOT, MISSILE_CRUISER,
  WORKER, SETTLER, TRANSPORT_SHIP,
];

export function getUnitTypeById(id: string): UnitType | undefined {
  return ALL_UNIT_TYPES.find((unitType) => unitType.id === id)
    ?? SPECIAL_UNIT_TYPES.find((unitType) => unitType.id === id);
}

export function hasCargoCapacity(unitType: UnitType): boolean {
  return (unitType.cargoCapacity ?? 0) > 0;
}

export function canCarryUnitType(transportType: UnitType, passengerType: UnitType): boolean {
  return hasCargoCapacity(transportType)
    && (transportType.allowedCargoCategories ?? []).includes(passengerType.category);
}

export function getLegacyCompatibleUnitTypeById(id: string): UnitType | undefined {
  if (id === 'caravan') return undefined;
  const normalizedId = id === 'fishing_boat' ? 'work_boat' : id;
  return getUnitTypeById(normalizedId);
}
