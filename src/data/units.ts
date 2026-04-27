import type { UnitCategory, UnitType } from '../entities/UnitType';
import type { Era } from './technologies';

interface UnitDefinitionInput {
  id: string;
  name: string;
  era: Era;
  cost: number;
  combatStrength: number;
  rangedStrength?: number;
  range?: number;
  movement: number;
  category: UnitCategory;
  canFound?: boolean;
  canBuildImprovements?: boolean;
  isNaval?: boolean;
  requiredResource?: {
    readonly resourceId: string;
    readonly amount: number;
  };
}

function unit(input: UnitDefinitionInput): UnitType {
  return {
    id: input.id,
    name: input.name,
    era: input.era,
    category: input.category,
    productionCost: input.cost,
    movementPoints: input.movement,
    baseHealth: input.combatStrength > 0 ? 100 : 50,
    baseStrength: input.combatStrength,
    rangedStrength: input.rangedStrength,
    range: input.range,
    canFound: input.canFound,
    canBuildImprovements: input.canBuildImprovements,
    isNaval: input.isNaval,
    requiredResource: input.requiredResource,
  };
}

export const WARRIOR = unit({ id: 'warrior', name: 'Warrior', era: 'ancient', cost: 40, combatStrength: 8, movement: 2, category: 'melee' });
export const SCOUT = unit({ id: 'scout', name: 'Scout', era: 'ancient', cost: 25, combatStrength: 0, movement: 4, category: 'recon' });
export const ARCHER = unit({ id: 'archer', name: 'Archer', era: 'ancient', cost: 40, combatStrength: 5, rangedStrength: 7, range: 2, movement: 2, category: 'ranged' });
export const SPEARMAN = unit({ id: 'spearman', name: 'Spearman', era: 'ancient', cost: 56, combatStrength: 11, movement: 2, category: 'melee' });
export const CHARIOT_ARCHER = unit({ id: 'chariot_archer', name: 'Chariot Archer', era: 'ancient', cost: 56, combatStrength: 6, rangedStrength: 10, range: 2, movement: 4, category: 'mounted' });
export const WORK_BOAT = unit({ id: 'work_boat', name: 'Work Boat', era: 'ancient', cost: 50, combatStrength: 0, movement: 4, category: 'civilian', isNaval: true });
export const TRIREME = unit({ id: 'trireme', name: 'Trireme', era: 'ancient', cost: 45, combatStrength: 10, movement: 4, category: 'naval_melee', isNaval: true });
export const CARAVAN = unit({ id: 'caravan', name: 'Caravan', era: 'ancient', cost: 75, combatStrength: 0, movement: 1, category: 'civilian' });
export const CARGO_SHIP = unit({ id: 'cargo_ship', name: 'Cargo Ship', era: 'ancient', cost: 100, combatStrength: 0, movement: 1, category: 'civilian', isNaval: true });

export const HORSEMAN = unit({ id: 'horseman', name: 'Horseman', era: 'classical', cost: 75, combatStrength: 12, movement: 4, category: 'mounted', requiredResource: { resourceId: 'horses', amount: 1 } });
export const COMPOSITE_BOWMAN = unit({ id: 'composite_bowman', name: 'Composite Bowman', era: 'classical', cost: 75, combatStrength: 7, rangedStrength: 11, range: 2, movement: 2, category: 'ranged' });
export const CATAPULT = unit({ id: 'catapult', name: 'Catapult', era: 'classical', cost: 75, combatStrength: 7, rangedStrength: 8, range: 2, movement: 2, category: 'siege' });
export const SWORDSMAN = unit({ id: 'swordsman', name: 'Swordsman', era: 'classical', cost: 75, combatStrength: 14, movement: 2, category: 'melee', requiredResource: { resourceId: 'iron', amount: 1 } });

