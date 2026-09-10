/** Conversation navigation only; availability and effects stay in the diplomacy systems. */
export const AUDIENCE_CATEGORIES = [
  { id: 'diplomacy', label: 'Diplomacy', description: 'Borders, embassies, maps, gifts and alliances.' },
  { id: 'economy', label: 'Economy', description: 'Trade relations, sanctions and resource exploitation rights.' },
  { id: 'war', label: 'War & peace', description: 'Coordinate a war, negotiate peace or discuss sovereignty.' },
  { id: 'requests', label: 'Requests & promises', description: 'Ask for assistance or raise concerns about nearby settlements.' },
] as const;
export type AudienceCategory = typeof AUDIENCE_CATEGORIES[number]['id'];

export const CONVERSATION_CATEGORIES = [
  ...AUDIENCE_CATEGORIES,
  { id: 'gossip', label: 'Gossip', description: 'Ask questions, spread rumors or make a pointed remark.' },
] as const;
export type ConversationCategory = typeof CONVERSATION_CATEGORIES[number]['id'];
