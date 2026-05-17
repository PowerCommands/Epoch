import type { BuildingModifiers, BuildingPlacement, BuildingType } from '../entities/Building';
import type { Era } from './technologies';

interface BuildingInput {
  id: string;
  name: string;
  era: Era;
  placement?: BuildingPlacement;
  cost: number;
  maintenance: number;
  modifiers?: BuildingModifiers;
  description?: string;
}

function building(input: BuildingInput): BuildingType {
  return {
    id: input.id,
    name: input.name,
    era: input.era,
    description: input.description ?? describeModifiers(input.modifiers ?? {}),
    placement: input.placement ?? 'land',
    maintenance: input.maintenance,
    productionCost: input.cost,
    modifiers: input.modifiers ?? {},
  };
}

function describeModifiers(modifiers: BuildingModifiers): string {
  const parts = [
    ['food', modifiers.foodPerTurn],
    ['production', modifiers.productionPerTurn],
    ['gold', modifiers.goldPerTurn],
    ['science', modifiers.sciencePerTurn],
    ['culture', modifiers.culturePerTurn],
    ['happiness', modifiers.happinessPerTurn],
    ['food', modifiers.foodPercent, '%'],
    ['production', modifiers.productionPercent, '%'],
    ['gold', modifiers.goldPercent, '%'],
    ['science', modifiers.sciencePercent, '%'],
    ['culture', modifiers.culturePercent, '%'],
  ]
    .filter(([, value]) => value !== undefined && value !== 0)
    .map(([label, value, suffix]) => `+${value}${suffix ?? ''} ${label}`);

  return parts.length > 0 ? parts.join(', ') : 'No direct local modifier';
}

export const MONUMENT = building({ id: 'monument', name: 'Monument', era: 'ancient', cost: 40, maintenance: 1, modifiers: { culturePerTurn: 2, happinessPerTurn: 2 } });
export const GRANARY = building({ id: 'granary', name: 'Granary', era: 'ancient', cost: 60, maintenance: 1, modifiers: { foodPerTurn: 2 , happinessPerTurn: 2} });
export const SHRINE = building({ id: 'shrine', name: 'Shrine', era: 'ancient', cost: 40, maintenance: 1, description: 'Faith omitted until religion exists', modifiers: { happinessPerTurn: 2} });
export const BARRACKS = building({ id: 'barracks', name: 'Barracks', era: 'ancient', cost: 75, maintenance: 1, description: 'Unit XP omitted until promotions exist' });
export const WALLS = building({ id: 'walls', name: 'Walls', era: 'ancient', cost: 75, maintenance: 0, description: 'City defense omitted until building defense is modeled' });
export const WATER_MILL = building({ id: 'water_mill', name: 'Water Mill', era: 'ancient', cost: 75, maintenance: 2, modifiers: { foodPerTurn: 2, productionPerTurn: 1, happinessPerTurn: 2 } });
export const STONE_WORKS = building({ id: 'stone_works', name: 'Stone Works', era: 'ancient', cost: 75, maintenance: 1, modifiers: { productionPerTurn: 1 , happinessPerTurn: 2}, description: 'Resource requirements omitted; uses flat +1 production approximation' });

export const LIBRARY = building({ id: 'library', name: 'Library', era: 'classical', cost: 75, maintenance: 1, modifiers: { sciencePerTurn: 2, happinessPerTurn: 2 }, description: 'Civ V is +1 science per 2 citizens; approximated as +2 science' });
export const CIRCUS = building({ id: 'circus', name: 'Circus', era: 'classical', cost: 75, maintenance: 0, modifiers: { happinessPerTurn: 5 }, description: 'Resource requirement omitted' });
export const COLOSSEUM = building({ id: 'colosseum', name: 'Colosseum', era: 'classical', cost: 100, maintenance: 1, modifiers: { happinessPerTurn: 5 } });
export const COURTHOUSE = building({ id: 'courthouse', name: 'Courthouse', era: 'classical', cost: 100, maintenance: 4, description: 'Occupied-city unhappiness omitted', modifiers: { foodPerTurn: 2 , happinessPerTurn: 2} });
export const TEMPLE = building({ id: 'temple', name: 'Temple', era: 'classical', cost: 100, maintenance: 2, modifiers: { culturePerTurn: 3, happinessPerTurn: 2 }, description: 'Civ V culture plus simplified religion happiness hook' });
export const LIGHTHOUSE = building({ id: 'lighthouse', name: 'Lighthouse', era: 'classical', placement: 'water', cost: 75, maintenance: 1, modifiers: { foodPerTurn: 1, happinessPerTurn: 2 }, description: 'Sea-tile food approximated as +1 food' });
export const STABLE = building({ id: 'stable', name: 'Stable', era: 'classical', cost: 100, maintenance: 1, modifiers: { productionPercent: 5, happinessPerTurn: 2 }, description: 'Mounted-unit and pasture bonuses approximated as +5% production' });

