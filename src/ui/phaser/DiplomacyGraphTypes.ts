export type DiplomacyRelationshipType = 'hasMet' | 'embassy' | 'openBorders' | 'trade' | 'ally' | 'war';

export interface DiplomacyGraphNode {
  nationId: string;
  name: string;
  color: number;
}

export interface DiplomacyGraphEdge {
  fromNationId: string;
  toNationId: string;
  type: DiplomacyRelationshipType;
}

export interface DiplomacyGraph {
  nodes: DiplomacyGraphNode[];
  edges: DiplomacyGraphEdge[];
}
