export type Era =
  | 'ancient'
  | 'classical'
  | 'medieval'
  | 'renaissance'
  | 'industrial'
  | 'modern'
  | 'atomic'
  | 'information'
  | 'future';

export type TechnologyUnlockKind = 'unit' | 'building' | 'improvement';

export interface TechnologyUnlock {
  kind: TechnologyUnlockKind;
  id: string;
}

export interface TechnologyDefinition {
  id: string;
  name: string;
  era: Era;
  cost: number;
  prerequisites: string[];
  leadsTo: string[];
  unlocks: TechnologyUnlock[];
}

export const ALL_TECHNOLOGIES: TechnologyDefinition[] = [
  {
    id: 'agriculture',
    name: 'Agriculture',
    era: 'ancient',
    cost: 20,
    prerequisites: [],
    leadsTo: ['pottery', 'animal_husbandry', 'archery', 'mining'],
    unlocks: [{ kind: 'improvement', id: 'farm' }],
  },
  {
    id: 'pottery',
    name: 'Pottery',
    era: 'ancient',
    cost: 35,
    prerequisites: ['agriculture'],
    leadsTo: ['sailing', 'calendar', 'writing'],
    unlocks: [{ kind: 'building', id: 'granary' }, { kind: 'building', id: 'shrine' }],
  },
  {
    id: 'animal_husbandry',
    name: 'Animal Husbandry',
    era: 'ancient',
    cost: 35,
    prerequisites: ['agriculture'],
    leadsTo: ['trapping', 'the_wheel'],
    unlocks: [{ kind: 'unit', id: 'caravan' }],
    // TODO: reveals Horses, unlocks Pasture improvement.
  },
  {
    id: 'archery',
    name: 'Archery',
    era: 'ancient',
    cost: 35,
    prerequisites: ['agriculture'],
    leadsTo: ['mathematics'],
    unlocks: [{ kind: 'unit', id: 'archer' }],
    // TODO: unlocks Temple of Artemis wonder.
  },
  {
    id: 'mining',
    name: 'Mining',
    era: 'ancient',
    cost: 35,
    prerequisites: ['agriculture'],
    leadsTo: ['masonry', 'bronze_working'],
    unlocks: [{ kind: 'improvement', id: 'mine' }],
    // TODO: unlocks forest chopping.
  },
  {
    id: 'sailing',
    name: 'Sailing',
    era: 'ancient',
    cost: 55,
    prerequisites: ['pottery'],
    leadsTo: ['optics'],
    unlocks: [{ kind: 'unit', id: 'work_boat' }, { kind: 'unit', id: 'fishing_boat' }, { kind: 'unit', id: 'trireme' }, { kind: 'unit', id: 'cargo_ship' }],
    // TODO: unlocks Great Lighthouse wonder and Fishing Boat improvement.
  },
  {
    id: 'calendar',
    name: 'Calendar',
    era: 'ancient',
    cost: 70,
    prerequisites: ['pottery'],
    leadsTo: ['philosophy'],
    unlocks: [{ kind: 'building', id: 'stone_works' }, { kind: 'improvement', id: 'plantation' }],
    // TODO: unlocks Stonehenge wonder.
  },
  {
    id: 'writing',
    name: 'Writing',
    era: 'ancient',
    cost: 55,
    prerequisites: ['pottery'],
    leadsTo: ['philosophy', 'drama_and_poetry'],
    unlocks: [{ kind: 'building', id: 'library' }],
    // TODO: unlocks Great Library wonder and open border agreements.
  },
  {
    id: 'trapping',
    name: 'Trapping',
    era: 'ancient',
    cost: 55,
    prerequisites: ['animal_husbandry'],
    leadsTo: [],
    unlocks: [{ kind: 'building', id: 'circus' }],
    // TODO: unlocks Trading Post and Camp improvements.
  },
  {
    id: 'the_wheel',
    name: 'The Wheel',
    era: 'ancient',
    cost: 55,
    prerequisites: ['animal_husbandry'],
    leadsTo: ['horseback_riding', 'mathematics'],
    unlocks: [{ kind: 'unit', id: 'chariot_archer' }, { kind: 'building', id: 'water_mill' }],
    // TODO: unlocks Road improvement.
  },
  {
    id: 'masonry',
    name: 'Masonry',
    era: 'ancient',
    cost: 55,
    prerequisites: ['mining'],
    leadsTo: ['construction'],
    unlocks: [{ kind: 'building', id: 'walls' }],
    // TODO: unlocks Pyramids and Mausoleum of Halicarnassus wonders, Quarry improvement, marsh removal.
  },
  {
    id: 'bronze_working',
    name: 'Bronze Working',
    era: 'ancient',
    cost: 55,
    prerequisites: ['mining'],
    leadsTo: ['iron_working'],
    unlocks: [{ kind: 'unit', id: 'spearman' }, { kind: 'building', id: 'barracks' }],
    // TODO: unlocks Colossus and Statue of Zeus wonders, jungle chopping.
  },
  {
    id: 'optics',
    name: 'Optics',
    era: 'classical',
    cost: 85,
    prerequisites: ['sailing'],
    leadsTo: ['compass'],
    unlocks: [{ kind: 'building', id: 'lighthouse' }],
    // TODO: unlocks unit embarkation.
  },
  {
    id: 'philosophy',
    name: 'Philosophy',
    era: 'classical',
    cost: 105,
    prerequisites: ['calendar', 'writing'],
    leadsTo: ['theology'],
    unlocks: [{ kind: 'building', id: 'temple' }],
    // TODO: unlocks National College, National Epic, Oracle, research agreements.
  },
  {
    id: 'drama_and_poetry',
    name: 'Drama and Poetry',
    era: 'classical',
    cost: 175,
    prerequisites: ['writing'],
    leadsTo: ['theology', 'civil_service'],
    unlocks: [],
    // TODO: unlocks Amphitheater and Writers' Guild when those buildings exist.
  },
  {
    id: 'horseback_riding',
    name: 'Horseback Riding',
    era: 'classical',
    cost: 105,
    prerequisites: ['the_wheel'],
    leadsTo: ['civil_service'],
    unlocks: [{ kind: 'unit', id: 'horseman' }, { kind: 'building', id: 'stable' }],
  },
  {
    id: 'mathematics',
    name: 'Mathematics',
    era: 'classical',
    cost: 105,
    prerequisites: ['the_wheel', 'archery'],
    leadsTo: ['currency', 'engineering'],
    unlocks: [{ kind: 'unit', id: 'catapult' }, { kind: 'building', id: 'courthouse' }],
    // TODO: unlocks Hanging Gardens wonder.
  },
  {
    id: 'construction',
    name: 'Construction',
    era: 'classical',
    cost: 105,
    prerequisites: ['masonry'],
    leadsTo: ['engineering'],
    unlocks: [{ kind: 'unit', id: 'composite_bowman' }, { kind: 'building', id: 'colosseum' }, { kind: 'improvement', id: 'lumber_mill' }],
    // TODO: unlocks Circus Maximus and Great Wall wonders.
  },
  {
    id: 'iron_working',
    name: 'Iron Working',
    era: 'classical',
    cost: 160,
    prerequisites: ['bronze_working'],
    leadsTo: ['metal_casting'],
    unlocks: [{ kind: 'unit', id: 'swordsman' }],
    // TODO: unlocks Heroic Epic and reveals Iron.
  },
  {
    id: 'theology',
    name: 'Theology',
    era: 'medieval',
    cost: 275,
    prerequisites: ['drama_and_poetry', 'philosophy'],
    leadsTo: ['education', 'compass'],
    unlocks: [{ kind: 'building', id: 'garden' }],
    // TODO: unlocks Monastery, Angkor Wat and Hagia Sophia.
  },
  {
    id: 'civil_service',
    name: 'Civil Service',
    era: 'medieval',
    cost: 440,
    prerequisites: ['drama_and_poetry', 'horseback_riding', 'currency'],
    leadsTo: ['education', 'chivalry'],
    unlocks: [{ kind: 'unit', id: 'pikeman' }],
    // TODO: unlocks Chichen Itza and fresh-water farm yield.
  },
  {
    id: 'currency',
    name: 'Currency',
    era: 'medieval',
    cost: 275,
    prerequisites: ['mathematics'],
    leadsTo: ['civil_service', 'guilds'],
    unlocks: [{ kind: 'building', id: 'mint' }, { kind: 'building', id: 'market' }],
    // TODO: unlocks National Treasury, Machu Picchu and Wealth conversion.
  },
  {
    id: 'engineering',
    name: 'Engineering',
    era: 'medieval',
    cost: 275,
    prerequisites: ['mathematics', 'construction'],
    leadsTo: ['machinery', 'physics'],
    unlocks: [{ kind: 'building', id: 'aqueduct' }],
    // TODO: unlocks Fort improvement and bridge movement.
  },
  {
    id: 'metal_casting',
    name: 'Metal Casting',
    era: 'medieval',
    cost: 275,
    prerequisites: ['iron_working'],
    leadsTo: ['physics', 'steel'],
    unlocks: [{ kind: 'building', id: 'forge' }, { kind: 'building', id: 'workshop' }],
  },
  {
    id: 'compass',
    name: 'Compass',
    era: 'medieval',
    cost: 375,
    prerequisites: ['optics', 'theology'],
    leadsTo: ['astronomy'],
    unlocks: [{ kind: 'unit', id: 'galleass' }, { kind: 'building', id: 'harbor' }],
    // TODO: unlocks +1 gold from Fishing Boats.
  },
  {
    id: 'guilds',
    name: 'Guilds',
    era: 'medieval',
    cost: 275,
    prerequisites: ['currency'],
    leadsTo: ['machinery', 'chivalry'],
    unlocks: [],
    // TODO: unlocks Trading Post, Artists' Guild and trade-route conversion when those systems exist.
  },
  {
    id: 'education',
    name: 'Education',
    era: 'medieval',
    cost: 485,
    prerequisites: ['theology', 'civil_service'],
    leadsTo: ['astronomy', 'acoustics', 'banking'],
    unlocks: [{ kind: 'building', id: 'university' }],
    // TODO: unlocks Oxford University, Notre Dame, Porcelain Tower and Research conversion.
  },
  {
    id: 'chivalry',
    name: 'Chivalry',
    era: 'medieval',
    cost: 485,
    prerequisites: ['civil_service', 'guilds'],
    leadsTo: ['banking', 'printing_press'],
    unlocks: [{ kind: 'unit', id: 'knight' }, { kind: 'building', id: 'castle' }],
    // TODO: unlocks Himeji Castle and defensive pacts.
  },
  {
    id: 'machinery',
    name: 'Machinery',
    era: 'medieval',
    cost: 485,
    prerequisites: ['engineering', 'guilds'],
    leadsTo: ['printing_press'],
    unlocks: [{ kind: 'unit', id: 'crossbowman' }, { kind: 'building', id: 'armory' }],
    // TODO: unlocks Ironworks and faster road movement.
  },
  {
    id: 'physics',
    name: 'Physics',
    era: 'medieval',
    cost: 485,
    prerequisites: ['engineering', 'metal_casting'],
    leadsTo: ['printing_press', 'gunpowder'],
    unlocks: [{ kind: 'unit', id: 'trebuchet' }],
  },
  {
    id: 'steel',
    name: 'Steel',
    era: 'medieval',
    cost: 485,
    prerequisites: ['metal_casting'],
    leadsTo: ['gunpowder'],
    unlocks: [{ kind: 'unit', id: 'longswordsman' }],
  },
  {
    id: 'astronomy',
    name: 'Astronomy',
    era: 'renaissance',
    cost: 780,
    prerequisites: ['compass', 'education'],
    leadsTo: ['navigation'],
    unlocks: [{ kind: 'unit', id: 'caravel' }, { kind: 'unit', id: 'transport_ship' }, { kind: 'building', id: 'observatory' }],
    // TODO: unlocks embarked ocean travel and embarked movement.
  },
  {
    id: 'acoustics',
    name: 'Acoustics',
    era: 'renaissance',
    cost: 780,
    prerequisites: ['education'],
    leadsTo: ['architecture'],
    unlocks: [{ kind: 'building', id: 'opera_house' }],
    // TODO: unlocks Hermitage, Sistine Chapel and Kremlin wonders.
  },
  {
    id: 'banking',
    name: 'Banking',
    era: 'renaissance',
    cost: 780,
    prerequisites: ['education', 'chivalry'],
    leadsTo: ['economics', 'architecture'],
    unlocks: [{ kind: 'building', id: 'bank' }],
    // TODO: unlocks Forbidden Palace wonder.
  },
  {
    id: 'printing_press',
    name: 'Printing Press',
    era: 'renaissance',
    cost: 780,
    prerequisites: ['machinery', 'physics', 'chivalry'],
    leadsTo: ['economics', 'metallurgy'],
    unlocks: [{ kind: 'building', id: 'zoo' }],
    // TODO: unlocks Taj Mahal wonder and World Congress.
  },
  {
    id: 'gunpowder',
    name: 'Gunpowder',
    era: 'renaissance',
    cost: 840,
    prerequisites: ['physics', 'steel'],
    leadsTo: ['chemistry', 'metallurgy'],
    unlocks: [{ kind: 'unit', id: 'musketman' }],
  },
  {
    id: 'navigation',
    name: 'Navigation',
    era: 'renaissance',
    cost: 1080,
    prerequisites: ['astronomy'],
    leadsTo: ['archaeology'],
    unlocks: [{ kind: 'unit', id: 'frigate' }, { kind: 'unit', id: 'privateer' }, { kind: 'building', id: 'seaport' }],
  },
  {
    id: 'economics',
    name: 'Economics',
    era: 'renaissance',
    cost: 1080,
    prerequisites: ['banking', 'printing_press'],
    leadsTo: ['scientific_theory', 'industrialization', 'rifling'],
    unlocks: [{ kind: 'building', id: 'windmill' }],
    // TODO: unlocks Big Ben and trading-post/camp/customs-house gold yields.
  },
  {
    id: 'chemistry',
    name: 'Chemistry',
    era: 'renaissance',
    cost: 1080,
    prerequisites: ['gunpowder'],
    leadsTo: ['military_science', 'fertilizer'],
    unlocks: [{ kind: 'unit', id: 'cannon' }],
    // TODO: unlocks mine/quarry/manufactory production yield.
  },
  {
    id: 'metallurgy',
    name: 'Metallurgy',
    era: 'renaissance',
    cost: 1080,
    prerequisites: ['gunpowder', 'printing_press'],
    leadsTo: ['rifling', 'military_science'],
    unlocks: [{ kind: 'unit', id: 'lancer' }, { kind: 'building', id: 'arsenal' }],
  },
  {
    id: 'architecture',
    name: 'Architecture',
    era: 'renaissance',
    cost: 1150,
    prerequisites: ['acoustics', 'banking'],
    leadsTo: ['archaeology', 'scientific_theory'],
    unlocks: [],
    // TODO: unlocks Hermitage, Porcelain Tower, Taj Mahal and Uffizi when wonders exist.
  },
  {
    id: 'archaeology',
    name: 'Archaeology',
    era: 'renaissance',
    cost: 1560,
    prerequisites: ['navigation', 'architecture'],
    leadsTo: ['biology'],
    unlocks: [{ kind: 'unit', id: 'archaeologist' }, { kind: 'building', id: 'museum' }],
    // TODO: unlocks Louvre and archaeological dig system.
  },
  {
    id: 'scientific_theory',
    name: 'Scientific Theory',
    era: 'renaissance',
    cost: 1560,
    prerequisites: ['economics', 'architecture'],
    leadsTo: ['biology', 'steam_power', 'electricity'],
    unlocks: [{ kind: 'building', id: 'public_school' }],
    // TODO: reveals Coal and improves Lumber Mills/Academies.
  },
  {
    id: 'military_science',
    name: 'Military Science',
    era: 'renaissance',
    cost: 1560,
    prerequisites: ['chemistry', 'metallurgy'],
    leadsTo: ['dynamite'],
    unlocks: [{ kind: 'unit', id: 'cavalry' }, { kind: 'building', id: 'military_academy' }],
    // TODO: unlocks Brandenburg Gate wonder.
  },
  {
    id: 'fertilizer',
    name: 'Fertilizer',
    era: 'renaissance',
    cost: 1560,
    prerequisites: ['chemistry'],
    leadsTo: ['dynamite'],
    unlocks: [],
    // TODO: improves Farms, Plantations and Pastures.
  },
  {
    id: 'rifling',
    name: 'Rifling',
    era: 'renaissance',
    cost: 1710,
    prerequisites: ['metallurgy', 'economics'],
    leadsTo: ['steam_power', 'dynamite'],
    unlocks: [{ kind: 'unit', id: 'rifleman' }],
  },
  {
    id: 'biology',
    name: 'Biology',
    era: 'industrial',
    cost: 2350,
    prerequisites: ['archaeology', 'scientific_theory'],
    leadsTo: ['refrigeration'],
    unlocks: [{ kind: 'building', id: 'hospital' }],
    // TODO: reveals Oil and unlocks Oil Well improvement.
  },
  {
    id: 'steam_power',
    name: 'Steam Power',
    era: 'industrial',
    cost: 2350,
    prerequisites: ['scientific_theory', 'industrialization', 'rifling'],
    leadsTo: ['flight', 'replaceable_parts', 'railroad'],
    unlocks: [{ kind: 'unit', id: 'ironclad' }],
    // TODO: unlocks embarked movement bonus.
  },
  {
    id: 'industrialization',
    name: 'Industrialization',
    era: 'industrial',
    cost: 1600,
    prerequisites: ['economics'],
    leadsTo: ['steam_power'],
    unlocks: [{ kind: 'unit', id: 'gatling_gun' }, { kind: 'building', id: 'factory' }],
    // TODO: reveals Coal and unlocks Big Ben when resources/wonders exist.
  },
  {
    id: 'dynamite',
    name: 'Dynamite',
    era: 'industrial',
    cost: 2660,
    prerequisites: ['fertilizer', 'military_science', 'rifling'],
    leadsTo: ['railroad'],
    unlocks: [{ kind: 'unit', id: 'artillery' }],
  },
  {
    id: 'electricity',
    name: 'Electricity',
    era: 'industrial',
    cost: 2660,
    prerequisites: ['scientific_theory'],
    leadsTo: ['refrigeration', 'radio', 'replaceable_parts'],
    unlocks: [{ kind: 'building', id: 'hydro_plant' }, { kind: 'building', id: 'stock_exchange' }, { kind: 'building', id: 'police_station' }],
    // TODO: reveals Aluminum.
  },
  {
    id: 'replaceable_parts',
    name: 'Replaceable Parts',
    era: 'industrial',
    cost: 2660,
    prerequisites: ['electricity', 'steam_power'],
    leadsTo: ['plastics', 'electronics'],
    unlocks: [{ kind: 'unit', id: 'great_war_infantry' }, { kind: 'building', id: 'military_base' }],
    // TODO: unlocks Statue of Liberty wonder.
  },
  {
    id: 'railroad',
    name: 'Railroad',
    era: 'industrial',
    cost: 2660,
    prerequisites: ['steam_power', 'dynamite'],
    leadsTo: ['combustion', 'ballistics'],
    unlocks: [],
    // TODO: unlocks Railroad improvement.
  },
  {
    id: 'refrigeration',
    name: 'Refrigeration',
    era: 'industrial',
    cost: 3100,
    prerequisites: ['biology', 'electricity'],
    leadsTo: ['penicillin'],
    unlocks: [{ kind: 'unit', id: 'submarine' }, { kind: 'building', id: 'stadium' }, { kind: 'building', id: 'hotel' }],
    // TODO: unlocks Offshore Platform construction.
  },
  {
    id: 'radio',
    name: 'Radio',
    era: 'industrial',
    cost: 3100,
    prerequisites: ['electricity'],
    leadsTo: ['plastics'],
    unlocks: [{ kind: 'building', id: 'broadcast_tower' }],
    // TODO: unlocks Eiffel Tower wonder.
  },
  {
    id: 'flight',
    name: 'Flight',
    era: 'industrial',
    cost: 3100,
    prerequisites: ['steam_power'],
    leadsTo: ['electronics', 'ballistics'],
    unlocks: [{ kind: 'unit', id: 'triplane' }, { kind: 'unit', id: 'great_war_bomber' }],
  },
  {
    id: 'combustion',
    name: 'Combustion',
    era: 'industrial',
    cost: 3100,
    prerequisites: ['railroad'],
    leadsTo: ['combined_arms'],
    unlocks: [{ kind: 'unit', id: 'destroyer' }, { kind: 'unit', id: 'landship' }],
  },
  {
    id: 'ballistics',
    name: 'Ballistics',
    era: 'modern',
    cost: 4100,
    prerequisites: ['flight', 'railroad'],
    leadsTo: ['radar', 'combined_arms'],
    unlocks: [{ kind: 'unit', id: 'anti_aircraft_gun' }, { kind: 'unit', id: 'machine_gun' }],
  },
  {
    id: 'plastics',
    name: 'Plastics',
    era: 'modern',
    cost: 4700,
    prerequisites: ['radio', 'replaceable_parts'],
    leadsTo: ['penicillin', 'atomic_theory'],
    unlocks: [{ kind: 'unit', id: 'infantry' }, { kind: 'building', id: 'research_lab' }],
  },
  {
    id: 'penicillin',
    name: 'Penicillin',
    era: 'modern',
    cost: 4700,
    prerequisites: ['refrigeration', 'plastics'],
    leadsTo: ['ecology'],
    unlocks: [{ kind: 'building', id: 'medical_lab' }],
    // TODO: unlocks Marine unit omitted from requested unit set.
  },
  {
    id: 'electronics',
    name: 'Electronics',
    era: 'modern',
    cost: 4700,
    prerequisites: ['replaceable_parts', 'flight'],
    leadsTo: ['atomic_theory', 'radar'],
    unlocks: [{ kind: 'unit', id: 'carrier' }, { kind: 'unit', id: 'battleship' }],
  },
  {
    id: 'radar',
    name: 'Radar',
    era: 'modern',
    cost: 4700,
    prerequisites: ['ballistics', 'electronics'],
    leadsTo: ['rocketry', 'nuclear_fission', 'computers'],
    unlocks: [{ kind: 'unit', id: 'fighter' }, { kind: 'unit', id: 'bomber' }, { kind: 'unit', id: 'paratrooper' }],
    // TODO: unlocks Pentagon wonder.
  },
  {
    id: 'atomic_theory',
    name: 'Atomic Theory',
    era: 'modern',
    cost: 4700,
    prerequisites: ['electronics', 'plastics'],
    leadsTo: ['ecology', 'nuclear_fission'],
    unlocks: [],
    // TODO: reveals Uranium and unlocks Manhattan Project.
  },
  {
    id: 'ecology',
    name: 'Ecology',
    era: 'modern',
    cost: 5400,
    prerequisites: ['atomic_theory', 'penicillin'],
    leadsTo: ['mobile_tactics', 'telecommunications'],
    unlocks: [{ kind: 'building', id: 'solar_plant' }, { kind: 'building', id: 'recycling_center' }],
  },
  {
    id: 'combined_arms',
    name: 'Combined Arms',
    era: 'atomic',
    cost: 5100,
    prerequisites: ['combustion', 'ballistics'],
    leadsTo: ['computers'],
    unlocks: [{ kind: 'unit', id: 'tank' }, { kind: 'unit', id: 'anti_tank_gun' }],
    // TODO: unlocks Pentagon when wonders exist.
  },
  {
    id: 'computers',
    name: 'Computers',
    era: 'modern',
    cost: 5400,
    prerequisites: ['radar', 'combined_arms'],
    leadsTo: ['robotics', 'lasers'],
    unlocks: [{ kind: 'unit', id: 'helicopter_gunship' }],
  },
  {
    id: 'rocketry',
    name: 'Rocketry',
    era: 'modern',
    cost: 5400,
    prerequisites: ['radar'],
    leadsTo: ['satellites'],
    unlocks: [{ kind: 'unit', id: 'rocket_artillery' }, { kind: 'unit', id: 'mobile_sam' }],
    // TODO: unlocks Apollo Program.
  },
  {
    id: 'lasers',
    name: 'Lasers',
    era: 'modern',
    cost: 5400,
    prerequisites: ['computers'],
    leadsTo: ['stealth'],
    unlocks: [{ kind: 'unit', id: 'jet_fighter' }, { kind: 'unit', id: 'modern_armor' }],
  },
  {
    id: 'nuclear_fission',
    name: 'Nuclear Fission',
    era: 'modern',
    cost: 5400,
    prerequisites: ['atomic_theory', 'radar'],
    leadsTo: ['advanced_ballistics', 'mobile_tactics'],
    unlocks: [{ kind: 'unit', id: 'atomic_bomb' }, { kind: 'unit', id: 'bazooka' }, { kind: 'building', id: 'nuclear_plant' }],
  },
  {
    id: 'globalization',
    name: 'Globalization',
    era: 'modern',
    cost: 6000,
    prerequisites: ['telecommunications'],
    leadsTo: ['particle_physics'],
    unlocks: [],
    // TODO: unlocks United Nations.
  },
  {
    id: 'robotics',
    name: 'Robotics',
    era: 'modern',
    cost: 6000,
    prerequisites: ['computers'],
    leadsTo: ['particle_physics'],
    unlocks: [{ kind: 'unit', id: 'missile_cruiser' }, { kind: 'building', id: 'spaceship_factory' }],
    // TODO: unlocks SS Booster.
  },
  {
    id: 'mobile_tactics',
    name: 'Mobile Tactics',
    era: 'information',
    cost: 7700,
    prerequisites: ['ecology', 'nuclear_fission'],
    leadsTo: ['particle_physics'],
    unlocks: [{ kind: 'unit', id: 'mechanized_infantry' }],
  },
  {
    id: 'satellites',
    name: 'Satellites',
    era: 'modern',
    cost: 6000,
    prerequisites: ['rocketry'],
    leadsTo: ['particle_physics', 'nuclear_fusion'],
    unlocks: [{ kind: 'unit', id: 'guided_missile' }],
    // TODO: unlocks SS Cockpit and map reveal.
  },
  {
    id: 'stealth',
    name: 'Stealth',
    era: 'modern',
    cost: 6000,
    prerequisites: ['lasers'],
    leadsTo: ['nuclear_fusion'],
    unlocks: [{ kind: 'unit', id: 'stealth_bomber' }],
  },
  {
    id: 'advanced_ballistics',
    name: 'Advanced Ballistics',
    era: 'modern',
    cost: 6000,
    prerequisites: ['nuclear_fission'],
    leadsTo: ['nuclear_fusion'],
    unlocks: [{ kind: 'unit', id: 'guided_missile' }, { kind: 'unit', id: 'nuclear_missile' }],
  },
  {
    id: 'telecommunications',
    name: 'Telecommunications',
    era: 'information',
    cost: 7700,
    prerequisites: ['ecology'],
    leadsTo: ['globalization', 'particle_physics', 'the_internet'],
    unlocks: [{ kind: 'unit', id: 'nuclear_submarine' }, { kind: 'building', id: 'bomb_shelter' }],
    // TODO: unlocks National Visitor Center and CN Tower when those buildings/wonders exist.
  },
  {
    id: 'particle_physics',
    name: 'Particle Physics',
    era: 'future',
    cost: 6000,
    prerequisites: ['globalization', 'robotics', 'satellites', 'mobile_tactics', 'telecommunications'],
    leadsTo: ['nanotechnology'],
    unlocks: [],
    // TODO: unlocks SS Engine.
  },
  {
    id: 'nuclear_fusion',
    name: 'Nuclear Fusion',
    era: 'future',
    cost: 6500,
    prerequisites: ['satellites', 'stealth', 'advanced_ballistics'],
    leadsTo: ['future_tech'],
    unlocks: [{ kind: 'unit', id: 'giant_death_robot' }],
  },
  {
    id: 'nanotechnology',
    name: 'Nanotechnology',
    era: 'future',
    cost: 6000,
    prerequisites: ['particle_physics'],
    leadsTo: ['future_tech'],
    unlocks: [{ kind: 'unit', id: 'xcom_squad' }],
    // TODO: unlocks SS Stasis Chamber.
  },
  {
    id: 'the_internet',
    name: 'The Internet',
    era: 'information',
    cost: 8800,
    prerequisites: ['telecommunications'],
    leadsTo: ['future_tech'],
    unlocks: [],
    // TODO: doubles Tourism output when Tourism exists.
  },
  {
    id: 'future_tech',
    name: 'Future Tech',
    era: 'future',
    cost: 7000,
    prerequisites: ['nanotechnology', 'nuclear_fusion', 'the_internet'],
    leadsTo: [],
    unlocks: [],
  },
];

export function getTechnologyById(id: string): TechnologyDefinition | undefined {
  return ALL_TECHNOLOGIES.find((technology) => technology.id === id);
}

export function hasTechnologyDefinition(id: string): boolean {
  return getTechnologyById(id) !== undefined;
}
