import type { City } from '../../entities/City';
import type { Unit } from '../../entities/Unit';
import type { Tile } from '../../types/map';

// 'details' is the map-selection view (tile/city/unit), shown only in the
// centered minimap popup. 'leader-details' is an explicit global sidebar mode
// opened by clicking a leader portrait — independent of the map selection.
export type RightSidebarPanelMode = 'details' | 'leader-details' | 'leaderboard' | 'trading' | 'timeline' | 'diplomacy-graph';
// The map-selection view drives only the Details popup; the selected leader is
// tracked separately (see the provider's leader state), so 'leader' is not part
// of this union.
export type RightSidebarDetailsView = 'tile' | 'city' | 'unit' | 'nation' | null;
export type RightSidebarLeaderboardCategory = 'domination' | 'diplomacy' | 'research' | 'cultural' | 'gon';
export type RightSidebarCityDetailsTab = 'city' | 'growth' | 'output';
export type LeaderPanelTab = 'details' | 'units' | 'cities' | 'diplomacy' | 'relations' | 'economics';

export function resolveTradingTabId(selectedId: string, validTabIds: readonly string[]): string {
  if (validTabIds.includes(selectedId)) return selectedId;
  return validTabIds[0] ?? 'buy';
}

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
  /** Optional presentation text when the raw current/max pair is not meaningful to players. */
  valueText?: string;
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

export interface RightSidebarSelectOption {
  value: string;
  label: string;
}

export interface RightSidebarSelectRow {
  kind: 'select';
  label: string;
  value: string;
  options: RightSidebarSelectOption[];
  disabled?: boolean;
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

export interface RightSidebarPieChartSlice {
  label: string;
  value: number;
  color: number;
}

/** A large, labelled pie chart that participates in the normal sidebar flow. */
export interface RightSidebarPieChartRow {
  kind: 'pieChart';
  slices: RightSidebarPieChartSlice[];
}

/**
 * A grid of "cells", each cell being its own small stack of rows. Cells flow
 * left-to-right and wrap after `columns` of them, so items spread across the
 * panel width instead of stacking in a single tall list.
 */
export interface RightSidebarGridRow {
  kind: 'grid';
  columns: number;
  cells: RightSidebarRow[][];
}

export type RightSidebarRow =
  | RightSidebarTextRow
  | RightSidebarButtonRow
  | RightSidebarButtonGroupRow
  | RightSidebarProgressRow
  | RightSidebarSeparatorRow
  | RightSidebarSearchInputRow
  | RightSidebarSelectRow
  | RightSidebarRelationsTableRow
  | RightSidebarCompactTableRow
  | RightSidebarPieChartRow
  | RightSidebarGridRow;

export interface RightSidebarSection {
  title: string;
  titleRight?: string;
  rows: RightSidebarRow[];
  /**
   * When set, the section is placed in a two-column band instead of spanning the
   * full panel width. Contiguous columned sections share one 50/50 band; sections
   * without this field render full-width as before.
   */
  column?: 'left' | 'right';
}

export interface RightSidebarContent {
  title: string;
  sections: RightSidebarSection[];
}

/**
 * The current map selection shown in the Details popup. The selected leader is
 * deliberately NOT part of this state — it lives independently on the provider
 * so map selection and Leader Details never overwrite each other.
 */
export interface RightSidebarDetailsState {
  view: RightSidebarDetailsView;
  tile: Tile | null;
  city: City | null;
  unit: Unit | null;
  nationId: string | null;
}
