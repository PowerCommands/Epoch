export type DiplomacyRelationshipType = 'hasMet' | 'openBorders' | 'war';

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
