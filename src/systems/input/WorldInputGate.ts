/**
 * HUD and world both listen inside the same Phaser scene. This gate prevents
 * world systems from processing pointer sequences claimed by HUD controls.
 */
export class WorldInputGate {
  private readonly claimedPointerIds = new Set<number>();
  private readonly wheelBlockers = new Map<string, (screenX: number, screenY: number) => boolean>();

  claimPointer(pointerId: number): void {
    this.claimedPointerIds.add(pointerId);
  }

  releasePointer(pointerId: number): void {
    queueMicrotask(() => {
      this.claimedPointerIds.delete(pointerId);
    });
  }

  isPointerClaimed(pointerId: number): boolean {
    return this.claimedPointerIds.has(pointerId);
  }

  registerWheelBlocker(id: string, blocker: (screenX: number, screenY: number) => boolean): void {
    this.wheelBlockers.set(id, blocker);
  }

  unregisterWheelBlocker(id: string): void {
    this.wheelBlockers.delete(id);
  }

  isWheelBlocked(screenX: number, screenY: number): boolean {
    for (const blocker of this.wheelBlockers.values()) {
      if (blocker(screenX, screenY)) {
        return true;
      }
    }
    return false;
  }

  clearAll(): void {
    this.claimedPointerIds.clear();
    this.wheelBlockers.clear();
  }
}
