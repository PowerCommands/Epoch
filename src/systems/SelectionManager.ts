import Phaser from 'phaser';
import { TileMap } from './TileMap';
import { CameraController } from './CameraController';
import { CityManager } from './CityManager';
import { UnitManager } from './UnitManager';
import { Selectable } from '../types/selection';
import type { City } from '../entities/City';

type SelectionCallback = (selection: Selectable | null) => void;
type SelectionTargetCallback = (
  target: Selectable | null,
  currentSelection: Selectable | null,
) => boolean | void;
type HoverCallback = (hovered: Selectable | null) => void;

/**
 * SelectionManager hanterar hover- och selection-state för alla valbara
 * objekt på kartan (units, städer och tiles).
 *
 * Prioritet vid samma tile: unit → stad → tile.
 *
 * Visuella highlights renderas som separata Graphics-lager. De ritas bara
 * om vid faktisk state-ändring, inte varje frame.
 */
export class SelectionManager {
  private readonly scene: Phaser.Scene;
  private readonly tileMap: TileMap;
  private readonly cameraController: CameraController;
  private readonly cityManager: CityManager;
  private readonly unitManager: UnitManager;

  private hovered: Selectable | null = null;
  private selected: Selectable | null = null;

  private readonly hoverGfx: Phaser.GameObjects.Graphics;
  private readonly selectionGfx: Phaser.GameObjects.Graphics;

  private readonly selectionCallbacks: SelectionCallback[] = [];
  private readonly targetCallbacks: SelectionTargetCallback[] = [];
  private readonly hoverCallbacks: HoverCallback[] = [];

  constructor(
    scene: Phaser.Scene,
    tileMap: TileMap,
    cameraController: CameraController,
    cityManager: CityManager,
    unitManager: UnitManager,
  ) {
    this.scene = scene;
    this.tileMap = tileMap;
    this.cameraController = cameraController;
    this.cityManager = cityManager;
    this.unitManager = unitManager;

    // Depth 20/21 — ovanpå cities (15) men under HUD (100)
    this.hoverGfx = scene.add.graphics().setDepth(20);
    this.selectionGfx = scene.add.graphics().setDepth(21);

    this.registerEvents();

    this.unitManager.onUnitChanged(() => {
      this.drawHover();
      this.drawSelection();
    });
  }

  onSelectionChanged(callback: SelectionCallback): void {
    this.selectionCallbacks.push(callback);
  }

  onSelectionTarget(callback: SelectionTargetCallback): void {
    this.targetCallbacks.push(callback);
  }

  onHoverChanged(callback: HoverCallback): void {
    this.hoverCallbacks.push(callback);
  }

  getSelected(): Selectable | null {
    return this.selected;
  }

  selectCity(city: City): void {
    this.setSelection({ kind: 'city', city });
  }

  // ─── Privata metoder ───────────────────────────────────────────────────────

  /**
   * Avgör vad som finns under en världskoordinat.
   * Unit har prioritet framför stad, som har prioritet framför tile.
   */
  private resolve(worldX: number, worldY: number): Selectable | null {
    const tile = this.tileMap.worldToTile(worldX, worldY);
    if (tile === null) return null;

    const units = this.unitManager.getUnitsAt(tile.x, tile.y);
    if (units.length > 0) {
      if (this.selected?.kind === 'unit') {
        const selectedUnitId = this.selected.unit.id;
        const selectedIndex = units.findIndex((unit) => unit.id === selectedUnitId);
        if (selectedIndex >= 0) {
          return { kind: 'unit', unit: units[(selectedIndex + 1) % units.length] };
        }
      }
      return { kind: 'unit', unit: units[0] };
    }

    const city = this.cityManager.getCityAt(tile.x, tile.y);
    if (city !== undefined) return { kind: 'city', city };

    return { kind: 'tile', tile };
  }

  private registerEvents(): void {
    this.scene.input.on(
      Phaser.Input.Events.POINTER_MOVE,
      (pointer: Phaser.Input.Pointer) => {
        const wp = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
        this.setHover(this.resolve(wp.x, wp.y));
      },
    );

    this.scene.input.on(
      Phaser.Input.Events.POINTER_UP,
      (pointer: Phaser.Input.Pointer) => {
        if (pointer.button !== 0) return;
        if (this.cameraController.wasDragging()) return;

        // Skip map selection when pointer is over an interactive UI element
        // (scrollFactor 0 = fixed to screen, not part of the game world)
        const hitObjects = this.scene.input.hitTestPointer(pointer);
        const hitsUI = hitObjects.some((obj) => {
          const go = obj as unknown as Phaser.GameObjects.Components.ScrollFactor;
          return go.scrollFactorX === 0 && go.scrollFactorY === 0;
        });
        if (hitsUI) return;

        const wp = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const target = this.resolve(wp.x, wp.y);

        if (this.notifySelectionTarget(target)) return;

        if (target === null) {
          this.setSelection(null);
        } else if (this.sameSelectable(this.selected, target)) {
          // Toggle — klick på redan vald → avmarkera
          this.setSelection(null);
        } else {
          this.setSelection(target);
        }
      },
    );
  }

