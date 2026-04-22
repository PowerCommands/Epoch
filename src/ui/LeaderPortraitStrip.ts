import Phaser from 'phaser';
import { getLeaderByNationId } from '../data/leaders';
import type { Nation } from '../entities/Nation';
import type { DiscoverySystem } from '../systems/DiscoverySystem';
import type { NationManager } from '../systems/NationManager';
import type { LeaderDefinition } from '../types/leader';
import { consumePointerEvent } from '../utils/phaserScreenSpaceUi';

// Match the previous HTML portrait proportions:
//   width 64px, height 82px, border-radius 50% / 43%  →  tall cameo oval.
const PORTRAIT_SCALE = 1.2;
const PORTRAIT_WIDTH = Math.round(64 * PORTRAIT_SCALE);
const PORTRAIT_HEIGHT = Math.round(82 * PORTRAIT_SCALE);
const PORTRAIT_SPACING = Math.round(10 * PORTRAIT_SCALE);
const STRIP_TOP_OFFSET = 16;
const STRIP_DEPTH = 100;
const BG_COLOR = 0x151515;
const FRAME_COLOR = 0x4a3a2a;

interface PortraitEntry {
  nationId: string;
  hit: Phaser.GameObjects.Rectangle;
  bg: Phaser.GameObjects.Ellipse;
  image: Phaser.GameObjects.Image | null;
  mask: Phaser.GameObjects.Graphics | null;
  imageBaseScale: number;
  border: Phaser.GameObjects.Ellipse;
}

/**
 * LeaderPortraitStrip — Phaser UI layer rendered by a dedicated camera that
 * stays at zoom 1 and scroll (0,0), so the portraits never pan or scale with
 * the world camera. Main camera ignores every strip-owned object; the UI
 * camera ignores everything that isn't strip-owned, including objects created
 * after this class is constructed.
 */
export class LeaderPortraitStrip {
  private readonly scene: Phaser.Scene;
  private readonly nationManager: NationManager;
  private readonly discoverySystem: DiscoverySystem | null;
  private readonly humanNationId: string | undefined;

  private readonly uiCamera: Phaser.Cameras.Scene2D.Camera;
  private readonly owned = new Set<Phaser.GameObjects.GameObject>();

  private readonly tooltipBg: Phaser.GameObjects.Rectangle;
  private readonly tooltipText: Phaser.GameObjects.Text;

  private entries: PortraitEntry[] = [];
  private selectedNationId: string | null = null;
  private readonly onResize: () => void;
  private readonly onAddedToScene: (go: Phaser.GameObjects.GameObject) => void;

  constructor(
    scene: Phaser.Scene,
    nationManager: NationManager,
    discoverySystem: DiscoverySystem | null,
    humanNationId: string | undefined,
  ) {
    this.scene = scene;
    this.nationManager = nationManager;
    this.discoverySystem = discoverySystem;
    this.humanNationId = humanNationId;

    // Dedicated UI camera — fixed viewport, no scroll, no zoom.
    this.uiCamera = scene.cameras.add(0, 0, scene.scale.width, scene.scale.height);
    this.uiCamera.setScroll(0, 0);
    this.uiCamera.setZoom(1);

    // Every object that already exists belongs to the world; the UI camera
    // must never render those.
    this.uiCamera.ignore(scene.children.list);

    // For every future scene child, decide which camera owns it. Our objects
    // are pre-tracked in `owned` before being added, so we can branch here.
    this.onAddedToScene = (go) => {
      if (this.owned.has(go)) {
        scene.cameras.main.ignore(go);
      } else {
        this.uiCamera.ignore(go);
      }
    };
    scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, this.onAddedToScene);

    this.tooltipBg = this.addOwned(
      new Phaser.GameObjects.Rectangle(scene, 0, 0, 10, 10, 0x000000, 0.85),
    )
      .setOrigin(0.5, 0)
      .setDepth(STRIP_DEPTH + 10)
      .setScrollFactor(0)
      .setStrokeStyle(1, 0xffffff, 0.35)
      .setVisible(false);