export const PIKEMAN = unit({ id: 'pikeman', name: 'Pikeman', era: 'medieval', cost: 90, combatStrength: 16, movement: 2, category: 'melee' });
export const CROSSBOWMAN = unit({ id: 'crossbowman', name: 'Crossbowman', era: 'medieval', cost: 120, combatStrength: 13, rangedStrength: 18, range: 2, movement: 2, category: 'ranged' });
export const LONGSWORDSMAN = unit({ id: 'longswordsman', name: 'Longswordsman', era: 'medieval', cost: 120, combatStrength: 21, movement: 2, category: 'melee', requiredResource: { resourceId: 'iron', amount: 1 } });
export const KNIGHT = unit({ id: 'knight', name: 'Knight', era: 'medieval', cost: 120, combatStrength: 20, movement: 4, category: 'mounted', requiredResource: { resourceId: 'horses', amount: 1 } });
export const TREBUCHET = unit({ id: 'trebuchet', name: 'Trebuchet', era: 'medieval', cost: 120, combatStrength: 12, rangedStrength: 14, range: 2, movement: 2, category: 'siege' });
export const GALLEASS = unit({ id: 'galleass', name: 'Galleass', era: 'medieval', cost: 100, combatStrength: 16, rangedStrength: 17, range: 2, movement: 3, category: 'naval_ranged', isNaval: true });

export const MUSKETMAN = unit({ id: 'musketman', name: 'Musketman', era: 'renaissance', cost: 150, combatStrength: 24, movement: 2, category: 'melee' });
export const CARAVEL = unit({ id: 'caravel', name: 'Caravel', era: 'renaissance', cost: 120, combatStrength: 20, movement: 4, category: 'naval_melee', isNaval: true });
export const FRIGATE = unit({ id: 'frigate', name: 'Frigate', era: 'renaissance', cost: 185, combatStrength: 25, rangedStrength: 28, range: 2, movement: 5, category: 'naval_ranged', isNaval: true });
export const PRIVATEER = unit({ id: 'privateer', name: 'Privateer', era: 'renaissance', cost: 150, combatStrength: 25, movement: 5, category: 'naval_melee', isNaval: true });
export const CANNON = unit({ id: 'cannon', name: 'Cannon', era: 'renaissance', cost: 185, combatStrength: 14, rangedStrength: 20, range: 2, movement: 2, category: 'siege' });
export const LANCER = unit({ id: 'lancer', name: 'Lancer', era: 'renaissance', cost: 185, combatStrength: 25, movement: 4, category: 'mounted' });

export const RIFLEMAN = unit({ id: 'rifleman', name: 'Rifleman', era: 'industrial', cost: 225, combatStrength: 34, movement: 2, category: 'melee', requiredResource: { resourceId: 'iron', amount: 1 } });
export const CAVALRY = unit({ id: 'cavalry', name: 'Cavalry', era: 'industrial', cost: 225, combatStrength: 34, movement: 4, category: 'mounted', requiredResource: { resourceId: 'horses', amount: 1 } });
export const ARTILLERY = unit({ id: 'artillery', name: 'Artillery', era: 'industrial', cost: 250, combatStrength: 21, rangedStrength: 28, range: 3, movement: 2, category: 'siege' });
export const IRONCLAD = unit({ id: 'ironclad', name: 'Ironclad', era: 'industrial', cost: 250, combatStrength: 50, movement: 3, category: 'naval_melee', isNaval: true });
export const GATLING_GUN = unit({ id: 'gatling_gun', name: 'Gatling Gun', era: 'industrial', cost: 225, combatStrength: 36, rangedStrength: 36, range: 1, movement: 2, category: 'ranged' });
export const ARCHAEOLOGIST = unit({ id: 'archaeologist', name: 'Archaeologist', era: 'industrial', cost: 200, combatStrength: 0, movement: 4, category: 'civilian' });

export const GREAT_WAR_INFANTRY = unit({ id: 'great_war_infantry', name: 'Great War Infantry', era: 'modern', cost: 320, combatStrength: 50, movement: 2, category: 'melee' });
export const LANDSHIP = unit({ id: 'landship', name: 'Landship', era: 'modern', cost: 350, combatStrength: 60, movement: 4, category: 'mounted', requiredResource: { resourceId: 'oil', amount: 1 } });
export const MACHINE_GUN = unit({ id: 'machine_gun', name: 'Machine Gun', era: 'modern', cost: 350, combatStrength: 60, rangedStrength: 60, range: 1, movement: 2, category: 'ranged' });
export const TRIPLANE = unit({ id: 'triplane', name: 'Triplane', era: 'modern', cost: 325, combatStrength: 0, rangedStrength: 35, range: 5, movement: 2, category: 'air' });
export const GREAT_WAR_BOMBER = unit({ id: 'great_war_bomber', name: 'Great War Bomber', era: 'modern', cost: 325, combatStrength: 0, rangedStrength: 50, range: 6, movement: 2, category: 'air' });
export const DESTROYER = unit({ id: 'destroyer', name: 'Destroyer', era: 'modern', cost: 375, combatStrength: 55, movement: 6, category: 'naval_melee', isNaval: true });
export const SUBMARINE = unit({ id: 'submarine', name: 'Submarine', era: 'modern', cost: 325, combatStrength: 35, rangedStrength: 60, range: 3, movement: 5, category: 'naval_ranged', isNaval: true });
export const BATTLESHIP = unit({ id: 'battleship', name: 'Battleship', era: 'modern', cost: 375, combatStrength: 55, rangedStrength: 65, range: 3, movement: 5, category: 'naval_ranged', isNaval: true, requiredResource: { resourceId: 'oil', amount: 1 } });
export const CARRIER = unit({ id: 'carrier', name: 'Carrier', era: 'modern', cost: 375, combatStrength: 50, movement: 5, category: 'naval_ranged', isNaval: true, requiredResource: { resourceId: 'oil', amount: 1 } });

