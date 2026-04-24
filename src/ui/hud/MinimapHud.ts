import Phaser from 'phaser';
import { TileType, type MapData } from '../../types/map';
import type { NationManager } from '../../systems/NationManager';
import type { CameraController } from '../../systems/CameraController';
import type { TileMap } from '../../systems/TileMap';
import type { WorldInputGate } from '../../systems/input/WorldInputGate';
import { consumePointerEvent } from '../../utils/phaserScreenSpaceUi';

const DEPTH = 1000;
const PANEL_WIDTH = 300;
const PANEL_HEIGHT = 220;
const EDGE_MARGIN = 16;
const PANEL_PADDING = 8;
const WHEEL_BLOCKER_ID = 'minimap-hud';
const OWNED_TILE_ALPHA = 0.95;

const TERRAIN_COLORS: Record<TileType, number> = {
  [TileType.Ocean]: 0x1a557d,
  [TileType.Coast]: 0x4f8da7,
  [TileType.Plains]: 0x83b865,
  [TileType.Forest]: 0x2f7440,
  [TileType.Mountain]: 0x777b7b,
  [TileType.Ice]: 0xc8e6e8,
  [TileType.Jungle]: 0x236f50,
  [TileType.Desert]: 0xcdb65e,
};

export class MinimapHud {
  private readonly uiCamera: Phaser.Cameras.Scene2D.Camera;
  private readonly owned = new Set<Phaser.GameObjects.GameObject>();
  private readonly container: Phaser.GameObjects.Container;
  private readonly background: Phaser.GameObjects.Rectangle;
  private readonly border: Phaser.GameObjects.Rectangle;
  private readonly hitArea: Phaser.GameObjects.Zone;
  private readonly mapGfx: Phaser.GameObjects.Graphics;
  private readonly viewportGfx: Phaser.GameObjects.Graphics;
  private readonly worldBounds: { width: number; height: number };
  private readonly mapArea = new Phaser.Geom.Rectangle(0, 0, 1, 1);
  private readonly onResize: () => void;
  private readonly onAddedToScene: (go: Phaser.GameObjects.GameObject) => void;
  private readonly handlePointerDown: (pointer: Phaser.Input.Pointer) => void;
  private readonly handlePointerMove: (pointer: Phaser.Input.Pointer) => void;
  private readonly handlePointerUp: (pointer: Phaser.Input.Pointer) => void;
  private dragPointerId: number | null = null;
  private worldToMiniScale = 1;
  private worldToMiniOffsetX = 0;
  private worldToMiniOffsetY = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tileMap: TileMap,
    private readonly mapData: MapData,
    private readonly nationManager: NationManager,
    private readonly cameraController: CameraController,
    private readonly worldInputGate: WorldInputGate,
  ) {
    this.worldBounds = tileMap.getWorldBounds();
    this.container = scene.add.container(0, 0).setDepth(DEPTH).setScrollFactor(0);
    this.background = scene.add.rectangle(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 0x071019, 0.78)
      .setOrigin(0, 0)
      .setScrollFactor(0);
    this.border = scene.add.rectangle(0, 0, PANEL_WIDTH, PANEL_HEIGHT)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0xd8e2ee, 0.42)
      .setFillStyle(0x000000, 0)
      .setScrollFactor(0);
    this.mapGfx = scene.add.graphics().setScrollFactor(0);
    this.viewportGfx = scene.add.graphics().setScrollFactor(0);
    this.hitArea = scene.add.zone(0, 0, PANEL_WIDTH, PANEL_HEIGHT)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setInteractive({ cursor: 'pointer' });

    this.container.add([this.background, this.mapGfx, this.viewportGfx, this.border, this.hitArea]);
    this.owned.add(this.container);
    this.owned.add(this.background);
    this.owned.add(this.border);
    this.owned.add(this.hitArea);
    this.owned.add(this.mapGfx);
    this.owned.add(this.viewportGfx);

    this.uiCamera = scene.cameras.add(0, 0, scene.scale.width, scene.scale.height);
    this.uiCamera.setScroll(0, 0);
    this.uiCamera.setZoom(1);
    this.uiCamera.roundPixels = true;
    this.uiCamera.ignore(scene.children.list.filter((object) => !this.owned.has(object)));
    scene.cameras.main.ignore([...this.owned]);

    this.onAddedToScene = (object) => {
      if (this.owned.has(object)) {
        scene.cameras.main.ignore(object);
      } else {
        this.uiCamera.ignore(object);
      }
    };
    scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, this.onAddedToScene);

    this.layout();
    this.rebuild();
    this.update();

    this.hitArea.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.beginPointerNavigation(pointer);
    });

    this.handlePointerDown = (pointer) => {
      this.beginPointerNavigation(pointer);
    };
    this.handlePointerMove = (pointer) => {
      if (this.dragPointerId !== pointer.id) return;
      this.worldInputGate.claimPointer(pointer.id);
      consumePointerEvent(pointer);
      this.centerCameraFromPointer(pointer);
    };
    this.handlePointerUp = (pointer) => {
      if (this.dragPointerId !== pointer.id) return;
      this.stopDrag(pointer);
    };
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp);

    this.onResize = () => {
      this.uiCamera.setSize(scene.scale.width, scene.scale.height);
      this.layout();
      this.rebuild();
      this.update();
    };
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.onResize);
    this.worldInputGate.registerWheelBlocker(WHEEL_BLOCKER_ID, (screenX, screenY) => this.containsScreenPoint(screenX, screenY));
  }

  rebuild(): void {
    this.mapGfx.clear();
    this.mapGfx.fillStyle(0x0c1520, 1);
    this.mapGfx.fillRect(this.mapArea.x, this.mapArea.y, this.mapArea.width, this.mapArea.height);

    for (const row of this.mapData.tiles) {
      for (const tile of row) {
        const outline = this.tileMap.getTileOutlinePoints(tile.x, tile.y)
          .map((point) => this.worldToMini(point.x, point.y));
        if (outline.length < 3) continue;
        const nationColor = tile.ownerId !== undefined
          ? this.nationManager.getNation(tile.ownerId)?.color
          : undefined;
        this.mapGfx.fillStyle(nationColor ?? TERRAIN_COLORS[tile.type], nationColor !== undefined ? OWNED_TILE_ALPHA : 1);
        this.fillPolygon(this.mapGfx, outline);
      }
    }
  }

  update(): void {
    const camera = this.scene.cameras.main;
    const left = camera.scrollX;
    const top = camera.scrollY;
    const width = camera.width / camera.zoom;
    const height = camera.height / camera.zoom;
    const topLeft = this.worldToMini(left, top);

    this.viewportGfx.clear();
    this.viewportGfx.lineStyle(2, 0xfff5b8, 0.96);
    this.viewportGfx.strokeRect(
      topLeft.x,
      topLeft.y,
      width * this.worldToMiniScale,
      height * this.worldToMiniScale,
    );
  }

  shutdown(): void {
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.onResize);
    this.scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, this.onAddedToScene);
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.handlePointerUp);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp);
    this.worldInputGate.unregisterWheelBlocker(WHEEL_BLOCKER_ID);
    if (this.dragPointerId !== null) {
      this.worldInputGate.releasePointer(this.dragPointerId);
      this.dragPointerId = null;
    }
    this.scene.cameras.remove(this.uiCamera);
    this.container.destroy(true);
  }

  private layout(): void {
    const panelX = EDGE_MARGIN;
    const panelY = this.scene.scale.height - PANEL_HEIGHT - EDGE_MARGIN;
    this.container.setPosition(panelX, panelY);

    const contentWidth = PANEL_WIDTH - PANEL_PADDING * 2;
    const contentHeight = PANEL_HEIGHT - PANEL_PADDING * 2;
    this.worldToMiniScale = Math.min(
      contentWidth / this.worldBounds.width,
      contentHeight / this.worldBounds.height,
    );
    const drawnWidth = this.worldBounds.width * this.worldToMiniScale;
    const drawnHeight = this.worldBounds.height * this.worldToMiniScale;
    this.worldToMiniOffsetX = PANEL_PADDING + (contentWidth - drawnWidth) / 2;
    this.worldToMiniOffsetY = PANEL_PADDING + (contentHeight - drawnHeight) / 2;
    this.mapArea.setTo(this.worldToMiniOffsetX, this.worldToMiniOffsetY, drawnWidth, drawnHeight);
  }

  private centerCameraFromPointer(pointer: Phaser.Input.Pointer): void {
    const localX = Phaser.Math.Clamp(pointer.x - this.container.x, this.mapArea.x, this.mapArea.right);
    const localY = Phaser.Math.Clamp(pointer.y - this.container.y, this.mapArea.y, this.mapArea.bottom);
    const worldX = (localX - this.worldToMiniOffsetX) / this.worldToMiniScale;
    const worldY = (localY - this.worldToMiniOffsetY) / this.worldToMiniScale;
    this.cameraController.focusOn(worldX, worldY, this.cameraController.zoom);
    this.update();
  }

  private beginPointerNavigation(pointer: Phaser.Input.Pointer): void {
    if (pointer.button !== 0) return;
    if (!this.containsScreenPoint(pointer.x, pointer.y)) return;
    this.dragPointerId = pointer.id;
    this.worldInputGate.claimPointer(pointer.id);
    consumePointerEvent(pointer);
    this.centerCameraFromPointer(pointer);
  }

  private stopDrag(pointer: Phaser.Input.Pointer): void {
    consumePointerEvent(pointer);
    this.worldInputGate.releasePointer(pointer.id);
    this.dragPointerId = null;
  }

  private containsScreenPoint(screenX: number, screenY: number): boolean {
    return screenX >= this.container.x
      && screenX <= this.container.x + PANEL_WIDTH
      && screenY >= this.container.y
      && screenY <= this.container.y + PANEL_HEIGHT;
  }

  private worldToMini(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: this.worldToMiniOffsetX + worldX * this.worldToMiniScale,
      y: this.worldToMiniOffsetY + worldY * this.worldToMiniScale,
    };
  }

  private fillPolygon(graphics: Phaser.GameObjects.Graphics, points: Array<{ x: number; y: number }>): void {
    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) {
      graphics.lineTo(point.x, point.y);
    }
    graphics.closePath();
    graphics.fillPath();
  }

}
