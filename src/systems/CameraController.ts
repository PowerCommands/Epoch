import Phaser from 'phaser';
import { PlanetaryRenderer } from './rendering/PlanetaryRenderer';
import { planetaryHalfExtents, unprojectPlanetary } from './rendering/PlanetaryProjection';
import type { WorldInputGate } from './input/WorldInputGate';
import { isPointerEventConsumed } from '../utils/phaserScreenSpaceUi';

const PAN_SPEED = 400;  // pixlar/sekund vid zoom 1.0
const ZOOM_STEP = 0.1;
const DEFAULT_ZOOM_MIN = 0.15;
const ZOOM_MAX = 10.0;

/**
 * CameraController hanterar all kamerainput: panorering med mus och
 * tangentbord, samt inzoomning mot muspekarens position.
 *
 * Separeras från renderlogiken så att kamerabeteendet kan justeras
 * fristående från hur kartan ser ut.
 */
export class CameraController {
  private readonly cam: Phaser.Cameras.Scene2D.Camera;
  private readonly fallbackMinZoom: number;
  private readonly planetary?: PlanetaryRenderer;
  private targetZoom: number | null = null;
  private zoomAnchor = { x: 0, y: 0 };
  private get minZoom(): number { return this.planetary?.range.min ?? this.fallbackMinZoom; }
  private readonly keys: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    w: Phaser.Input.Keyboard.Key;
    s: Phaser.Input.Keyboard.Key;
    a: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
  };

  // Tillstånd för muspanorering
  private pointerIsDown = false;
  private didDrag = false;
  private dragEnded = false;
  private pointerPanEnabled = true;
  private dragStartX = 0;
  private dragStartY = 0;
  private camStartScrollX = 0;
  private camStartScrollY = 0;

  // Minsta pixelrörelse för att räknas som drag snarare än klick
  private static readonly DRAG_THRESHOLD = 4;

  constructor(
    scene: Phaser.Scene,
    worldWidth: number,
    worldHeight: number,
    private readonly worldInputGate: WorldInputGate,
    minZoom = DEFAULT_ZOOM_MIN,
  ) {
    this.cam = scene.cameras.main;
    this.fallbackMinZoom = minZoom;
    if (scene.game.renderer.type === Phaser.WEBGL) {
      this.planetary = new PlanetaryRenderer(this.cam, scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer, worldWidth, worldHeight);
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.planetary?.destroy());
    }
    this.cam.setBounds(0, 0, worldWidth, worldHeight);

    // Registrera tangenter
    const kb = scene.input.keyboard!;
    this.keys = {
      up:    kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down:  kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      left:  kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      w:     kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      s:     kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      a:     kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      d:     kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    this.registerPointerEvents(scene);
    this.registerWheelEvent(scene);
  }

  /** Anropas varje frame från GameScene.update(). */
  update(delta: number): void {
    if (this.cam.zoom < this.minZoom) this.setZoom(this.minZoom);
    if (this.targetZoom !== null) {
      const target = Phaser.Math.Clamp(this.targetZoom, this.minZoom, ZOOM_MAX);
      const next = Phaser.Math.Linear(this.cam.zoom, target, 1 - Math.exp(-delta / 90));
      this.zoomAround(Math.abs(next - target) < 0.0001 ? target : next, this.zoomAnchor.x, this.zoomAnchor.y);
      if (this.cam.zoom === target) this.targetZoom = null;
    }
    this.handleKeyboardPan(delta);
    this.planetary?.update();
  }

  /** Centrera kameran på en världsposition och sätt ett specifikt zoom-värde. */
  focusOn(worldX: number, worldY: number, zoom: number): void {
    this.setZoom(zoom);
    this.cam.centerOn(worldX, worldY);
  }

  /** Change zoom while preserving the current camera centre. */
  setZoom(zoom: number): void {
    this.targetZoom = null;
    const centerX = this.cam.midPoint.x;
    const centerY = this.cam.midPoint.y;
    this.cam.zoom = Phaser.Math.Clamp(zoom, this.minZoom, ZOOM_MAX);
    this.cam.centerOn(centerX, centerY);
    this.planetary?.update();
  }

  get zoom(): number {
    return this.cam.zoom;
  }

  get scrollX(): number {
    return this.cam.scrollX;
  }

  get scrollY(): number {
    return this.cam.scrollY;
  }

  /** Flat-world footprint of the visible surface, also used by the minimap. */
  getViewportWorldBounds(): { x: number; y: number; width: number; height: number } {
    const half = this.planetary ? planetaryHalfExtents(this.planetary.view)
      : { x: this.cam.width / (2 * this.cam.zoom), y: this.cam.height / (2 * this.cam.zoom) };
    return { x: this.cam.scrollX + this.cam.width / 2 - half.x,
      y: this.cam.scrollY + this.cam.height / 2 - half.y, width: half.x * 2, height: half.y * 2 };
  }

  setPointerPanEnabled(enabled: boolean): void {
    this.pointerPanEnabled = enabled;
  }

  /**
   * Returnerar true om den senaste pointer-up avslutade en drag-panorering.
   * Värdet nollställs efter avläsning (consume-semantik), så att
   * SelectionManager kan anropa det en gång i sin pointerup-handler.
   */
  wasDragging(): boolean {
    const result = this.dragEnded;
    this.dragEnded = false;
    return result;
  }

  // ─── Privata metoder ───────────────────────────────────────────────────────

  private handleKeyboardPan(delta: number): void {
    if (this.worldInputGate.isWorldInteractionBlocked()) return;
    // Skala hastigheten omvänt mot zoom så att rörelsen känns
    // konsekvent oavsett hur långt inzoomad spelaren är.
    const speed = (PAN_SPEED / this.cam.zoom) * (delta / 1000);

    const moveLeft  = this.keys.left.isDown  || this.keys.a.isDown;
    const moveRight = this.keys.right.isDown || this.keys.d.isDown;
    const moveUp    = this.keys.up.isDown    || this.keys.w.isDown;
    const moveDown  = this.keys.down.isDown  || this.keys.s.isDown;

    if (moveLeft)  this.cam.scrollX -= speed;
    if (moveRight) this.cam.scrollX += speed;
    if (moveUp)    this.cam.scrollY -= speed;
    if (moveDown)  this.cam.scrollY += speed;
  }

  private registerPointerEvents(scene: Phaser.Scene): void {
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      // Bara vänster musknapp
      if (!this.pointerPanEnabled) return;
      if (!pointer.leftButtonDown()) return;
      // HUD and world both listen inside the same Phaser scene. This gate
      // prevents world systems from processing pointer sequences claimed by HUD controls.
      if (this.worldInputGate.isPointerClaimed(pointer.id)) return;
      if (isPointerEventConsumed(pointer)) return;
      this.targetZoom = null;
      this.pointerIsDown = true;
      this.didDrag = false;
      this.dragStartX = pointer.x;
      this.dragStartY = pointer.y;
      this.camStartScrollX = this.cam.scrollX;
      this.camStartScrollY = this.cam.scrollY;
    });

    scene.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (!this.pointerPanEnabled) return;
      if (this.worldInputGate.isPointerClaimed(pointer.id)) return;
      if (!this.pointerIsDown) return;

      const start = this.sourcePoint(this.dragStartX, this.dragStartY);
      const current = this.sourcePoint(pointer.x, pointer.y);
      if (!start || !current) return;
      const dx = current.x - start.x;
      const dy = current.y - start.y;
      const dist = Math.hypot(pointer.x - this.dragStartX, pointer.y - this.dragStartY);

      // Räkna som drag först efter att pekaren rört sig förbi tröskeln
      if (dist >= CameraController.DRAG_THRESHOLD) {
        this.didDrag = true;
      }

      if (!this.didDrag) return;

      // Dela rörelsen med zoom så att kartan alltid följer pekaren
      // exakt oavsett zoom-nivå.
      this.cam.scrollX = this.camStartScrollX - dx / this.cam.zoom;
      this.cam.scrollY = this.camStartScrollY - dy / this.cam.zoom;
    });

    const stopDrag = (): void => {
      this.dragEnded = this.didDrag;
      this.pointerIsDown = false;
      this.didDrag = false;
    };
    scene.input.on(Phaser.Input.Events.POINTER_UP, stopDrag);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, stopDrag);
  }

  private sourcePoint(x: number, y: number): { x: number; y: number } | null {
    return this.planetary ? unprojectPlanetary(x - this.cam.x, y - this.cam.y, this.planetary.view) : { x: x - this.cam.x, y: y - this.cam.y };
  }

  private zoomAround(zoom: number, x: number, y: number): void {
    const before = this.sourcePoint(x, y);
    const oldZoom = this.cam.zoom;
    this.cam.zoom = zoom;
    const after = this.sourcePoint(x, y);
    if (before && after) {
      // Phaser scroll is relative to the camera centre, not its top left.
      this.cam.scrollX += (before.x - this.cam.width / 2) / oldZoom - (after.x - this.cam.width / 2) / zoom;
      this.cam.scrollY += (before.y - this.cam.height / 2) / oldZoom - (after.y - this.cam.height / 2) / zoom;
    }
  }

  private registerWheelEvent(scene: Phaser.Scene): void {
    scene.input.on(
      Phaser.Input.Events.POINTER_WHEEL,
      (pointer: Phaser.Input.Pointer, _gameObjects: unknown, _dx: number, dy: number) => {
        if (this.worldInputGate.isWheelBlocked(pointer.x, pointer.y)) return;
        if (this.worldInputGate.isPointerClaimed(pointer.id)) return;
        if (isPointerEventConsumed(pointer)) return;
        const oldZoom = this.targetZoom ?? this.cam.zoom;
        const farZoom = this.planetary && oldZoom <= this.planetary.range.start + ZOOM_STEP;
        this.targetZoom = Phaser.Math.Clamp(
          farZoom ? oldZoom * Math.exp(-Math.sign(dy) * 0.16) : oldZoom - Math.sign(dy) * ZOOM_STEP,
          this.minZoom, ZOOM_MAX,
        );
        this.zoomAnchor = { x: pointer.x, y: pointer.y };
      },
    );
  }
}
