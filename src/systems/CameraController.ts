import Phaser from 'phaser';
import type { WorldInputGate } from './input/WorldInputGate';
import { isPointerEventConsumed } from '../utils/phaserScreenSpaceUi';

const PAN_SPEED = 400;  // pixlar/sekund vid zoom 1.0
const ZOOM_STEP = 0.1;
const DEFAULT_ZOOM_MIN = 0.15;
const ZOOM_MAX = 2.0;

/**
 * CameraController hanterar all kamerainput: panorering med mus och
 * tangentbord, samt inzoomning mot muspekarens position.
 *
 * Separeras från renderlogiken så att kamerabeteendet kan justeras
 * fristående från hur kartan ser ut.
 */
export class CameraController {
  private readonly cam: Phaser.Cameras.Scene2D.Camera;
  private readonly minZoom: number;
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
    this.minZoom = minZoom;
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
    this.handleKeyboardPan(delta);
  }

  /** Centrera kameran på en världsposition och sätt ett specifikt zoom-värde. */
  focusOn(worldX: number, worldY: number, zoom: number): void {
    this.cam.zoom = Phaser.Math.Clamp(zoom, this.minZoom, ZOOM_MAX);
    this.cam.centerOn(worldX, worldY);
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

      const dx = pointer.x - this.dragStartX;
      const dy = pointer.y - this.dragStartY;
      const dist = Math.sqrt(dx * dx + dy * dy);

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

  private registerWheelEvent(scene: Phaser.Scene): void {
    scene.input.on(
      Phaser.Input.Events.POINTER_WHEEL,
      (pointer: Phaser.Input.Pointer, _gameObjects: unknown, _dx: number, dy: number) => {
        if (this.worldInputGate.isWheelBlocked(pointer.x, pointer.y)) return;
        if (this.worldInputGate.isPointerClaimed(pointer.id)) return;
        if (isPointerEventConsumed(pointer)) return;
        const oldZoom = this.cam.zoom;
        const newZoom = Phaser.Math.Clamp(
          oldZoom - Math.sign(dy) * ZOOM_STEP,
          this.minZoom,
          ZOOM_MAX,
        );

        if (newZoom === oldZoom) return;

        /**
         * Zooma mot muspekarens position.
         *
         * Principen: den världspunkt som pekaren pekar på ska vara
         * samma före och efter zoom. I Phasers scrollX/scrollY-modell
         * representerar scrollX/scrollY kamerans övre vänstra hörn i
         * världskoordinater (okorrigerat för zoom). Vi löser ut vad
         * scrollX/scrollY måste vara efter zoom-ändringen:
         *
         *   worldPoint = scrollX + (pointer.x / zoom)
         *   => newScrollX = worldPoint - (pointer.x / newZoom)
         *                 = scrollX + pointer.x/oldZoom - pointer.x/newZoom
         */
        const wx = this.cam.scrollX + pointer.x / oldZoom;
        const wy = this.cam.scrollY + pointer.y / oldZoom;

        this.cam.zoom = newZoom;
        this.cam.scrollX = wx - pointer.x / newZoom;
        this.cam.scrollY = wy - pointer.y / newZoom;
      },
    );
  }
}
