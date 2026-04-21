export interface DiagnosticSnapshot {
  zoom: number;
  camX: number;
  camY: number;
}

type DiagnosticListener = (snapshot: DiagnosticSnapshot) => void;
type VisibilityListener = (open: boolean) => void;

const DEFAULT_SNAPSHOT: DiagnosticSnapshot = {
  zoom: 0,
  camX: 0,
  camY: 0,
};

export class DiagnosticSystem {
  private openState = false;
  private snapshot: DiagnosticSnapshot = { ...DEFAULT_SNAPSHOT };
  private cameraProvider: (() => { zoom: number; scrollX: number; scrollY: number }) | null = null;
  private readonly listeners = new Set<DiagnosticListener>();
  private readonly visibilityListeners = new Set<VisibilityListener>();

  open(): void {
    if (this.openState) return;
    this.openState = true;
    this.emitVisibility();
    this.emitSnapshot();
  }

  close(): void {
    if (!this.openState) return;
    this.openState = false;
    this.emitVisibility();
  }

  toggle(): void {
    if (this.openState) this.close();
    else this.open();
  }

  isOpen(): boolean {
    return this.openState;
  }

  getSnapshot(): DiagnosticSnapshot {
    return { ...this.snapshot };
  }

  subscribe(listener: DiagnosticListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribeVisibility(listener: VisibilityListener): () => void {
    this.visibilityListeners.add(listener);
    return () => {
      this.visibilityListeners.delete(listener);
    };
  }

  setCameraProvider(provider: () => { zoom: number; scrollX: number; scrollY: number }): void {
    this.cameraProvider = provider;
    this.update();
  }

  update(): void {
    if (!this.cameraProvider) return;

    const camera = this.cameraProvider();
    const nextSnapshot: DiagnosticSnapshot = {
      zoom: roundTo(camera.zoom, 2),
      camX: Math.round(camera.scrollX),
      camY: Math.round(camera.scrollY),
    };

    if (sameSnapshot(this.snapshot, nextSnapshot)) return;

    this.snapshot = nextSnapshot;
    if (this.openState) {
      this.emitSnapshot();
    }
  }

  shutdown(): void {
    this.listeners.clear();
    this.visibilityListeners.clear();
    this.cameraProvider = null;
  }

  private emitSnapshot(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private emitVisibility(): void {
    for (const listener of this.visibilityListeners) {
      listener(this.openState);
    }
  }
}

function sameSnapshot(a: DiagnosticSnapshot, b: DiagnosticSnapshot): boolean {
  return a.zoom === b.zoom && a.camX === b.camX && a.camY === b.camY;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
