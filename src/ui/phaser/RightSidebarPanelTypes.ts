import type { City } from '../../entities/City';
import type { Unit } from '../../entities/Unit';
import type { Tile } from '../../types/map';

export type RightSidebarPanelMode = 'details' | 'leaderboard' | 'timeline' | 'diplomacy-graph';
export type RightSidebarDetailsView = 'tile' | 'city' | 'unit' | 'nation' | 'leader' | null;
export type RightSidebarLeaderboardCategory = 'domination' | 'diplomacy' | 'research' | 'cultural' | 'gon';
export type RightSidebarCityDetailsTab = 'city' | 'growth' | 'output';
export type LeaderPanelTab = 'details' | 'units' | 'cities' | 'diplomacy' | 'relations' | 'economics' | 'trade' | 'deals';

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
  disabledReason?: string;
  selected?: boolean;
  accentColor?: number;
  spritePath?: string;
  trailingIcon?: string;
  onClick: () => void;
}

/** One button inside a {@link RightSidebarButtonGroupRow}. */
export interface ButtonGroupItem {
  text: string;
  disabled?: boolean;
  disabledReason?: string;
  selected?: boolean;
  accentColor?: number;
  onClick: () => void;
}

/** Several buttons rendered side by side on a single row (evenly splitting the width). */
export interface RightSidebarButtonGroupRow {
  kind: 'buttonGroup';
  buttons: ButtonGroupItem[];
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

export interface CompactTableColumn {
  label: string;
  weight: number;
  align?: 'left' | 'center' | 'right';
}

export interface RightSidebarCompactTableRow {
  kind: 'compactTable';
  columns: CompactTableColumn[];
  rows: string[][];
}

/** One selectable city in a {@link RightSidebarCityPairPickerRow} column. */
export interface CityPickerItem {
  id: string;
  label: string;
  disabled?: boolean;
  /** Shown on disabled cities to explain why they cannot be selected. */
  disabledReason?: string;
  selected?: boolean;
  onClick: () => void;
}

/**
 * Side-by-side city selector for proposing a trade route: the human's cities on
 * the left, the target nation's cities on the right. The player picks one from
 * each column, making the proposed connection visually obvious.
 */
export interface RightSidebarCityPairPickerRow {
  kind: 'cityPairPicker';
  leftHeader: string;
  rightHeader: string;
  leftItems: CityPickerItem[];
  rightItems: CityPickerItem[];
  emptyLabel: string;
  accentColor?: number;
}

export type RightSidebarRow =
  | RightSidebarTextRow
  | RightSidebarButtonRow
  | RightSidebarButtonGroupRow
  | RightSidebarProgressRow
  | RightSidebarSeparatorRow
  | RightSidebarSearchInputRow
  | RightSidebarRelationsTableRow
  | RightSidebarCompactTableRow
  | RightSidebarCityPairPickerRow;

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
