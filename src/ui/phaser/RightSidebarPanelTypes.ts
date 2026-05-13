import type { City } from '../../entities/City';
import type { Unit } from '../../entities/Unit';
import type { Tile } from '../../types/map';

export type RightSidebarPanelMode = 'details' | 'leaderboard' | 'log';
export type RightSidebarDetailsView = 'tile' | 'city' | 'unit' | 'nation' | 'leader' | null;
export type RightSidebarLeaderboardCategory = 'domination' | 'diplomacy' | 'research' | 'culture';
export type RightSidebarCityDetailsTab = 'city' | 'growth' | 'output';
export type LeaderPanelTab = 'details' | 'units' | 'cities' | 'diplomacy' | 'relations' | 'trade' | 'deals';

/**
 * One row in the Relations tab, from the selected leader's perspective.
 * Numeric fields are null when the human player has not met the other
 * nation, in which case the UI renders "?" instead of a number.
 */
export interface LeaderRelationRow {
  nationId: string;
  displayName: string;
  isKnownToHuman: boolean;
  trust: number | null;
  affinity: number | null;
  fear: number | null;
  hostility: number | null;
}
export type RightSidebarLeaderDetailsTab = LeaderPanelTab;

export interface RightSidebarTextRow {
  kind: 'text';
  text: string;
  muted?: boolean;
  large?: boolean;
  color?: number;
  spritePath?: string;
}

export interface RightSidebarButtonRow {
  kind: 'button';
  text: string;
  disabled?: boolean;
  selected?: boolean;
  accentColor?: number;
  spritePath?: string;
  trailingIcon?: string;
  onClick: () => void;
}

export interface RightSidebarProgressRow {
  kind: 'progress';
  label: string;
  current: number;
  max: number;
}

export interface RightSidebarSeparatorRow {
  kind: 'separator';
}

export interface RightSidebarSearchInputRow {
  kind: 'searchInput';
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}

export interface RelationsTableRowCells {
  leader: string;
  trust: string;
  affinity: string;
  fear: string;
  hostility: string;
}

export interface RightSidebarRelationsTableRow {
  kind: 'relationsTable';
  header: RelationsTableRowCells;
  rows: RelationsTableRowCells[];
}

export type RightSidebarRow =
  | RightSidebarTextRow
  | RightSidebarButtonRow
  | RightSidebarProgressRow
  | RightSidebarSeparatorRow
  | RightSidebarSearchInputRow
  | RightSidebarRelationsTableRow;

export interface RightSidebarSection {
  title: string;
  titleRight?: string;
  rows: RightSidebarRow[];
}

export interface RightSidebarContent {
  title: string;
  sections: RightSidebarSection[];
}

export interface RightSidebarDetailsState {
  view: RightSidebarDetailsView;
  tile: Tile | null;
  city: City | null;
  unit: Unit | null;
  nationId: string | null;
  leaderId: string | null;
}