export const CASTLE = building({ id: 'castle', name: 'Castle', era: 'medieval', cost: 160, maintenance: 0, description: 'City defense omitted until building defense is modeled' , modifiers: { foodPerTurn: 2 }});
export const ARMORY = building({ id: 'armory', name: 'Armory', era: 'medieval', cost: 160, maintenance: 1, description: 'Unit XP omitted until promotions exist' , modifiers: { foodPerTurn: 2 }});
export const FORGE = building({ id: 'forge', name: 'Forge', era: 'medieval', cost: 120, maintenance: 1, modifiers: { productionPercent: 5, happinessPerTurn: 2 }, description: 'Land-unit and iron bonuses approximated as +5% production' });
export const MARKET = building({ id: 'market', name: 'Market', era: 'medieval', cost: 120, maintenance: 0, modifiers: { goldPerTurn: 2, goldPercent: 25, happinessPerTurn: 2 } });
export const MINT = building({ id: 'mint', name: 'Mint', era: 'medieval', cost: 120, maintenance: 0, modifiers: { goldPerTurn: 2, happinessPerTurn: 2 }, description: 'Gold/silver resource bonus approximated as +2 gold' });
export const GARDEN = building({ id: 'garden', name: 'Garden', era: 'medieval', cost: 120, maintenance: 1, description: 'Great People modifier omitted' , modifiers: { foodPerTurn: 2 , happinessPerTurn: 2}});
export const UNIVERSITY = building({ id: 'university', name: 'University', era: 'medieval', cost: 160, maintenance: 2, modifiers: { sciencePercent: 33, happinessPerTurn: 2 }, description: 'Jungle science omitted; keeps +33% science' });
export const WORKSHOP = building({ id: 'workshop', name: 'Workshop', era: 'medieval', cost: 120, maintenance: 2, modifiers: { productionPerTurn: 2, productionPercent: 10, happinessPerTurn: 2 } });
export const AQUEDUCT = building({ id: 'aqueduct', name: 'Aqueduct', era: 'medieval', cost: 100, maintenance: 1, description: 'Food carryover omitted until growth modifiers exist', modifiers: { foodPerTurn: 2 , happinessPerTurn: 2} });
export const HARBOR = building({ id: 'harbor', name: 'Harbor', era: 'medieval', placement: 'water', cost: 120, maintenance: 3, modifiers: { productionPerTurn: 1 , happinessPerTurn: 2}, description: 'Sea trade route omitted; sea resource production approximated as +1 production' });
export const OBSERVATORY = building({ id: 'observatory', name: 'Observatory', era: 'medieval', cost: 200, maintenance: 0, modifiers: { sciencePercent: 50 , happinessPerTurn: 2}, description: 'Mountain requirement omitted' });

export const OPERA_HOUSE = building({ id: 'opera_house', name: 'Opera House', era: 'renaissance', cost: 200, maintenance: 2, modifiers: { culturePerTurn: 4, happinessPerTurn: 2 } });
export const BANK = building({ id: 'bank', name: 'Bank', era: 'renaissance', cost: 200, maintenance: 0, modifiers: { goldPercent: 25, happinessPerTurn: 2 } });
export const MUSEUM = building({ id: 'museum', name: 'Museum', era: 'renaissance', cost: 300, maintenance: 3, modifiers: { culturePerTurn: 5, happinessPerTurn: 2 } });
export const PUBLIC_SCHOOL = building({ id: 'public_school', name: 'Public School', era: 'renaissance', cost: 300, maintenance: 3, modifiers: { sciencePerTurn: 3, sciencePercent: 50, happinessPerTurn: 2 }, description: 'Per-citizen science approximated with +50% science and +3 flat science' });
export const SEAPORT = building({ id: 'seaport', name: 'Seaport', era: 'renaissance', placement: 'water', cost: 250, maintenance: 2, modifiers: { productionPerTurn: 1, goldPerTurn: 1, productionPercent: 5, happinessPerTurn: 4 }, description: 'Sea-resource and naval production effects approximated' });
export const WINDMILL = building({ id: 'windmill', name: 'Windmill', era: 'renaissance', cost: 250, maintenance: 2, modifiers: { productionPerTurn: 2, productionPercent: 10, happinessPerTurn: 2 }, description: 'Flatland requirement omitted' });
export const ZOO = building({ id: 'zoo', name: 'Zoo', era: 'renaissance', cost: 200, maintenance: 2, modifiers: { happinessPerTurn: 5 } });

export const MILITARY_ACADEMY = building({ id: 'military_academy', name: 'Military Academy', era: 'industrial', cost: 300, maintenance: 1, description: 'Unit XP omitted until promotions exist', modifiers: { foodPerTurn: 2 } });
export const ARSENAL = building({ id: 'arsenal', name: 'Arsenal', era: 'industrial', cost: 300, maintenance: 0, description: 'City defense omitted until building defense is modeled', modifiers: { foodPerTurn: 2 } });
export const FACTORY = building({ id: 'factory', name: 'Factory', era: 'industrial', cost: 360, maintenance: 3, modifiers: { productionPerTurn: 4, productionPercent: 10, happinessPerTurn: 2 }, description: 'Civ V BNW factory is +10% and +4 production; coal requirement omitted' });
export const STOCK_EXCHANGE = building({ id: 'stock_exchange', name: 'Stock Exchange', era: 'industrial', cost: 500, maintenance: 0, modifiers: { goldPercent: 33, happinessPerTurn: 2 } });
export const HOSPITAL = building({ id: 'hospital', name: 'Hospital', era: 'industrial', cost: 360, maintenance: 2, modifiers: { foodPerTurn: 5, happinessPerTurn: 2 } });
export const HOTEL = building({ id: 'hotel', name: 'Hotel', era: 'industrial', cost: 300, maintenance: 0, modifiers: { culturePercent: 10, happinessPerTurn: 4 }, description: 'Tourism conversion approximated as +10% culture' });

