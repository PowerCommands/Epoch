import { GAMES_HUD_BUTTON_LAYOUT } from './GamesOfNationsUiModel';
import { WORLD_COUNCIL_REGULAR_MEETING_INTERVAL_TURNS } from '../../types/worldCouncil';

/**
 * Placement of the World Council / United Nations system button. It sits as the
 * fourth entry in the left-side system button stack, directly below the Games of
 * Nations button, and shares the same diameter / hit size as its siblings.
 */
export const WORLD_COUNCIL_HUD_BUTTON_LAYOUT = {
  left: GAMES_HUD_BUTTON_LAYOUT.left,
  top: GAMES_HUD_BUTTON_LAYOUT.top + GAMES_HUD_BUTTON_LAYOUT.diameter + 22,
  diameter: GAMES_HUD_BUTTON_LAYOUT.diameter,
  hitDiameter: 122,
} as const;

/** Existing World Council icon, reused for the system button. */
export const WORLD_COUNCIL_HUD_ICON = '📜';

/** Green accent identity distinguishing the World Council button from its siblings. */
export const WORLD_COUNCIL_HUD_GREEN = {
  progress: 0x22c55e,
  accent: 0x16a34a,
  background: 0x0b2a17,
  hoverBackground: 0x0f3d22,
  pressedBackground: 0x0c3520,
} as const;

/**
 * Presentation-only inputs for the World Council system button. The turn values
 * mirror the canonical `WorldCouncilState` regular-meeting schedule; nothing here
 * mutates gameplay state.
 */
export interface WorldCouncilButtonContext {
  /** Display name — `World Council` or `United Nations` once upgraded. */
  organizationName: string;
  /** True when the human currently has a pending foundation offer (no council yet). */
  foundationOffer: boolean;
  /** Null until a World Council / UN exists in the world. */
  council: {
    status: 'construction' | 'active';
    constructionTurnsRemaining: number;
    lastRegularMeetingTurn: number;
    nextRegularMeetingTurn: number;
  } | null;
  /** Current game round/turn used to measure progress toward the next meeting. */
  currentTurn: number;
}

export interface WorldCouncilButtonModel {
  visible: boolean;
  organizationName: string;
  /** Progress toward the next regular meeting, clamped to 0..1. */
  progress: number;
  active: boolean;
  tooltip: string;
}

export function buildWorldCouncilButtonModel(context: WorldCouncilButtonContext): WorldCouncilButtonModel {
  const { organizationName, foundationOffer, council, currentTurn } = context;

  if (!council) {
    return {
      visible: foundationOffer,
      organizationName,
      progress: 0,
      active: false,
      tooltip: foundationOffer
        ? `Found ${organizationName}\nClick to establish the organization`
        : '',
    };
  }

  if (council.status === 'construction') {
    const remaining = Math.max(0, Math.floor(council.constructionTurnsRemaining));
    return {
      visible: true,
      organizationName,
      progress: 0,
      active: false,
      tooltip: `${organizationName}\nUnder construction — ${remaining} ${remaining === 1 ? 'turn' : 'turns'} remaining`,
    };
  }

  const { progress, turnsRemaining } = computeMeetingProgress(
    council.lastRegularMeetingTurn,
    council.nextRegularMeetingTurn,
    currentTurn,
  );
  const tooltip = turnsRemaining === null
    ? `${organizationName}\nNext regular meeting scheduling…`
    : `${organizationName}\nNext regular meeting in ${turnsRemaining} ${turnsRemaining === 1 ? 'turn' : 'turns'}`;

  return {
    visible: true,
    organizationName,
    progress,
    active: true,
    tooltip,
  };
}

function computeMeetingProgress(
  lastRegularMeetingTurn: number,
  nextRegularMeetingTurn: number,
  currentTurn: number,
): { progress: number; turnsRemaining: number | null } {
  if (!Number.isFinite(nextRegularMeetingTurn) || nextRegularMeetingTurn <= 0) {
    return { progress: 0, turnsRemaining: null };
  }

  // Prefer the recorded interval between the last and next regular meeting; fall
  // back to the canonical interval constant when the recorded anchor is missing
  // or inconsistent (e.g. defensively for older saves).
  const recordedInterval = nextRegularMeetingTurn - lastRegularMeetingTurn;
  const interval = recordedInterval > 0
    ? recordedInterval
    : WORLD_COUNCIL_REGULAR_MEETING_INTERVAL_TURNS;
  const anchorLast = recordedInterval > 0
    ? lastRegularMeetingTurn
    : nextRegularMeetingTurn - interval;

  const elapsed = currentTurn - anchorLast;
  const progress = clamp01(elapsed / interval);
  const turnsRemaining = Math.max(0, nextRegularMeetingTurn - currentTurn);
  return { progress, turnsRemaining };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
