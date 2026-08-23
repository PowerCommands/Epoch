import type { GossipFlavorContext, GossipInsultSubtype } from './gossip';

export interface SavedGossipFlavorCooldown {
  readonly nationAId: string;
  readonly nationBId: string;
  readonly availableAtRound: number;
}

export interface SavedGossipFlavorState {
  readonly pairCooldowns: SavedGossipFlavorCooldown[];
}

export interface GossipFlavorEventResult {
  readonly trigger: GossipFlavorContext;
  readonly round: number;
  readonly speakerNationId: string;
  readonly recipientNationId: string;
  readonly insultId: string;
  readonly insultWeight: number;
  readonly insultSubtype: GossipInsultSubtype;
  readonly resolvedText: string;
  readonly historyText: string;
  readonly cityName?: string;
  readonly recipientIsHuman: boolean;
}