    this.tooltipText = this.addOwned(
      new Phaser.GameObjects.Text(scene, 0, 0, '', {
        fontFamily: 'sans-serif',
        fontSize: '12px',
        color: '#ffffff',
        align: 'center',
      }),
    )
      .setOrigin(0.5, 0)
      .setDepth(STRIP_DEPTH + 11)
      .setScrollFactor(0)
      .setVisible(false);

    this.onResize = () => {
      this.uiCamera.setSize(scene.scale.width, scene.scale.height);
      this.layout();
    };
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.onResize);

    this.rebuild();
  }

  /** Create-then-claim: add to our set first so `onAddedToScene` branches correctly. */
  private addOwned<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.owned.add(obj);
    this.scene.add.existing(obj);
    return obj;
  }

  rebuild(): void {
    this.destroyEntries();
    for (const nation of this.getVisibleNations()) {
      this.entries.push(this.createEntry(nation, getLeaderByNationId(nation.id)));
    }
    this.layout();
    this.applySelectionHighlight();
  }

  setSelectedNation(nationId: string | null): void {
    this.selectedNationId = nationId;
    this.applySelectionHighlight();
  }

  shutdown(): void {
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.onResize);
    this.scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, this.onAddedToScene);
    this.destroyEntries();
    this.tooltipBg.destroy();
    this.tooltipText.destroy();
    this.owned.clear();
    this.scene.cameras.remove(this.uiCamera);
  }

  private destroyEntries(): void {
    this.hideTooltip();
    for (const entry of this.entries) {
      this.owned.delete(entry.hit);
      this.owned.delete(entry.bg);
      this.owned.delete(entry.border);
      if (entry.image) this.owned.delete(entry.image);
      if (entry.mask) this.owned.delete(entry.mask);
      entry.hit.destroy();
      entry.bg.destroy();
      entry.border.destroy();
      if (entry.image) {
        entry.image.clearMask(true);
        entry.image.destroy();
      }
      if (entry.mask) entry.mask.destroy();
    }
    this.entries = [];
  }

  private getVisibleNations(): Nation[] {
    const all = this.nationManager.getAllNations();
    if (!this.discoverySystem || !this.humanNationId) return all;
    const humanId = this.humanNationId;
    return all.filter((n) => this.discoverySystem!.hasMet(humanId, n.id));
  }

  private createEntry(nation: Nation, leader: LeaderDefinition | undefined): PortraitEntry {
    const w = PORTRAIT_WIDTH;
    const h = PORTRAIT_HEIGHT;

    // Transparent rectangle over the oval bounding box — handles pointer input.
    const hit = this.addOwned(
      new Phaser.GameObjects.Rectangle(this.scene, 0, 0, w, h, 0x000000, 0),
    )
      .setOrigin(0.5)
      .setDepth(STRIP_DEPTH + 3)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });

    // Dark oval background + subtle frame ring, matching the old CSS.
    const bg = this.addOwned(
      new Phaser.GameObjects.Ellipse(this.scene, 0, 0, w, h, BG_COLOR, 1),
    )
      .setOrigin(0.5)
      .setDepth(STRIP_DEPTH)
      .setScrollFactor(0)
      .setStrokeStyle(1, FRAME_COLOR, 1);

    // Leader image clipped to the oval via a geometry mask.
    let image: Phaser.GameObjects.Image | null = null;
    let mask: Phaser.GameObjects.Graphics | null = null;
    let imageBaseScale = 1;
    const textureKey = leader ? `leader_${leader.id}` : null;
    if (textureKey && this.scene.textures.exists(textureKey)) {
      image = this.addOwned(
        new Phaser.GameObjects.Image(this.scene, 0, 0, textureKey),
      )
        .setOrigin(0.5)
        .setDepth(STRIP_DEPTH + 1)
        .setScrollFactor(0);

      // object-fit: cover equivalent — preserve aspect, fill the oval, clip rest.
      const tw = image.width;
      const th = image.height;
      imageBaseScale = (tw > 0 && th > 0) ? Math.max(w / tw, h / th) : 1;
      image.setScale(imageBaseScale);

      // Mask graphics is a stencil source only — never added to the display
      // list, so it doesn't participate in camera ignore lists at all. Its
      // transform follows whichever camera renders the masked image.
      mask = new Phaser.GameObjects.Graphics(this.scene);
      mask.setScrollFactor(0);
      mask.fillStyle(0xffffff, 1);
      mask.fillEllipse(0, 0, w, h);
      image.setMask(mask.createGeometryMask());
    }

    // Nation-colored stroked oval sitting on top of the image.
    const border = this.addOwned(
      new Phaser.GameObjects.Ellipse(this.scene, 0, 0, w, h, 0x000000, 0),
    )
      .setOrigin(0.5)
      .setDepth(STRIP_DEPTH + 2)
      .setScrollFactor(0)
      .setStrokeStyle(2, nation.color, 0.95);

    hit.on(Phaser.Input.Events.POINTER_OVER, (
      _pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      this.showTooltip(hit, nation, leader);
    });
    hit.on(Phaser.Input.Events.POINTER_OUT, (
      _pointer: Phaser.Input.Pointer,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      this.hideTooltip();
    });

    hit.on(Phaser.Input.Events.POINTER_DOWN, (
      pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      if (pointer.button !== 0) return;
      event.stopPropagation();
      consumePointerEvent(pointer);
    });

    hit.on(Phaser.Input.Events.POINTER_UP, (
      pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      if (pointer.button !== 0) return;
      event.stopPropagation();
      consumePointerEvent(pointer);

      document.dispatchEvent(new CustomEvent('leaderSelected', {
        detail: { nationId: nation.id, leaderId: leader?.id },
      }));
    });

    return { nationId: nation.id, hit, bg, image, mask, imageBaseScale, border };
  }

  private layout(): void {
    const count = this.entries.length;
    if (count === 0) return;

    const viewportWidth = this.scene.scale.width;
    const totalWidth = count * PORTRAIT_WIDTH + (count - 1) * PORTRAIT_SPACING;
    const startX = viewportWidth / 2 - totalWidth / 2 + PORTRAIT_WIDTH / 2;
    const y = STRIP_TOP_OFFSET + PORTRAIT_HEIGHT / 2;

    for (let i = 0; i < count; i++) {
      const entry = this.entries[i];
      const x = startX + i * (PORTRAIT_WIDTH + PORTRAIT_SPACING);
      entry.hit.setPosition(x, y);
      entry.bg.setPosition(x, y);
      entry.border.setPosition(x, y);
      if (entry.image) entry.image.setPosition(x, y);
      if (entry.mask) entry.mask.setPosition(x, y);
    }
  }

  private applySelectionHighlight(): void {
    for (const entry of this.entries) {
      const nation = this.nationManager.getNation(entry.nationId);
      const color = nation?.color ?? 0xffffff;
      const isSelected = entry.nationId === this.selectedNationId;
      const selectionScale = isSelected ? 1.08 : 1;
      entry.border.setStrokeStyle(isSelected ? 3 : 2, color, 0.95);
      entry.hit.setScale(selectionScale);
      entry.bg.setScale(selectionScale);
      entry.border.setScale(selectionScale);
      if (entry.image) entry.image.setScale(entry.imageBaseScale * selectionScale);
      if (entry.mask) entry.mask.setScale(selectionScale);
    }
  }

  private showTooltip(hit: Phaser.GameObjects.Rectangle, nation: Nation, leader: LeaderDefinition | undefined): void {
    const leaderName = leader?.name ?? 'Unknown leader';
    this.tooltipText.setText(`${leaderName}\n${nation.name}`);

    const padX = 8;
    const padY = 4;
    const bgWidth = this.tooltipText.width + padX * 2;
    const bgHeight = this.tooltipText.height + padY * 2;
    const tooltipY = hit.y + PORTRAIT_HEIGHT / 2 + 6;

    this.tooltipBg.setSize(bgWidth, bgHeight);
    this.tooltipBg.setPosition(hit.x, tooltipY);
    this.tooltipBg.setVisible(true);

    this.tooltipText.setPosition(hit.x, tooltipY + padY);
    this.tooltipText.setVisible(true);
  }

  private hideTooltip(): void {
    this.tooltipBg.setVisible(false);
    this.tooltipText.setVisible(false);
  }
}