export const INFANTRY = unit({ id: 'infantry', name: 'Infantry', era: 'atomic', cost: 375, combatStrength: 70, movement: 2, category: 'melee' });
export const ANTI_AIRCRAFT_GUN = unit({ id: 'anti_aircraft_gun', name: 'Anti-Aircraft Gun', era: 'atomic', cost: 375, combatStrength: 50, range: 2, movement: 2, category: 'ranged' });
export const PARATROOPER = unit({ id: 'paratrooper', name: 'Paratrooper', era: 'atomic', cost: 375, combatStrength: 65, movement: 2, category: 'melee' });
export const TANK = unit({ id: 'tank', name: 'Tank', era: 'atomic', cost: 375, combatStrength: 70, movement: 5, category: 'mounted', requiredResource: { resourceId: 'oil', amount: 1 } });
export const FIGHTER = unit({ id: 'fighter', name: 'Fighter', era: 'atomic', cost: 375, combatStrength: 0, rangedStrength: 45, range: 8, movement: 2, category: 'air' });
export const BOMBER = unit({ id: 'bomber', name: 'Bomber', era: 'atomic', cost: 375, combatStrength: 0, rangedStrength: 65, range: 10, movement: 2, category: 'air' });
export const ANTI_TANK_GUN = unit({ id: 'anti_tank_gun', name: 'Anti-Tank Gun', era: 'atomic', cost: 300, combatStrength: 50, movement: 2, category: 'ranged' });
export const ROCKET_ARTILLERY = unit({ id: 'rocket_artillery', name: 'Rocket Artillery', era: 'atomic', cost: 425, combatStrength: 45, rangedStrength: 60, range: 3, movement: 2, category: 'siege' });
export const MOBILE_SAM = unit({ id: 'mobile_sam', name: 'Mobile SAM', era: 'atomic', cost: 425, combatStrength: 65, range: 2, movement: 3, category: 'ranged' });
export const NUCLEAR_SUBMARINE = unit({ id: 'nuclear_submarine', name: 'Nuclear Submarine', era: 'atomic', cost: 425, combatStrength: 50, rangedStrength: 85, range: 3, movement: 6, category: 'naval_ranged', isNaval: true, requiredResource: { resourceId: 'uranium', amount: 1 } });
export const ATOMIC_BOMB = unit({ id: 'atomic_bomb', name: 'Atomic Bomb', era: 'atomic', cost: 600, combatStrength: 0, range: 10, movement: 2, category: 'air', requiredResource: { resourceId: 'uranium', amount: 1 } });
export const HELICOPTER_GUNSHIP = unit({ id: 'helicopter_gunship', name: 'Helicopter Gunship', era: 'atomic', cost: 425, combatStrength: 60, movement: 6, category: 'mounted' });
export const BAZOOKA = unit({ id: 'bazooka', name: 'Bazooka', era: 'atomic', cost: 375, combatStrength: 85, rangedStrength: 85, range: 1, movement: 2, category: 'ranged' });

