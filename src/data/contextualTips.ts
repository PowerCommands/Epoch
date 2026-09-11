/**
 * Context-aware in-game tip definitions.
 *
 * Each entry maps a stable content id (see {@link buildProgressiveGuideTips} in
 * `progressiveGuide.ts`, which owns the actual explanatory text) to the
 * gameplay *context* in which that explanation is genuinely useful. A tip is
 * shown once per game the first time its trigger fires — never merely because a
 * number of turns have passed.
 *
 * This file is deliberately pure data: it references no runtime systems and only
 * describes *when* a tip is relevant. {@link ContextualTipSystem} owns the queue,
 * one-time bookkeeping and presentation; the trigger hooks live in GameScene and
 * simply call `fire(type, ctx)` from existing gameplay events.
 *
 * Adding a new contextual tip is a single-line change here (plus one `fire(...)`
 * call at the relevant existing event) — no new gameplay system is required.
 */

/** Categories of gameplay context that can surface a contextual tip. */
export type ContextTriggerType =
  /** The human meets another nation for the first time. */
  | 'first-contact'
  /** The human clicks/selects a Technology node (payload: `nodeId`). */
  | 'tech-inspected'
  /** The human clicks/selects a Culture node (payload: `nodeId`). */
  | 'culture-inspected'
  /** Culture progression first gives the human a genuinely equippable policy. */
  | 'policy-opportunity'
  /** The human founds a city (a settler builds a new city). */
  | 'city-founded'
  /** A human city is ready to grow but has reached its population capacity. */
  | 'city-population-capacity'
  /** The human captures and occupies a foreign city. */
  | 'city-captured'
  /** The human declares war on another nation. */
  | 'human-war-as-aggressor'
  /** The human first opens peace negotiations during a war. */
  | 'peace-negotiation-opened'
  /** The human establishes Trade Relations with another nation. */
  | 'trade-relations-established'
  /** The human first receives a Games of Nations participation invitation. */
  | 'games-invitation'
  /** The human first opens the victory-progress / Leaderboard interface. */
  | 'victory-progress-opened'
  /** The human selects a unit of a notable role (payload: `unitKind`). */
  | 'unit-selected';

/** Which unit role, when first selected, surfaces a role-specific tip. */
export type ContextUnitKind = 'builder' | 'covert' | 'military';

/**
 * Priority band. Highly contextual information about the mechanic the player is
 * interacting with right now wins over generic advice when several tips queue.
 */
export const CONTEXT_TIP_PRIORITY = {
  /** Mechanic the player is interacting with at this exact moment. */
  IMMEDIATE: 4,
  /** A newly encountered major system. */
  NEW_SYSTEM: 3,
  /** An important warning or problem. */
  WARNING: 2,
  /** General strategic advice. */
  ADVICE: 1,
} as const;

export type ContextTipPriority =
  (typeof CONTEXT_TIP_PRIORITY)[keyof typeof CONTEXT_TIP_PRIORITY];

export interface ContextualTipDef {
  /** Content id shared with the guide library (`progressiveGuide.ts`). */
  readonly id: string;
  readonly type: ContextTriggerType;
  readonly priority: ContextTipPriority;
  /** Node-scoped triggers only fire for this Technology / Culture node id. */
  readonly nodeId?: string;
  /** `unit-selected` triggers only fire for this unit role. */
  readonly unitKind?: ContextUnitKind;
}

/**
 * The complete, ordered-by-nothing set of automatically triggered contextual
 * tips. Order here is irrelevant; delivery order is decided at runtime by the
 * trigger that fires and by {@link ContextualTipDef.priority}.
 *
 * Existing guide topics without a strong, non-obvious contextual moment are
 * intentionally absent: they remain reachable through the manual guide only.
 */
export const CONTEXTUAL_TIP_DEFS: readonly ContextualTipDef[] = [
  // ── Diplomacy / geopolitics ────────────────────────────────────────────────
  { id: 'meet-nations', type: 'first-contact', priority: CONTEXT_TIP_PRIORITY.NEW_SYSTEM },

  // ── Trade ──────────────────────────────────────────────────────────────────
  { id: 'foreign-trade', type: 'culture-inspected', nodeId: 'foreign_trade', priority: CONTEXT_TIP_PRIORITY.NEW_SYSTEM },
  { id: 'trade-connections', type: 'trade-relations-established', priority: CONTEXT_TIP_PRIORITY.NEW_SYSTEM },

  // ── Research-gated systems (inspecting the enabling node) ───────────────────
  { id: 'writing', type: 'tech-inspected', nodeId: 'writing', priority: CONTEXT_TIP_PRIORITY.ADVICE },
  { id: 'naval-power', type: 'tech-inspected', nodeId: 'sailing', priority: CONTEXT_TIP_PRIORITY.NEW_SYSTEM },
  { id: 'military-technology', type: 'tech-inspected', nodeId: 'flight', priority: CONTEXT_TIP_PRIORITY.NEW_SYSTEM },

  // ── Culture-gated systems (inspecting the enabling node) ────────────────────
  { id: 'ideology', type: 'culture-inspected', nodeId: 'ideology', priority: CONTEXT_TIP_PRIORITY.NEW_SYSTEM },
  { id: 'culture-and-tech', type: 'policy-opportunity', priority: CONTEXT_TIP_PRIORITY.NEW_SYSTEM },

  // ── Games of Nations & victory ──────────────────────────────────────────────
  { id: 'advanced-planning', type: 'games-invitation', priority: CONTEXT_TIP_PRIORITY.NEW_SYSTEM },
  { id: 'victory-conditions', type: 'victory-progress-opened', priority: CONTEXT_TIP_PRIORITY.NEW_SYSTEM },

  // ── Cities ─────────────────────────────────────────────────────────────────
  { id: 'city-power', type: 'city-founded', priority: CONTEXT_TIP_PRIORITY.NEW_SYSTEM },
  { id: 'balanced-building', type: 'city-population-capacity', priority: CONTEXT_TIP_PRIORITY.WARNING },

  // ── War & conquest ─────────────────────────────────────────────────────────
  { id: 'war-objectives', type: 'human-war-as-aggressor', priority: CONTEXT_TIP_PRIORITY.IMMEDIATE },
  { id: 'peace', type: 'peace-negotiation-opened', priority: CONTEXT_TIP_PRIORITY.IMMEDIATE },
  { id: 'conquest-cost', type: 'city-captured', priority: CONTEXT_TIP_PRIORITY.IMMEDIATE },

  // ── Units introducing a mechanic when first selected ───────────────────────
  { id: 'improve-land', type: 'unit-selected', unitKind: 'builder', priority: CONTEXT_TIP_PRIORITY.IMMEDIATE },
  { id: 'intelligence', type: 'unit-selected', unitKind: 'covert', priority: CONTEXT_TIP_PRIORITY.NEW_SYSTEM },
];
