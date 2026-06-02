import Phaser from 'phaser';
import { TileMap } from './TileMap';
import { CameraController } from './CameraController';
import { CityManager } from './CityManager';
import { UnitManager } from './UnitManager';
import type { WorldInputGate } from './input/WorldInputGate';
import { Selectable } from '../types/selection';
import { isPointerEventConsumed } from '../utils/phaserScreenSpaceUi';
import type { City } from '../entities/City';
import type { Unit } from '../entities/Unit';
import type { Tile } from '../types/map';

type SelectionCallback = (selection: Selectable | null) => void;
/**
 * `clickedTile` is the fog-independent tile under the pointer (null only when
 * off-map). It lets handlers (e.g. human move orders) act on the clicked
 * coordinate even when fog of war hides what is there, so `target` is null.
 */
type SelectionTargetCallback = (
  target: Selectable | null,
  currentSelection: Selectable | null,
  clickedTile: { x: number; y: number } | null,
) => boolean | void;
/**
 * `hoveredTile` is the fog-independent tile under the pointer (null only when
 * off-map). It tracks the pointer even across unexplored tiles, where `hovered`
 * is null, so the move-path preview can follow the cursor into fog of war.
 */
type HoverCallback = (
  hovered: Selectable | null,
  hoveredTile: { x: number; y: number } | null,
) => void;

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
  // Fog-independent tile under the pointer, tracked separately from `hovered`
  // (which is null over unexplored tiles) so previews can follow the cursor
  // into fog of war.
  private hoveredTile: { x: number; y: number } | null = null;
  private selected: Selectable | null = null;

  // Visual hint only: when Free Selection Mode is active the selected unit's
  // ring is drawn in a distinct colour to signal that clicks inspect/select
  // rather than issue move orders. The mode's logic lives in GameScene.
  private freeSelectionMode = false;

  // Fog of war gates. Default to always-on so non-fog contexts are unaffected.
  private isTileVisible: (tileX: number, tileY: number) => boolean = () => true;
  private isTileExplored: (tileX: number, tileY: number) => boolean = () => true;

  private readonly hoverGfx: Phaser.GameObjects.Graphics;
  private readonly selectionGfx: Phaser.GameObjects.Graphics;

  private readonly selectionCallbacks: SelectionCallback[] = [];
  private readonly directCityViewCallbacks: ((city: City) => void)[] = [];
  private readonly targetCallbacks: SelectionTargetCallback[] = [];
  private readonly hoverCallbacks: HoverCallback[] = [];

  constructor(
    scene: Phaser.Scene,
    tileMap: TileMap,
    cameraController: CameraController,
    cityManager: CityManager,
    unitManager: UnitManager,
    private readonly worldInputGate: WorldInputGate,
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

  /**
   * Install fog-of-war gates. `isTileVisible` controls whether on-tile objects
   * (units, cities) may be hovered/selected; `isTileExplored` controls whether
   * an unseen tile can be targeted at all.
   */
  setVisibilityPredicates(
    isTileVisible: (tileX: number, tileY: number) => boolean,
    isTileExplored: (tileX: number, tileY: number) => boolean,
  ): void {
    this.isTileVisible = isTileVisible;
    this.isTileExplored = isTileExplored;
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

  /** Toggle the Free Selection Mode highlight on the current selection. */
  setFreeSelectionMode(active: boolean): void {
    if (this.freeSelectionMode === active) return;
    this.freeSelectionMode = active;
    this.drawSelection();
  }

  selectCity(city: City): void {
    this.setSelection({ kind: 'city', city });
  }

  selectTile(tile: Tile): void {
    this.setSelection({ kind: 'tile', tile });
  }

  selectUnit(unit: Unit): void {
    this.setSelection({ kind: 'unit', unit });
  }

  clearSelection(): void {
    this.setSelection(null);
  }

  /**
   * Registers a callback invoked when the player Shift+clicks a tile that
   * contains a city. Bypasses normal unit-priority resolution so city view
   * can always be opened even when a unit occupies the same tile.
   */
  onDirectCityViewRequested(callback: (city: City) => void): void {
    this.directCityViewCallbacks.push(callback);
  }

  // ─── Privata metoder ───────────────────────────────────────────────────────

  /**
   * Avgör vad som finns under en världskoordinat.
   * Unit har prioritet framför stad, som har prioritet framför tile.
   */
  private resolve(worldX: number, worldY: number): Selectable | null {
    const tile = this.tileMap.worldToTile(worldX, worldY);
    if (tile === null) return null;

    // Fog of war: unseen tiles expose no information and cannot be targeted.
    if (!this.isTileExplored(tile.x, tile.y)) return null;

    // On explored-but-not-currently-visible tiles only the remembered terrain
    // is selectable — enemy units/cities there are not rendered, so skip object
    // resolution and fall through to the tile.
    if (!this.isTileVisible(tile.x, tile.y)) {
      return { kind: 'tile', tile };
    }

    const nonCargo = this.unitManager.getUnitsAt(tile.x, tile.y);
    const cargo: Unit[] = [];
    for (const transport of nonCargo) {
      if (transport.cargoUnitIds.length > 0) {
        cargo.push(...this.unitManager.getCargoUnitsForTransport(transport));
      }
    }
    const units = [...nonCargo, ...cargo];
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
        // HUD and world both listen inside the same Phaser scene. This gate
        // prevents world systems from processing pointer sequences claimed by HUD controls.
        if (this.worldInputGate.isPointerClaimed(pointer.id)) return;
        const wp = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
        this.setHover(this.resolve(wp.x, wp.y), this.tileMap.worldToTile(wp.x, wp.y));
      },
    );

    this.scene.input.on(
      Phaser.Input.Events.POINTER_UP,
      (pointer: Phaser.Input.Pointer) => {
        if (pointer.button !== 0) return;
        if (this.worldInputGate.isPointerClaimed(pointer.id)) return;
        if (isPointerEventConsumed(pointer)) return;
        if (this.cameraController.wasDragging()) return;

        const wp = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);

        // Shift+click: bypass unit-priority resolution and open city view
        // directly. Works even when one or more units occupy the same tile.
        if ((pointer.event as PointerEvent).shiftKey) {
          const tile = this.tileMap.worldToTile(wp.x, wp.y);
          if (tile !== null && this.isTileVisible(tile.x, tile.y)) {
            const city = this.cityManager.getCityAt(tile.x, tile.y);
            if (city !== undefined) {
              for (const cb of this.directCityViewCallbacks) cb(city);
              return;
            }
          }
          // No city on this tile — fall through to normal click handling.
        }

        const target = this.resolve(wp.x, wp.y);
        // Resolve the raw clicked tile independently of fog so move handlers can
        // issue orders into unexplored territory (target is null there).
        const clickedTile = this.tileMap.worldToTile(wp.x, wp.y);

        if (this.notifySelectionTarget(target, clickedTile)) return;

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

  private setHover(next: Selectable | null, nextTile: { x: number; y: number } | null): void {
    const selectableChanged = !this.sameSelectable(this.hovered, next);
    const tileChanged = this.hoveredTile?.x !== nextTile?.x || this.hoveredTile?.y !== nextTile?.y;
    // Fire when either the resolved object OR the raw tile changes, so previews
    // keep updating as the pointer moves between unexplored tiles (where the
    // resolved hover stays null).
    if (!selectableChanged && !tileChanged) return;
    this.hovered = next;
    this.hoveredTile = nextTile;
    // The white hover highlight only reflects the resolved object, so redraw it
    // solely on selectable changes (it stays cleared over fog).
    if (selectableChanged) this.drawHover();
    for (const cb of this.hoverCallbacks) {
      cb(this.hovered, this.hoveredTile);
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

  private notifySelectionTarget(
    target: Selectable | null,
    clickedTile: { x: number; y: number } | null,
  ): boolean {
    for (const cb of this.targetCallbacks) {
      if (cb(target, this.selected, clickedTile) === true) return true;
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
      // Unit — gul ring runt enhetssymbolen. I Free Selection Mode ritas den i
      // en avvikande färg plus en yttre ring för att signalera "inspektera, inte flytta".
      const { x, y } = this.tileMap.tileToWorld(
        this.selected.unit.tileX,
        this.selected.unit.tileY,
      );
      const ringColor = this.freeSelectionMode ? 0x66ccff : 0xffdd44;
      this.selectionGfx.lineStyle(3, ringColor, 0.95);
      this.selectionGfx.strokeCircle(x, y, 19);
      if (this.freeSelectionMode) {
        this.selectionGfx.lineStyle(2, 0x66ccff, 0.55);
        this.selectionGfx.strokeCircle(x, y, 25);
      }
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