export const MECHANIZED_INFANTRY = unit({ id: 'mechanized_infantry', name: 'Mechanized Infantry', era: 'information', cost: 375, combatStrength: 90, movement: 3, category: 'melee' });
export const MODERN_ARMOR = unit({ id: 'modern_armor', name: 'Modern Armor', era: 'information', cost: 425, combatStrength: 100, movement: 5, category: 'mounted' });
export const JET_FIGHTER = unit({ id: 'jet_fighter', name: 'Jet Fighter', era: 'information', cost: 425, combatStrength: 0, rangedStrength: 75, range: 10, movement: 2, category: 'air' });
export const STEALTH_BOMBER = unit({ id: 'stealth_bomber', name: 'Stealth Bomber', era: 'information', cost: 425, combatStrength: 0, rangedStrength: 85, range: 20, movement: 2, category: 'air' });
export const GUIDED_MISSILE = unit({ id: 'guided_missile', name: 'Guided Missile', era: 'information', cost: 150, combatStrength: 0, rangedStrength: 60, range: 8, movement: 2, category: 'air' });
export const NUCLEAR_MISSILE = unit({ id: 'nuclear_missile', name: 'Nuclear Missile', era: 'information', cost: 1000, combatStrength: 0, range: 12, movement: 2, category: 'air', requiredResource: { resourceId: 'uranium', amount: 1 } });
export const XCOM_SQUAD = unit({ id: 'xcom_squad', name: 'XCOM Squad', era: 'information', cost: 400, combatStrength: 100, movement: 2, category: 'melee' });
export const GIANT_DEATH_ROBOT = unit({ id: 'giant_death_robot', name: 'Giant Death Robot', era: 'information', cost: 425, combatStrength: 150, movement: 5, category: 'mounted' });
export const MISSILE_CRUISER = unit({ id: 'missile_cruiser', name: 'Missile Cruiser', era: 'information', cost: 425, combatStrength: 80, rangedStrength: 100, range: 3, movement: 7, category: 'naval_ranged', isNaval: true });

export const WORKER = unit({ id: 'worker', name: 'Worker', era: 'ancient', cost: 70, combatStrength: 0, movement: 2, category: 'civilian', canBuildImprovements: true });
export const SETTLER = unit({ id: 'settler', name: 'Settler', era: 'ancient', cost: 106, combatStrength: 0, movement: 2, category: 'civilian', canFound: true });

export const FISHING_BOAT = unit({ id: 'fishing_boat', name: 'Fishing Boat', era: 'ancient', cost: 50, combatStrength: 0, movement: 4, category: 'civilian', isNaval: true });
export const TRANSPORT_SHIP = unit({ id: 'transport_ship', name: 'Transport Ship', era: 'renaissance', cost: 120, combatStrength: 0, movement: 4, category: 'civilian', isNaval: true });

export const ALL_UNIT_TYPES: UnitType[] = [
  WARRIOR, SCOUT, ARCHER, SPEARMAN, CHARIOT_ARCHER, WORK_BOAT, TRIREME, CARAVAN, CARGO_SHIP,
  HORSEMAN, COMPOSITE_BOWMAN, CATAPULT, SWORDSMAN,
  PIKEMAN, CROSSBOWMAN, LONGSWORDSMAN, KNIGHT, TREBUCHET, GALLEASS,
  MUSKETMAN, CARAVEL, FRIGATE, PRIVATEER, CANNON, LANCER,
  RIFLEMAN, CAVALRY, ARTILLERY, IRONCLAD, GATLING_GUN, ARCHAEOLOGIST,
  GREAT_WAR_INFANTRY, LANDSHIP, MACHINE_GUN, TRIPLANE, GREAT_WAR_BOMBER, DESTROYER, SUBMARINE, BATTLESHIP, CARRIER,
  INFANTRY, ANTI_AIRCRAFT_GUN, PARATROOPER, TANK, FIGHTER, BOMBER, ANTI_TANK_GUN, ROCKET_ARTILLERY, MOBILE_SAM,
  NUCLEAR_SUBMARINE, ATOMIC_BOMB, HELICOPTER_GUNSHIP, BAZOOKA,
  MECHANIZED_INFANTRY, MODERN_ARMOR, JET_FIGHTER, STEALTH_BOMBER, GUIDED_MISSILE, NUCLEAR_MISSILE, XCOM_SQUAD,
  GIANT_DEATH_ROBOT, MISSILE_CRUISER,
  WORKER, SETTLER, FISHING_BOAT, TRANSPORT_SHIP,
];

export function getUnitTypeById(id: string): UnitType | undefined {
  return ALL_UNIT_TYPES.find((unitType) => unitType.id === id);
}
