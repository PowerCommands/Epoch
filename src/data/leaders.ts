import type { LeaderDefinition } from '../types/leader';

const LEADER_IMAGE_BASE = '/assets/sprites/leaders';

export const ALL_LEADERS: LeaderDefinition[] = [
  {
    id: 'leader_henry_v',
    name: 'Henry V',
    nationId: 'nation_england',
    title: 'King of England',
    image: `${LEADER_IMAGE_BASE}/henry-v.png`,
    description: 'A martial king remembered for disciplined campaigns and a hard edge in war.',
  },
  {
    id: 'leader_charles_vii',
    name: 'Charles VII',
    nationId: 'nation_france',
    title: 'King of France',
    image: `${LEADER_IMAGE_BASE}/charles-vi.png`,
    description: 'A cautious restorer of French authority after years of fracture.',
  },
  {
    id: 'leader_sigismund',
    name: 'Sigismund',
    nationId: 'nation_hre',
    title: 'Holy Roman Emperor',
    image: `${LEADER_IMAGE_BASE}/sigismund.png`,
    description: 'An imperial broker balancing crowns, councils, and competing princes.',
  },
  {
    id: 'leader_gustav_vasa',
    name: 'Gustav Vasa',
    nationId: 'nation_sweden',
    title: 'King of Sweden',
    image: `${LEADER_IMAGE_BASE}/gustaf-vasa.png`,
    description: 'A determined state-builder with an eye for independence and order.',
  },
  {
    id: 'leader_vytautas',
    name: 'Vytautas the Great',
    nationId: 'nation_lithuania',
    title: 'Grand Duke of Lithuania',
    image: `${LEADER_IMAGE_BASE}/vytautas-the-great.png`,
    description: 'An ambitious grand duke whose realm looks across the eastern frontier.',
  },
  {
    id: 'leader_marfa_boretskaya',
    name: 'Marfa Boretskaya',
    nationId: 'nation_novgorod',
    title: 'Posadnitsa of Novgorod',
    image: `${LEADER_IMAGE_BASE}/marfa-boretskaya.png`,
    description: 'A formidable civic figure standing for Novgorod tradition and autonomy.',
  },
  {
    id: 'leader_mehmed_ii',
    name: 'Mehmed II',
    nationId: 'nation_ottoman',
    title: 'Sultan of the Ottoman Empire',
    image: `${LEADER_IMAGE_BASE}/mehmed-i.png`,
    description: 'A conqueror-sultan with a taste for decisive campaigns and imperial ambition.',
  },
  {
    id: 'leader_isabella_i',
    name: 'Isabella I',
    nationId: 'nation_spain',
    title: 'Queen of Castile',
    image: `${LEADER_IMAGE_BASE}/isabella.png`,
    description: 'A dynastic ruler focused on unity, faith, and royal authority.',
  },
  {
    id: 'leader_abu_said_uthman_ii',
    name: 'Abu Said Uthman II',
    nationId: 'nation_morocco_empire',
    title: 'Sultan of Morocco',
    image: `${LEADER_IMAGE_BASE}/abu-al-hasan.png`,
    description: 'A Maghrebi ruler anchoring Moroccan power across western trade routes.',
  },
  {
    id: 'leader_george-washington',
    name: 'George Washinton',
    nationId: 'nation_north_america',
    title: 'President George Washington',
    image: `${LEADER_IMAGE_BASE}/george-washington.png`,
    description: 'A visionary founding father focused on liberty, stability, and national unity.',
  },
  {
    id: 'leader_mahatma-gandhi',
    name: 'Gandhi',
    nationId: 'nation_india',
    title: 'Mahatma Gandhi',
    image: `${LEADER_IMAGE_BASE}/mahatma-gandhi.png`,
    description: 'A spiritual leader focused on non-violence, civil disobedience, and national liberation.',
  },
  {
    id: 'leader_qin-shi-huang',
    name: 'Qin Shi Huang',
    nationId: 'nation_china',
    title: 'Emperor Qin Shi Huang',
    image: `${LEADER_IMAGE_BASE}/qin-shi-huang.png`,
    description: 'A spiritual leader focused on non-violence, civil disobedience, and national liberation.',
  },
  {
    id: 'leader_dom-pedro-ii',
    name: 'Dom Pedro',
    nationId: 'nation_south_america',
    title: 'Emperor Dom Pedro II',
    image: `${LEADER_IMAGE_BASE}/dom-pedro-ii.png`,
    description: 'An enlightened monarch focused on scientific progress, cultural growth, and diplomatic stability.',
  },
  {
    id: 'leader_mansa-musa',
    name: 'Mansa Musa',
    nationId: 'nation_mali_empire',
    title: 'Emperor Mansa Musa',
    image: `${LEADER_IMAGE_BASE}/mansa-musa.png`,
    description: 'A legendary sovereign focused on immense wealth, trans-Saharan trade, and intellectual enlightenment.',
  },
];

export function getLeaderByNationId(nationId: string): LeaderDefinition | undefined {
  return ALL_LEADERS.find((leader) => leader.nationId === nationId);
}

export function getLeaderById(leaderId: string): LeaderDefinition | undefined {
  return ALL_LEADERS.find((leader) => leader.id === leaderId);
}
