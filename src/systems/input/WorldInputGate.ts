/**
 * HUD and world both listen inside the same Phaser scene. This gate prevents
 * world systems from processing pointer sequences claimed by HUD controls.
 */
export class WorldInputGate {
  private readonly claimedPointerIds = new Set<number>();

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

  clearAll(): void {
    this.claimedPointerIds.clear();
  }
}
