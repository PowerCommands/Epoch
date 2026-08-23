export const GOSSIP_PLACEHOLDERS = [
  'sourceNationName',
  'sourceLeaderName',
  'recipientNationName',
  'recipientLeaderName',
  'targetNationName',
  'targetLeaderName',
] as const;

export type GossipPlaceholder = typeof GOSSIP_PLACEHOLDERS[number];
export type GossipTextContext = Partial<Record<GossipPlaceholder, string>>;

const KNOWN_PLACEHOLDERS = new Set<string>(GOSSIP_PLACEHOLDERS);

/** Resolves centralized Gossip templates. Unknown or missing tokens stay visible. */
export function formatGossipText(template: string, context: GossipTextContext): string {
  return template.replace(/\{([^{}]+)\}/g, (token, key: string) => {
    if (!KNOWN_PLACEHOLDERS.has(key)) return token;
    return context[key as GossipPlaceholder] ?? token;
  });
}

