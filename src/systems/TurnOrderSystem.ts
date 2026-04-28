import type { Unit } from '../entities/Unit';
import type { TurnManager } from './TurnManager';
import type { UnitManager, UnitChangedEvent } from './UnitManager';

type ActiveUnitListener = (unit: Unit | null) => void;
type UnitTurnOrderBlocker = (unit: Unit) => boolean;

/**
 * Maintains a persistent turn order of the human nation's units.
 *
 * The active unit is always the first in the persisted order that is
 * alive, owned by the human nation, not sleeping, and not marked
 * "done this turn". Actions that exhaust MP automatically advance the
 * queue; manual selection promotes a unit to the active slot and the
 * displaced active unit moves to the end of the persisted order
 * (retained across turns).
 */
export class TurnOrderSystem {
  private readonly order: string[] = [];
  private readonly doneThisTurn = new Set<string>();
  private readonly activeChangedListeners: ActiveUnitListener[] = [];
  private lastActiveId: string | null = null;

  constructor(
    private readonly unitManager: UnitManager,
    private readonly turnManager: TurnManager,
    private readonly humanNationId: string | undefined,
    private readonly isUnitBlocked: UnitTurnOrderBlocker = () => false,
  ) {
    if (!humanNationId) return;

    turnManager.on('turnStart', (event) => {
      if (event.nation.id === humanNationId) this.handleHumanTurnStart();
    });
    unitManager.onUnitChanged((event) => this.handleUnitChanged(event));
  }

  getActive(): Unit | null {
    const id = this.peekActiveId();
    if (!id) return null;
    return this.unitManager.getUnit(id) ?? null;
  }

  /** Returns unit IDs in the persisted order. */
  getPersistedOrder(): readonly string[] {
    return this.order;
  }

  /**
   * Mark the unit as done for this turn. Advances the queue.
   * Called when an action consumes the unit's remaining MP.
   */
  markDone(unitId: string): void {
    if (this.doneThisTurn.has(unitId)) return;
    this.doneThisTurn.add(unitId);
    this.notifyActiveChangedIfNeeded();
  }

  /**
   * Skip the current active unit (space key). Moves it to the end of
   * the persisted order and marks it done for this turn.
   */
  skipActive(): void {
    const id = this.peekActiveId();
    if (!id) return;
    this.moveToEnd(id);
    this.doneThisTurn.add(id);
    this.notifyActiveChangedIfNeeded();
  }

  /**
   * Promote a different unit to the active slot. The previous active
   * moves to the end of the persisted order (but is NOT marked done
   * — the user may return to it later).
   */
  promoteTo(targetUnitId: string): void {
    if (!this.humanNationId) return;

    const target = this.unitManager.getUnit(targetUnitId);
    if (!target || target.ownerId !== this.humanNationId) return;
    if (this.doneThisTurn.has(targetUnitId)) return;

    const activeId = this.peekActiveId();
    if (!activeId || activeId === targetUnitId) return;

    const activeIdx = this.order.indexOf(activeId);
    if (activeIdx < 0) return;

    this.order.splice(activeIdx, 1);

    const targetIdx = this.order.indexOf(targetUnitId);
    if (targetIdx >= 0) this.order.splice(targetIdx, 1);

    const insertIdx = Math.min(activeIdx, this.order.length);
    this.order.splice(insertIdx, 0, targetUnitId);
    this.order.push(activeId);

    this.notifyActiveChangedIfNeeded();
  }

  onActiveUnitChanged(listener: ActiveUnitListener): void {
    this.activeChangedListeners.push(listener);
  }

  /** Recompute the active unit and fire listeners if it changed. */
  refreshActive(): void {
    this.notifyActiveChangedIfNeeded();
  }

  private handleHumanTurnStart(): void {
    this.doneThisTurn.clear();

    for (let i = this.order.length - 1; i >= 0; i--) {
      if (!this.unitManager.getUnit(this.order[i])) {
        this.order.splice(i, 1);
      }
    }

    const owned = this.unitManager.getUnitsByOwner(this.humanNationId!);
    for (const unit of owned) {
      if (!this.order.includes(unit.id)) this.order.push(unit.id);
    }

    this.notifyActiveChangedIfNeeded();
  }

  private handleUnitChanged(event: UnitChangedEvent): void {
    if (!this.humanNationId) return;

    const { unit, reason } = event;
    const isHumanTurn = this.turnManager.getCurrentNation().id === this.humanNationId;

    if (reason === 'created' && unit.ownerId === this.humanNationId) {
      if (!this.order.includes(unit.id)) this.order.push(unit.id);
      if (isHumanTurn) this.notifyActiveChangedIfNeeded();
      return;
    }

    if (reason === 'removed') {
      const idx = this.order.indexOf(unit.id);
      if (idx >= 0) this.order.splice(idx, 1);
      this.doneThisTurn.delete(unit.id);
      if (unit.ownerId === this.humanNationId && isHumanTurn) this.notifyActiveChangedIfNeeded();
      return;
    }

    if ((reason === 'moved' || reason === 'damaged')
      && unit.ownerId === this.humanNationId
      && isHumanTurn
      && unit.movementPoints <= 0
    ) {
      this.markDone(unit.id);
    }
  }

  private peekActiveId(): string | null {
    if (!this.humanNationId) return null;
    for (const id of this.order) {
      if (this.doneThisTurn.has(id)) continue;
      const unit = this.unitManager.getUnit(id);
      if (!unit) continue;
      if (unit.ownerId !== this.humanNationId) continue;
      if (!unit.isAlive()) continue;
      if (unit.isSleeping) continue;
      if (this.isUnitBlocked(unit)) continue;
      return id;
    }
    return null;
  }

  private moveToEnd(unitId: string): void {
    const idx = this.order.indexOf(unitId);
    if (idx < 0) return;
    this.order.splice(idx, 1);
    this.order.push(unitId);
  }

  private notifyActiveChangedIfNeeded(): void {
    const currentId = this.peekActiveId();
    if (currentId === this.lastActiveId) return;
    this.lastActiveId = currentId;
    const unit = currentId ? this.unitManager.getUnit(currentId) ?? null : null;
    for (const listener of this.activeChangedListeners) listener(unit);
  }
}
