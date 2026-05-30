import Phaser from 'phaser';
import type { WorldInputGate } from '../../systems/input/WorldInputGate';
import { consumePointerEvent } from '../../utils/phaserScreenSpaceUi';
import type { RightSidebarButtonRow, RightSidebarRow } from '../phaser/RightSidebarPanelTypes';

type AddOwned = <T extends Phaser.GameObjects.GameObject>(object: T) => T;
type RemoveOwned = (object: Phaser.GameObjects.GameObject) => void;

interface ListButton {
  row: RightSidebarButtonRow;
  background: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  reasonLabel?: Phaser.GameObjects.Text;
  hitArea: Phaser.GameObjects.Zone;
  height: number;
  hovered: boolean;
  pressed: boolean;
}

const LEFT_PAD = 4;
const ROW_GAP = 8;
const BUTTON_HEIGHT = 34;
const DISABLED_BUTTON_HEIGHT = 50;
const SEPARATOR_HEIGHT = 16;
const PROGRESS_HEIGHT = 22;
const SCROLL_STEP = 48;
const TEXT_RESOLUTION = getHudTextResolution();

/**
 * A compact, scrollable renderer for {@link RightSidebarRow} lists, used by the
 * Leader Audience chamber to host the relocated diplomacy and trade controls.
 *
 * It deliberately reuses the same row model as the right sidebar so the data
 * provider remains the single source of diplomacy/trade logic — this class only
 * paints rows and forwards button clicks. Objects are registered through the
 * owning dialog's add/remove callbacks so they share the dialog's UI camera.
 */
