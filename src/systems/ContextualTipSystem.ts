import type { GuideTip } from '../data/progressiveGuide';
import {
  CONTEXTUAL_TIP_DEFS,
  type ContextTriggerType,
  type ContextualTipDef,
  type ContextUnitKind,
} from '../data/contextualTips';
import type { SavedContextualTips } from '../types/saveGame';

/** Optional context payload accompanying a fired trigger. */
export interface ContextTriggerPayload {
  /** Technology / Culture node id for node-scoped triggers. */
  nodeId?: string;
  /** Unit role for `unit-selected` triggers. */
  unitKind?: ContextUnitKind;
}

/** Presents a single tip. Set once the guide wizard exists. */
export type ContextTipPresenter = (tip: GuideTip) => void;

/**
 * Context-aware tutorial delivery.
 *
 * Gameplay events call {@link fire}; the system looks up the matching contextual
 * tip definition(s), enqueues any not-yet-shown tip, and — when it is safe to
 * interrupt the player — presents the highest-priority queued tip through the
 * shared guide wizard. Exactly one tip is shown at a time; the rest wait.
 *
 * Human-only: triggers fired during autoplay/autorun are ignored entirely, so
 * the AI simulation is never blocked by tutorial UI.
 *
 * Shown-tip ids are the only persisted state (see {@link getState}); the queue
 * is transient. Old saves without contextual-tip state start empty.
 */
export class ContextualTipSystem {
  private readonly defsByType = new Map<ContextTriggerType, ContextualTipDef[]>();
  private readonly contentById: Map<string, GuideTip>;
  private readonly shown: Set<string>;
  /** Pending tips, each present at most once. Ordered by insertion. */
  private readonly queue: Array<{ id: string; priority: number; order: number }> = [];
  private queueCounter = 0;

  private present: ContextTipPresenter | null = null;

  constructor(
    /** Guide content keyed by id (shared with the manual guide library). */
    content: ReadonlyMap<string, GuideTip>,
    /** True while automatic guide popups are enabled in Settings. */
    private readonly isEnabled: () => boolean,
    /** True while the AI is auto-playing; contextual tips never fire then. */
    private readonly isAutoplayActive: () => boolean,
    /** True while another modal/guide already occupies the screen. */
    private readonly isPresenterBusy: () => boolean,
    savedShown?: SavedContextualTips,
  ) {
    this.contentById = new Map(content);
    this.shown = new Set(sanitizeShownIds(savedShown));
    for (const def of CONTEXTUAL_TIP_DEFS) {
      const list = this.defsByType.get(def.type) ?? [];
      list.push(def);
      this.defsByType.set(def.type, list);
    }
  }

  /** Wire the wizard as the presenter once it has been constructed. */
  setPresenter(present: ContextTipPresenter): void {
    this.present = present;
    this.flush();
  }

  /**
   * Notify the system that a contextual gameplay event occurred. Enqueues any
   * relevant, not-yet-shown tip and attempts to present the next one.
   */
  fire(type: ContextTriggerType, payload: ContextTriggerPayload = {}): void {
    // Never enqueue during autorun: there is no human to teach and the queue
    // must not surface a backlog when a human later takes over a save.
    if (this.isAutoplayActive()) return;
    // Contextual tips are event-driven: a trigger that fires while popups are
    // disabled is dropped, not deferred, so re-enabling never dumps a backlog of
    // stale explanations. (Tips already queued while enabled are only *held*
    // by the flush gate, not dropped.)
    if (!this.isEnabled()) return;
    const candidates = this.defsByType.get(type);
    if (!candidates) return;
    for (const def of candidates) {
      if (def.nodeId !== undefined && def.nodeId !== payload.nodeId) continue;
      if (def.unitKind !== undefined && def.unitKind !== payload.unitKind) continue;
      this.enqueue(def);
    }
    this.flush();
  }

  /** Called when the guide wizard closes so the next queued tip can appear. */
  onPresentationClosed(): void {
    this.flush();
  }

  /** Attempt to present the highest-priority queued tip, if allowed right now. */
  flush(): void {
    if (this.queue.length === 0) return;
    if (this.present === null) return;
    if (!this.isEnabled() || this.isAutoplayActive() || this.isPresenterBusy()) return;

    const next = this.takeHighestPriority();
    if (!next) return;
    const content = this.contentById.get(next.id);
    if (!content) return; // Unknown content id: skip defensively (already dropped).
    this.shown.add(next.id);
    this.present(content);
  }

  getState(): SavedContextualTips {
    return { shown: [...this.shown] };
  }

  private enqueue(def: ContextualTipDef): void {
    if (this.shown.has(def.id)) return;
    if (this.queue.some((entry) => entry.id === def.id)) return;
    this.queue.push({ id: def.id, priority: def.priority, order: this.queueCounter++ });
  }

  /** Remove and return the highest-priority queued tip (earliest breaks ties). */
  private takeHighestPriority(): { id: string; priority: number } | null {
    let bestIndex = -1;
    for (let i = 0; i < this.queue.length; i++) {
      const entry = this.queue[i];
      // Guard against a tip that was shown after being queued (should not happen
      // with dedup, but keeps the queue self-correcting).
      if (this.shown.has(entry.id)) continue;
      if (bestIndex === -1) { bestIndex = i; continue; }
      const best = this.queue[bestIndex];
      if (entry.priority > best.priority
        || (entry.priority === best.priority && entry.order < best.order)) {
        bestIndex = i;
      }
    }
    if (bestIndex === -1) {
      this.queue.length = 0;
      return null;
    }
    const [entry] = this.queue.splice(bestIndex, 1);
    return { id: entry.id, priority: entry.priority };
  }
}

function sanitizeShownIds(saved: SavedContextualTips | undefined): string[] {
  if (!saved || !Array.isArray(saved.shown)) return [];
  return saved.shown.filter((id): id is string => typeof id === 'string' && id.length > 0);
}
