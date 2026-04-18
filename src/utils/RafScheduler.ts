// Coalesces multiple refresh requests into a single call per animation frame.
// Multiple schedule() calls with the same key within one frame run the latest
// callback exactly once; callers in different frames each get their own run.

export class RafScheduler {
  private scheduled = new Map<string, () => void>();
  private rafId: number | null = null;

  schedule(key: string, fn: () => void): void {
    this.scheduled.set(key, fn);
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => this.flush());
    }
  }

  cancel(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.scheduled.clear();
  }

  private flush(): void {
    const tasks = this.scheduled;
    this.scheduled = new Map();
    this.rafId = null;
    for (const fn of tasks.values()) fn();
  }
}
