import type { City } from '../../entities/City';
import type { Unit } from '../../entities/Unit';
import type { Tile } from '../../types/map';

export type RightSidebarPanelMode = 'details' | 'leaderboard' | 'log';
export type RightSidebarDetailsView = 'tile' | 'city' | 'unit' | 'nation' | 'leader' | null;
export type RightSidebarLeaderboardCategory = 'domination' | 'diplomacy' | 'research' | 'culture';
export type RightSidebarCityDetailsTab = 'city' | 'growth' | 'output' | 'production';
export type LeaderPanelTab = 'details' | 'diplomacy' | 'trade' | 'deals';
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

export type RightSidebarRow =
  | RightSidebarTextRow
  | RightSidebarButtonRow
  | RightSidebarProgressRow
  | RightSidebarSeparatorRow;

export interface RightSidebarSection {
  title: string;
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
