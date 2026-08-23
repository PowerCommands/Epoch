/**
 * HUD and world both listen inside the same Phaser scene. This gate prevents
 * world systems from processing pointer sequences claimed by HUD controls.
 */
export class WorldInputGate {
  private readonly claimedPointerIds = new Set<number>();
  private readonly wheelBlockers = new Map<string, (screenX: number, screenY: number) => boolean>();
  private readonly worldBlockers = new Set<string>();

  blockWorld(id: string): void {
    this.worldBlockers.add(id);
  }

  unblockWorld(id: string): void {
    this.worldBlockers.delete(id);
  }

  isWorldInteractionBlocked(): boolean {
    return this.worldBlockers.size > 0;
  }

  claimPointer(pointerId: number): void {
    this.claimedPointerIds.add(pointerId);
  }

  releasePointer(pointerId: number): void {
    queueMicrotask(() => {
      this.claimedPointerIds.delete(pointerId);
    });
  }

  isPointerClaimed(pointerId: number): boolean {
    return this.isWorldInteractionBlocked() || this.claimedPointerIds.has(pointerId);
  }

  registerWheelBlocker(id: string, blocker: (screenX: number, screenY: number) => boolean): void {
    this.wheelBlockers.set(id, blocker);
  }

  unregisterWheelBlocker(id: string): void {
    this.wheelBlockers.delete(id);
  }

  isWheelBlocked(screenX: number, screenY: number): boolean {
    if (this.isWorldInteractionBlocked()) return true;
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
    this.worldBlockers.clear();
  }
}