  private setHover(next: Selectable | null): void {
    if (this.sameSelectable(this.hovered, next)) return;
    this.hovered = next;
    this.drawHover();
    for (const cb of this.hoverCallbacks) {
      cb(this.hovered);
    }
  }

  private setSelection(next: Selectable | null): void {
    if (this.sameSelectable(this.selected, next)) return;
    this.selected = next;
    this.drawSelection();
    for (const cb of this.selectionCallbacks) {
      cb(this.selected);
    }
  }

  private notifySelectionTarget(target: Selectable | null): boolean {
    for (const cb of this.targetCallbacks) {
      if (cb(target, this.selected) === true) return true;
    }
    return false;
  }

  private sameSelectable(a: Selectable | null, b: Selectable | null): boolean {
    if (a === null && b === null) return true;
    if (a === null || b === null) return false;
    if (a.kind !== b.kind) return false;
    if (a.kind === 'tile' && b.kind === 'tile') {
      return a.tile.x === b.tile.x && a.tile.y === b.tile.y;
    }
    if (a.kind === 'city' && b.kind === 'city') {
      return a.city.id === b.city.id;
    }
    if (a.kind === 'unit' && b.kind === 'unit') {
      return a.unit.id === b.unit.id;
    }
    return false;
  }

  // ─── Highlight-rendering ───────────────────────────────────────────────────

  private drawHover(): void {
    this.hoverGfx.clear();
    if (this.hovered === null) return;

    if (this.hovered.kind === 'tile') {
      const outline = this.tileMap.getTileOutlinePoints(this.hovered.tile.x, this.hovered.tile.y);
      this.hoverGfx.lineStyle(2, 0xffffff, 0.6);
      this.strokePolygon(this.hoverGfx, outline);
    } else if (this.hovered.kind === 'city') {
      // Stad — vit ring strax utanför stadssymbolen
      const { x, y } = this.tileMap.tileToWorld(
        this.hovered.city.tileX,
        this.hovered.city.tileY,
      );
      this.hoverGfx.lineStyle(2, 0xffffff, 0.6);
      this.hoverGfx.strokeCircle(x, y, 20);
    } else {
      // Unit — vit ring strax utanför enhetssymbolen
      const { x, y } = this.tileMap.tileToWorld(
        this.hovered.unit.tileX,
        this.hovered.unit.tileY,
      );
      this.hoverGfx.lineStyle(2, 0xffffff, 0.8);
      this.hoverGfx.strokeCircle(x, y, 17);
    }
  }

  private drawSelection(): void {
    this.selectionGfx.clear();
    if (this.selected === null) return;

    if (this.selected.kind === 'tile') {
      const outline = this.tileMap.getTileOutlinePoints(this.selected.tile.x, this.selected.tile.y);
      this.selectionGfx.fillStyle(0xffdd44, 0.15);
      this.fillPolygon(this.selectionGfx, outline);
      this.selectionGfx.lineStyle(3, 0xffdd44, 0.9);
      this.strokePolygon(this.selectionGfx, outline);
    } else if (this.selected.kind === 'city') {
      // Stad — gul ring runt stadssymbolen
      const { x, y } = this.tileMap.tileToWorld(
        this.selected.city.tileX,
        this.selected.city.tileY,
      );
      this.selectionGfx.lineStyle(3, 0xffdd44, 0.9);
      this.selectionGfx.strokeCircle(x, y, 22);
    } else {
      // Unit — gul ring runt enhetssymbolen
      const { x, y } = this.tileMap.tileToWorld(
        this.selected.unit.tileX,
        this.selected.unit.tileY,
      );
      this.selectionGfx.lineStyle(3, 0xffdd44, 0.95);
      this.selectionGfx.strokeCircle(x, y, 19);
    }
  }

  private fillPolygon(gfx: Phaser.GameObjects.Graphics, points: { x: number; y: number }[]): void {
    if (points.length === 0) return;
    gfx.beginPath();
    gfx.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) {
      gfx.lineTo(point.x, point.y);
    }
    gfx.closePath();
    gfx.fillPath();
  }

  private strokePolygon(gfx: Phaser.GameObjects.Graphics, points: { x: number; y: number }[]): void {
    if (points.length === 0) return;
    gfx.beginPath();
    gfx.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) {
      gfx.lineTo(point.x, point.y);
    }
    gfx.closePath();
    gfx.strokePath();
  }
}
