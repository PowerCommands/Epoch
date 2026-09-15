import Phaser from 'phaser';
import { PlanetaryRenderer } from './rendering/PlanetaryRenderer';
import { GLOBE_LATITUDE_LIMIT, GLOBE_LONGITUDE_SPAN, globeDestination, globeOrientation, type PlanetarySurface, type PlanetaryView, wrapLongitude, planetaryHalfExtents, unprojectPlanetary, projectPlanetary } from './rendering/PlanetaryProjection';
import type { WorldInputGate } from './input/WorldInputGate';
import { isPointerEventConsumed } from '../utils/phaserScreenSpaceUi';

const PAN_SPEED = 400;  // pixlar/sekund vid zoom 1.0
const ZOOM_STEP = 0.1;
const DEFAULT_ZOOM_MIN = 0.15;
const ZOOM_MAX = 10.0;

export interface CinematicCameraState {
  zoom: number;
  centerX: number;
  centerY: number;
  navigation: { longitude: number; latitude: number } | null;
}

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
  private readonly globeHint: HTMLDivElement;
  private globeReturnZoom = 1;
  private globeZoomDestination: { x: number; y: number } | null = null;
  private globeExiting = false;
  private globeDragStart = { longitude: 0, latitude: 0 };
  private cinematic = false;
  private disposed = false;
  get isGlobeNavigationActive(): boolean { return !!this.planetary?.navigation; }
  get isCinematicActive(): boolean { return this.cinematic; }
  private keyboardCaptured(): boolean {
    const active = document.activeElement;
    return this.worldInputGate.isWorldInteractionBlocked() || (active instanceof HTMLElement &&
      (active.isContentEditable || !!active.closest('input, textarea, select, button, [role="dialog"], dialog')));
  }
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
  private horizontalArrowsCaptured: () => boolean = () => false;
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
    surface?: PlanetarySurface,
  ) {
    this.cam = scene.cameras.main;
    this.globeHint = document.createElement('div');
    this.globeHint.className = 'globe-navigation-hint';
    this.globeHint.textContent = 'Globe navigation · Drag / WASD / arrows · Scroll to approach · G to return';
    this.globeHint.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);max-width:60vw;padding:8px 14px;border:1px solid #52758b;border-radius:6px;background:#101d2ee8;color:#e5eff6;font:13px sans-serif;text-align:center;pointer-events:none;z-index:20';
    this.globeHint.hidden = true;
    document.body.appendChild(this.globeHint);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.disposed = true; this.globeHint.remove(); });
    this.fallbackMinZoom = minZoom;
    if (scene.game.renderer.type === Phaser.WEBGL) {
      this.planetary = new PlanetaryRenderer(this.cam, scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer, worldWidth, worldHeight, surface);
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

    const onGlobeKey = (event: KeyboardEvent): void => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || this.keyboardCaptured()) return;
      if (!this.planetary) return;
      if (this.isGlobeNavigationActive) {
        this.globeExiting = true;
        this.targetZoom = Math.max(this.globeReturnZoom, this.planetary.range.start);
        this.clampGlobeDestination();
      } else {
        this.enterGlobeNavigation();
        this.targetZoom = this.minZoom;
      }
      this.zoomAnchor = { x: this.cam.x + this.cam.width / 2, y: this.cam.y + this.cam.height / 2 };
    };
    kb.on('keydown-G', onGlobeKey);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.off('keydown-G', onGlobeKey));
    this.registerPointerEvents(scene);
    this.registerWheelEvent(scene);
  }

  /** Anropas varje frame från GameScene.update(). */
  update(delta: number): void {
    if (this.disposed) return;
    if (this.cinematic) {
      this.globeHint.hidden = true;
      this.planetary?.update();
      return;
    }
    if (this.cam.zoom < this.minZoom) {
      if (this.isGlobeNavigationActive) this.cam.zoom = this.minZoom;
      else this.setZoom(this.minZoom);
    }
    if (this.targetZoom !== null) {
      const target = Phaser.Math.Clamp(this.targetZoom, this.minZoom, ZOOM_MAX);
      const next = Phaser.Math.Linear(this.cam.zoom, target, 1 - Math.exp(-delta / 90));
      this.zoomAround(Math.abs(next - target) < 0.0001 ? target : next, this.zoomAnchor.x, this.zoomAnchor.y);
      if (this.cam.zoom === target) this.targetZoom = null;
    }
    this.globeHint.hidden = !this.isGlobeNavigationActive || this.worldInputGate.isWorldInteractionBlocked();
    this.handleKeyboardPan(delta);
    this.syncGlobeCamera();
    this.planetary?.update();
  }

  /** Centrera kameran på en världsposition och sätt ett specifikt zoom-värde. */
  focusOn(worldX: number, worldY: number, zoom: number): void {
    if (this.cinematic) return;
    this.setZoom(zoom);
    this.cam.centerOn(worldX, worldY);
  }

  /** Change zoom while preserving the current camera centre. */
  setZoom(zoom: number): void {
    if (this.cinematic) return;
    this.targetZoom = null;
    this.globeZoomDestination = null;
    if (this.planetary) this.planetary.navigation = null;
    this.globeExiting = false;
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

  /** Presentation-only ownership. Turns and combat never wait on this camera. */
  beginCinematic(): CinematicCameraState | undefined {
    if (this.cinematic || this.disposed) return undefined;
    const state: CinematicCameraState = { zoom: this.cam.zoom,
      centerX: this.cam.scrollX + this.cam.width / 2, centerY: this.cam.scrollY + this.cam.height / 2,
      navigation: this.planetary?.navigation ? { ...this.planetary.navigation } : null };
    this.cinematic = true;
    this.pointerIsDown = false;
    this.didDrag = false;
    this.targetZoom = null;
    this.globeZoomDestination = null;
    this.globeExiting = false;
    return state;
  }

  get cinematicGlobeView(): PlanetaryView | undefined { return this.planetary?.view; }
  get cinematicZoomRange(): { min: number; start: number } {
    return this.planetary?.range ?? { min: this.minZoom, start: this.minZoom * 2.4 };
  }

  /** Uses the same globe orientation, source framing and shader as G / wheel. */
  setCinematicView(worldX: number, worldY: number, zoom: number): void {
    if (!this.cinematic || this.disposed) return;
    this.cam.zoom = Phaser.Math.Clamp(zoom, this.minZoom, ZOOM_MAX);
    if (this.planetary) {
      this.planetary.navigation = globeOrientation(worldX, worldY, this.planetary.view);
      this.syncGlobeCamera();
      this.planetary.update();
    } else this.cam.centerOn(worldX, worldY);
  }

  projectCinematicPoint(worldX: number, worldY: number, altitude = 0): { x: number; y: number; depth: number } | null {
    const x = this.cam.width / 2 + (worldX - this.cam.scrollX - this.cam.width / 2) * this.cam.zoom;
    const y = this.cam.height / 2 + (worldY - this.cam.scrollY - this.cam.height / 2) * this.cam.zoom;
    const point = this.planetary ? projectPlanetary(x, y, this.planetary.view, altitude) : { x, y, depth: 1 };
    return point ? { ...point, x: point.x + this.cam.x, y: point.y + this.cam.y } : null;
  }

  endCinematic(restore?: CinematicCameraState): void {
    if (!this.cinematic) return;
    this.cinematic = false;
    if (this.disposed) return;
    if (restore) {
      this.cam.zoom = restore.zoom;
      if (this.planetary) this.planetary.navigation = restore.navigation;
      this.cam.centerOn(restore.centerX, restore.centerY);
    } else if (this.planetary && this.planetary.view.strength === 0) this.planetary.navigation = null;
    this.planetary?.update();
  }

  /** Flat-world footprint of the visible surface, also used by the minimap. */
  getViewportWorldBounds(): { x: number; y: number; width: number; height: number } {
    const half = this.planetary ? planetaryHalfExtents(this.planetary.view)
      : { x: this.cam.width / (2 * this.cam.zoom), y: this.cam.height / (2 * this.cam.zoom) };
    const center = this.planetary?.navigation ? globeDestination(this.planetary.view)
      : { x: this.cam.scrollX + this.cam.width / 2, y: this.cam.scrollY + this.cam.height / 2 };
    return { x: center.x - half.x,
      y: center.y - half.y, width: half.x * 2, height: half.y * 2 };
  }

  setHorizontalArrowsCaptured(predicate: () => boolean): void {
    this.horizontalArrowsCaptured = predicate;
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
    if (this.keyboardCaptured()) return;
    // Skala hastigheten omvänt mot zoom så att rörelsen känns
    // konsekvent oavsett hur långt inzoomad spelaren är.
    const speed = (PAN_SPEED / this.cam.zoom) * (delta / 1000);

    const captureHorizontal = (this.keys.left.isDown || this.keys.right.isDown)
      && this.horizontalArrowsCaptured();
    const moveLeft  = (!captureHorizontal && this.keys.left.isDown) || this.keys.a.isDown;
    const moveRight = (!captureHorizontal && this.keys.right.isDown) || this.keys.d.isDown;
    const moveUp    = this.keys.up.isDown    || this.keys.w.isDown;
    const moveDown  = this.keys.down.isDown  || this.keys.s.isDown;

    if (this.planetary?.navigation) {
      if (moveLeft || moveRight || moveUp || moveDown) this.rotateGlobe((Number(moveRight) - Number(moveLeft)) * delta / 700,
        (Number(moveDown) - Number(moveUp)) * delta / 1000);
      return;
    }
    if (moveLeft || moveRight || moveUp || moveDown) this.globeZoomDestination = null;
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
      if (!this.isGlobeNavigationActive) {
        this.targetZoom = null;
        this.globeZoomDestination = null;
      }
      if (this.planetary?.navigation) this.globeDragStart = { ...this.planetary.navigation };
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

      if (this.planetary?.navigation) {
        const dx = pointer.x - this.dragStartX, dy = pointer.y - this.dragStartY;
        if (Math.hypot(dx, dy) >= CameraController.DRAG_THRESHOLD) this.didDrag = true;
        if (this.didDrag) {
          const radius = Math.min(this.cam.width, this.cam.height) * 0.43;
          this.planetary.navigation = { ...this.globeDragStart };
          this.rotateGlobe(-dx / radius, -dy / radius);
        }
        return;
      }
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
    if (this.isGlobeNavigationActive) {
      this.cam.zoom = zoom;
      this.syncGlobeCamera();
      return;
    }
    if (this.globeZoomDestination && zoom > this.cam.zoom) {
      const destination = this.globeZoomDestination;
      this.cam.zoom = zoom;
      this.cam.centerOn(destination.x, destination.y);
      if (Math.hypot(this.cam.scrollX + this.cam.width / 2 - destination.x,
        this.cam.scrollY + this.cam.height / 2 - destination.y) < 0.01) this.globeZoomDestination = null;
      return;
    }
    this.globeZoomDestination = null;
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

  private enterGlobeNavigation(): void {
    if (!this.planetary) return;
    const v = this.planetary.view;
    this.globeReturnZoom = this.cam.zoom;
    this.globeExiting = false;
    const orientation = globeOrientation(this.cam.scrollX + this.cam.width / 2, this.cam.scrollY + this.cam.height / 2, v);
    this.planetary.navigation = { ...orientation,
      latitude: Phaser.Math.Clamp(orientation.latitude, -GLOBE_LATITUDE_LIMIT, GLOBE_LATITUDE_LIMIT) };
  }

  private rotateGlobe(longitude: number, latitude: number): void {
    const nav = this.planetary?.navigation;
    if (!nav) return;
    nav.longitude = wrapLongitude(nav.longitude + longitude);
    nav.latitude = Phaser.Math.Clamp(nav.latitude + latitude, -GLOBE_LATITUDE_LIMIT, GLOBE_LATITUDE_LIMIT);
    this.syncGlobeCamera();
  }

  private clampGlobeDestination(): void {
    const nav = this.planetary?.navigation;
    if (nav) nav.longitude = Phaser.Math.Clamp(nav.longitude, -GLOBE_LONGITUDE_SPAN / 2, GLOBE_LONGITUDE_SPAN / 2);
  }

  private syncGlobeCamera(): void {
    if (!this.planetary?.navigation) return;
    const v = this.planetary.view;
    const destination = globeDestination(v);
    // At full altitude capture the whole finite map. The shader's source offset
    // keeps the viewed location fixed as the flat camera converges on it.
    this.cam.centerOn(Phaser.Math.Linear(destination.x, v.mapWidth / 2, v.strength),
      Phaser.Math.Linear(destination.y, v.mapHeight / 2, v.strength));
    if (v.strength === 0 && this.globeExiting) {
      // Ordinary camera bounds may temporarily centre a short map at the
      // transition threshold. Retain the destination until closer zoom can
      // frame it, so subsequent wheel ticks do not inherit that clamped centre.
      this.globeZoomDestination = destination;
      this.planetary.navigation = null;
      this.globeExiting = false;
    }
  }

  private registerWheelEvent(scene: Phaser.Scene): void {
    scene.input.on(
      Phaser.Input.Events.POINTER_WHEEL,
      (pointer: Phaser.Input.Pointer, _gameObjects: unknown, _dx: number, dy: number) => {
        if (this.worldInputGate.isWheelBlocked(pointer.x, pointer.y)) return;
        if (this.worldInputGate.isPointerClaimed(pointer.id)) return;
        if (isPointerEventConsumed(pointer)) return;
        if (dy === 0) return;
        const oldZoom = this.targetZoom ?? this.cam.zoom;
        if (this.planetary && !this.isGlobeNavigationActive && dy > 0 && oldZoom <= this.planetary.range.start + ZOOM_STEP) {
          this.enterGlobeNavigation();
        }
        if (this.isGlobeNavigationActive) {
          this.globeExiting = dy < 0;
          if (dy < 0) this.clampGlobeDestination();
        }
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