export class AudienceActionList {
  private rows: RightSidebarRow[] = [];
  private objects: Phaser.GameObjects.GameObject[] = [];
  private buttons: ListButton[] = [];
  private readonly maskGraphics: Phaser.GameObjects.Graphics;
  private readonly mask: Phaser.Display.Masks.GeometryMask;
  private region = { x: 0, y: 0, width: 0, height: 0 };
  private scrollOffset = 0;
  private contentHeight = 0;
  private visible = false;
  private readonly handleWheel: (
    pointer: Phaser.Input.Pointer,
    objectsUnderPointer: Phaser.GameObjects.GameObject[],
    deltaX: number,
    deltaY: number,
  ) => void;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly worldInputGate: WorldInputGate,
    private readonly addOwned: AddOwned,
    private readonly removeOwned: RemoveOwned,
    private readonly depth: number,
  ) {
    this.maskGraphics = this.addOwned(new Phaser.GameObjects.Graphics(scene)).setScrollFactor(0);
    this.mask = this.maskGraphics.createGeometryMask();

    this.handleWheel = (pointer, _objects, _deltaX, deltaY) => {
      if (!this.visible) return;
      if (!this.containsPoint(pointer.x, pointer.y)) return;
      if (this.contentHeight <= this.region.height) return;
      consumePointerEvent(pointer);
      this.scrollBy(Math.sign(deltaY) * SCROLL_STEP);
    };
    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, this.handleWheel);
  }

  setRows(rows: RightSidebarRow[]): void {
    this.rows = rows;
    this.scrollOffset = 0;
  }

  layout(x: number, y: number, width: number, height: number): void {
    this.region = { x, y, width, height };
    this.maskGraphics.clear();
    this.maskGraphics.fillStyle(0xffffff, 1);
    this.maskGraphics.fillRect(x, y, width, height);
    this.rebuild();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    for (const object of this.objects) {
      if (object instanceof Phaser.GameObjects.Zone) continue;
      (object as Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible).setVisible(visible);
    }
    for (const button of this.buttons) this.applyButtonInteractive(button);
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_WHEEL, this.handleWheel);
    this.clearObjects();
    this.removeOwned(this.maskGraphics);
  }

  private scrollBy(delta: number): void {
    const max = Math.max(0, this.contentHeight - this.region.height);
    const next = Math.min(max, Math.max(0, this.scrollOffset + delta));
    if (next === this.scrollOffset) return;
    this.scrollOffset = next;
    this.rebuild();
  }

  private clearObjects(): void {
    for (const object of this.objects) this.removeOwned(object);
    this.objects = [];
    this.buttons = [];
  }

  private rebuild(reclamped = false): void {
    this.clearObjects();
    const { x, y: regionTop, width } = this.region;
    let y = regionTop - this.scrollOffset;
    const startY = y;
    for (const row of this.rows) {
      y = this.renderRow(row, x, y, width);
    }
    this.contentHeight = y - startY;

    const max = Math.max(0, this.contentHeight - this.region.height);
    if (!reclamped && this.scrollOffset > max) {
      this.scrollOffset = max;
      this.rebuild(true);
      return;
    }
    for (const button of this.buttons) this.applyButtonInteractive(button);
  }

  private renderRow(row: RightSidebarRow, x: number, y: number, width: number): number {
    switch (row.kind) {
      case 'text':
        return this.renderText(row.text, row.muted ?? false, row.large ?? false, row.color, x, y, width);
      case 'button':
        return this.renderButton(row, x, y, width);
      case 'separator': {
        this.track(new Phaser.GameObjects.Rectangle(this.scene, x + LEFT_PAD, y + 6, width - LEFT_PAD * 2, 1, 0x7f8b99, 0.28).setOrigin(0, 0));
        return y + SEPARATOR_HEIGHT;
      }
      case 'progress':
        return this.renderProgress(row.label, row.current, row.max, x, y, width);
      default:
        return y;
    }
  }

  private renderText(text: string, muted: boolean, large: boolean, color: number | undefined, x: number, y: number, width: number): number {
    const hasAccent = color !== undefined;
    const textX = x + LEFT_PAD + (hasAccent ? 12 : 0);
    const wrapWidth = width - LEFT_PAD * 2 - (hasAccent ? 12 : 0);
    if (hasAccent) {
      this.track(new Phaser.GameObjects.Rectangle(this.scene, x + LEFT_PAD, y + 4, 6, Math.max(14, large ? 20 : 16), color, 0.95).setOrigin(0, 0));
    }
    const colorHex = muted ? '#c1cbd8' : large ? '#ffffff' : '#edf4ff';
    const label = this.track(this.makeText(text, large ? 18 : 15, colorHex, large ? 'bold' : 'normal'));
    label.setWordWrapWidth(wrapWidth, true);
    label.setPosition(textX, y);
    return y + label.height + ROW_GAP;
  }

  private renderButton(row: RightSidebarButtonRow, x: number, y: number, width: number): number {
    const w = width - LEFT_PAD * 2;
    const height = row.disabled && row.disabledReason ? DISABLED_BUTTON_HEIGHT : BUTTON_HEIGHT;
    const background = this.track(new Phaser.GameObjects.Rectangle(this.scene, x + LEFT_PAD, y, w, height, 0x0f2635, 0.98).setOrigin(0, 0));
    const label = this.track(this.makeText(row.text, 15, '#ffffff', 'bold'));
    label.setWordWrapWidth(w - 20, true);
    label.setPosition(x + LEFT_PAD + 11, y + (row.disabled && row.disabledReason ? 7 : (height - label.height) / 2));
    const reasonLabel = row.disabled && row.disabledReason
      ? this.track(this.makeText(row.disabledReason, 12, '#b8c0ca', 'normal'))
      : undefined;
    reasonLabel?.setWordWrapWidth(w - 20, true);
    reasonLabel?.setPosition(x + LEFT_PAD + 11, y + 27);
    const hitArea = this.track(new Phaser.GameObjects.Zone(this.scene, x + LEFT_PAD, y, w, height).setOrigin(0, 0).setScrollFactor(0));

    const button: ListButton = { row, background, label, reasonLabel, hitArea, height, hovered: false, pressed: false };
    this.buttons.push(button);
    this.installButtonInput(button);
    this.refreshButtonVisual(button);
    return y + height + ROW_GAP;
  }

  private renderProgress(label: string, current: number, max: number, x: number, y: number, width: number): number {
    const w = width - LEFT_PAD * 2;
    const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
    this.track(new Phaser.GameObjects.Rectangle(this.scene, x + LEFT_PAD, y, w, PROGRESS_HEIGHT, 0x10202c, 0.9).setOrigin(0, 0));
    this.track(new Phaser.GameObjects.Rectangle(this.scene, x + LEFT_PAD, y, w * ratio, PROGRESS_HEIGHT, 0x3a7b9c, 0.95).setOrigin(0, 0));
    const text = this.track(this.makeText(`${label}: ${Math.round(current)}/${Math.round(max)}`, 13, '#edf4ff', 'normal'));
    text.setPosition(x + LEFT_PAD + 8, y + (PROGRESS_HEIGHT - text.height) / 2);
    return y + PROGRESS_HEIGHT + ROW_GAP;
  }

  private installButtonInput(button: ListButton): void {
    const { hitArea } = button;
    hitArea.on(Phaser.Input.Events.POINTER_OVER, (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      button.hovered = true;
      this.refreshButtonVisual(button);
    });
    hitArea.on(Phaser.Input.Events.POINTER_OUT, (_p: Phaser.Input.Pointer, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      button.hovered = false;
      button.pressed = false;
      this.refreshButtonVisual(button);
    });
    hitArea.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (pointer.button !== 0) return;
      this.worldInputGate.claimPointer(pointer.id);
      button.pressed = true;
      consumePointerEvent(pointer);
      this.refreshButtonVisual(button);
    });
    hitArea.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (pointer.button !== 0) return;
      consumePointerEvent(pointer);
      const shouldClick = button.pressed && !button.row.disabled;
      button.pressed = false;
      this.worldInputGate.releasePointer(pointer.id);
      this.refreshButtonVisual(button);
      if (shouldClick) button.row.onClick();
    });
  }

  private applyButtonInteractive(button: ListButton): void {
    // Visuals are clipped by the geometry mask, but hit zones are not — so a
    // button scrolled outside the region must have its zone disabled to avoid
    // an invisible, mis-placed click target.
    const top = button.background.y;
    const withinRegion = top + button.height > this.region.y && top < this.region.y + this.region.height;
    if (this.visible && !button.row.disabled && withinRegion) {
      if (!button.hitArea.input?.enabled) button.hitArea.setInteractive({ cursor: 'pointer' });
    } else {
      button.hitArea.disableInteractive();
    }
  }

  private refreshButtonVisual(button: ListButton): void {
    const { row } = button;
    const fillColor = row.disabled
      ? 0x2a3038
      : button.pressed
        ? 0x2f6688
        : button.hovered
          ? 0x1e4c66
          : row.selected
            ? 0x225872
            : 0x0f2635;
    button.background.setFillStyle(fillColor, row.disabled ? 0.52 : 0.98);
    button.background.setStrokeStyle(
      row.selected ? 2 : 1,
      row.disabled ? 0x69717c : row.accentColor ?? 0x6fb2d4,
      row.disabled ? 0.38 : button.hovered || row.selected ? 0.95 : 0.68,
    );
    button.label
      .setColor(row.disabled ? '#b8c0ca' : '#ffffff')
      .setAlpha(row.disabled ? 0.82 : 1);
    button.reasonLabel?.setAlpha(row.disabled ? 0.86 : 0);
  }

  private makeText(text: string, size: number, color: string, style: 'normal' | 'bold'): Phaser.GameObjects.Text {
    return new Phaser.GameObjects.Text(this.scene, 0, 0, text, {
      fontFamily: 'sans-serif',
      fontSize: `${size}px`,
      color,
      fontStyle: style,
    })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setResolution(TEXT_RESOLUTION);
  }

  /**
   * Register a freshly created game object: add it to the scene through the
   * dialog's owner callback, depth/visibility/mask it, and track it for cleanup.
   */
  private track<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.addOwned(object);
    (object as unknown as Phaser.GameObjects.Components.Depth).setDepth(this.depth);
    if (!(object instanceof Phaser.GameObjects.Zone)) {
      const masked = object as unknown as Phaser.GameObjects.Components.Visible & {
        setMask(mask: Phaser.Display.Masks.GeometryMask): unknown;
      };
      masked.setVisible(this.visible);
      masked.setMask(this.mask);
    }
    this.objects.push(object);
    return object;
  }

  private containsPoint(screenX: number, screenY: number): boolean {
    const { x, y, width, height } = this.region;
    return screenX >= x && screenX <= x + width && screenY >= y && screenY <= y + height;
  }
}

function getHudTextResolution(): number {
  if (typeof window === 'undefined') return 2;
  return Math.max(2, Math.ceil(window.devicePixelRatio || 1));
}
