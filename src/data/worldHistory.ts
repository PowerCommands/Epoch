import type { Producible } from '../types/producible';
import { ALL_TECHNOLOGIES, type Era } from './technologies';
import { CULTURE_TREE } from './cultureTree';

export const WORLD_FIRSTS: ReadonlyArray<{
  id: string; headline: string; body: string; imagePath: string;
  matches: (item: Producible) => boolean;
}> = [
  { id: 'ship', headline: 'HUMANITY TAKES TO THE SEAS', body: 'The first ship has been built. Coastlines that once marked the edge of the familiar world now promise new routes for discovery, commerce, and war.', imagePath: '/assets/sprites/techs/sailing.png', matches: i => i.kind === 'unit' && !!i.unitType.isNaval },
  { id: 'aircraft', headline: 'THE AGE OF FLIGHT BEGINS', body: 'The first aircraft has been built. The sky has become a new frontier, carrying the promise of distant journeys and a new dimension of warfare.', imagePath: '/assets/sprites/techs/flight.png', matches: i => i.kind === 'unit' && !!i.unitType.aircraftRole },
  { id: 'hospital', headline: 'A NEW HOME FOR HEALING', body: 'The first Hospital has opened its doors. Organized medical care gives crowded cities a new defense against illness and makes public health a lasting civic responsibility.', imagePath: '/assets/sprites/buildings/hospital.png', matches: i => i.kind === 'building' && i.buildingType.id === 'hospital' },
  { id: 'atomic_bomb', headline: 'THE ATOM BECOMES A WEAPON', body: 'The first Atomic Bomb has been created. A discovery of extraordinary scientific power now casts a shadow over every capital: a single weapon can devastate an entire region.', imagePath: '/assets/sprites/techs/nuclear_fission.png', matches: i => i.kind === 'unit' && i.unitType.id === 'atomic_bomb' },
  { id: 'nuclear_missile', headline: 'NUCLEAR WARFARE ENTERS THE MISSILE AGE', body: 'The first Nuclear Missile has been created. Destructive power can now cross great distances without a bomber, changing the calculations of war and diplomacy throughout the world.', imagePath: '/assets/sprites/techs/rocketry.png', matches: i => i.kind === 'unit' && i.unitType.id === 'nuclear_missile' },
];

export const WORLD_ERAS: Record<Era, { headline: string; body: string }> = {
  ancient: { headline: 'THE AGE OF CIVILIZATIONS BEGINS', body: 'Fields, workshops, and written laws gather scattered communities into lasting cities. The first states begin to shape the world.' },
  classical: { headline: 'THE CLASSICAL AGE DAWNS', body: 'Cities become centers of philosophy, public spectacle, and imperial ambition. Disciplined armies and new forms of government will test the strength of young civilizations.' },
  medieval: { headline: 'THE MEDIEVAL AGE BEGINS', body: 'Faith, land, and loyalty bind a changing world. Fortified realms, guilds, and learned institutions grow as rulers seek authority over distant provinces.' },
  renaissance: { headline: 'A RENAISSANCE TRANSFORMS THE WORLD', body: 'Explorers widen the horizon while scholars question inherited knowledge. Ocean voyages, professional diplomacy, and gunpowder promise to redraw the map of power.' },
  industrial: { headline: 'THE INDUSTRIAL AGE BEGINS', body: 'Steam and machinery change the scale of human labor. Factories and railways draw growing cities together as industrial armies and new social institutions transform daily life.' },
  modern: { headline: 'THE MODERN AGE DAWNS', body: 'Electricity, mass communication, and flight bring distant societies into closer contact. Mechanized warfare and international institutions will shape an increasingly connected world.' },
  atomic: { headline: 'THE ATOMIC AGE BEGINS', body: 'Science reaches into the heart of matter. Atomic energy promises abundance while nuclear weapons threaten devastation; research and diplomacy now carry consequences for all humanity.' },
  information: { headline: 'THE INFORMATION AGE DAWNS', body: 'Computers and global networks carry ideas across borders in an instant. Advanced weapons, worldwide commerce, and new cultural connections reshape national power.' },
  future: { headline: 'HUMANITY ENTERS A NEW FRONTIER', body: 'New sources of energy and extraordinary technologies open possibilities once confined to imagination. The next chapter asks what civilization will choose to build with them.' },
};
export function eraArticleBody(era: Era): string {
  const technologies = ALL_TECHNOLOGIES.filter(t => t.era === era).slice(0, 2).map(t => t.name);
  const cultures = CULTURE_TREE.filter(c => c.era === era).slice(0, 2).map(c => c.name);
  return `${WORLD_ERAS[era].body} On the horizon: ${[...technologies, ...cultures].join(', ')}.`;
}