export const BROADCAST_TOWER = building({ id: 'broadcast_tower', name: 'Broadcast Tower', era: 'modern', cost: 500, maintenance: 3, modifiers: { culturePerTurn: 3, culturePercent: 33, happinessPerTurn: 2 } });
export const STADIUM = building({ id: 'stadium', name: 'Stadium', era: 'modern', cost: 500, maintenance: 2, modifiers: { happinessPerTurn: 6 } });
export const MILITARY_BASE = building({ id: 'military_base', name: 'Military Base', era: 'modern', cost: 500, maintenance: 0, description: 'City defense omitted until building defense is modeled' , modifiers: { foodPerTurn: 2 }});
export const MEDICAL_LAB = building({ id: 'medical_lab', name: 'Medical Lab', era: 'modern', cost: 500, maintenance: 3, description: 'Food carryover omitted until growth modifiers exist', modifiers: { foodPerTurn: 2 , happinessPerTurn: 2} });

export const RESEARCH_LAB = building({ id: 'research_lab', name: 'Research Lab', era: 'atomic', cost: 500, maintenance: 3, modifiers: { sciencePerTurn: 4, sciencePercent: 50, happinessPerTurn: 2 } });
export const SOLAR_PLANT = building({ id: 'solar_plant', name: 'Solar Plant', era: 'atomic', cost: 360, maintenance: 3, modifiers: { productionPerTurn: 5, productionPercent: 15, happinessPerTurn: 2 }, description: 'Desert and mutual-exclusion requirements omitted' });
export const NUCLEAR_PLANT = building({ id: 'nuclear_plant', name: 'Nuclear Plant', era: 'atomic', cost: 360, maintenance: 3, modifiers: { productionPerTurn: 5, productionPercent: 15, happinessPerTurn: 2 }, description: 'Uranium and mutual-exclusion requirements omitted' });
export const HYDRO_PLANT = building({ id: 'hydro_plant', name: 'Hydro Plant', era: 'modern', cost: 500, maintenance: 3, modifiers: { productionPerTurn: 3, happinessPerTurn: 2 }, description: 'River-tile production approximated as +3 production' });
export const RECYCLING_CENTER = building({ id: 'recycling_center', name: 'Recycling Center', era: 'information', cost: 300, maintenance: 2, modifiers: { productionPerTurn: 2, happinessPerTurn: 2 }, description: 'Aluminum source effect approximated as +2 production' });
export const BOMB_SHELTER = building({ id: 'bomb_shelter', name: 'Bomb Shelter', era: 'atomic', cost: 300, maintenance: 0, description: 'Nuke damage reduction omitted', modifiers: { foodPerTurn: 2 } });
export const POLICE_STATION = building({ id: 'police_station', name: 'Police Station', era: 'modern', cost: 300, maintenance: 2, description: 'Espionage defense omitted' , modifiers: { foodPerTurn: 2 }});
export const SPACESHIP_FACTORY = building({ id: 'spaceship_factory', name: 'Spaceship Factory', era: 'information', cost: 360, maintenance: 3, modifiers: { productionPercent: 10, happinessPerTurn: 10 }, description: 'Spaceship-part production approximated as +10% production' });

export const ALL_BUILDINGS: BuildingType[] = [
  MONUMENT, GRANARY, SHRINE, BARRACKS, WALLS, WATER_MILL, STONE_WORKS,
  LIBRARY, CIRCUS, COLOSSEUM, COURTHOUSE, TEMPLE, LIGHTHOUSE, STABLE,
  CASTLE, ARMORY, FORGE, MARKET, MINT, GARDEN, UNIVERSITY, WORKSHOP, AQUEDUCT, HARBOR, OBSERVATORY,
  OPERA_HOUSE, BANK, MUSEUM, PUBLIC_SCHOOL, SEAPORT, WINDMILL, ZOO,
  MILITARY_ACADEMY, ARSENAL, FACTORY, STOCK_EXCHANGE, HOSPITAL, HOTEL,
  BROADCAST_TOWER, STADIUM, MILITARY_BASE, MEDICAL_LAB,
  RESEARCH_LAB, SOLAR_PLANT, NUCLEAR_PLANT, HYDRO_PLANT, RECYCLING_CENTER, BOMB_SHELTER, POLICE_STATION, SPACESHIP_FACTORY,
];

export function getBuildingById(id: string): BuildingType | undefined {
  return ALL_BUILDINGS.find((b) => b.id === id);
}
