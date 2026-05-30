import Phaser from 'phaser';
import type { WorldInputGate } from '../../systems/input/WorldInputGate';
import { consumePointerEvent } from '../../utils/phaserScreenSpaceUi';

type AddOwned = <T extends Phaser.GameObjects.GameObject>(object: T) => T;

const DEPTH = 146;
const WIDTH = 56;
const HEIGHT = 30;
const OVERLAP_X = 10;
const OFFSET_Y = 22;
const HUD_TEXT_RESOLUTION = getHudTextResolution();

export class IdleCitiesHudIndicator {
  private readonly background: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private readonly hitArea: Phaser.GameObjects.Zone;

  private count = 0;
  private hovered = false;
  private pressed = false;
  private clickHandler: (() => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    addOwned: AddOwned,
    private readonly worldInputGate: WorldInputGate,
  ) {
    this.background = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, WIDTH, HEIGHT, 0x172230, 0.94))
      .setOrigin(0, 0)
      .setDepth(DEPTH)
      .setScrollFactor(0)
      .setStrokeStyle(1, 0xf2d38b, 0.55)
      .setVisible(false);

    this.label = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, '', {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      color: '#fff1c7',
      fontStyle: 'bold',
    }))
      .setOrigin(0.5)
      .setDepth(DEPTH + 1)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION)
      .setVisible(false);

    this.hitArea = addOwned(new Phaser.GameObjects.Zone(scene, 0, 0, WIDTH, HEIGHT))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 2)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);

    this.hitArea.on(Phaser.Input.Events.POINTER_OVER, (
      _pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      if (this.count <= 0) return;
      this.hovered = true;
      this.refreshVisualState();
    });
    this.hitArea.on(Phaser.Input.Events.POINTER_OUT, (
      _pointer: Phaser.Input.Pointer,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      this.hovered = false;
      this.pressed = false;
      this.refreshVisualState();
    });
    this.hitArea.on(Phaser.Input.Events.POINTER_DOWN, (
      pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      if (this.count <= 0 || pointer.button !== 0) return;
      this.worldInputGate.claimPointer(pointer.id);
      this.pressed = true;
      consumePointerEvent(pointer);
      this.refreshVisualState();
    });
    this.hitArea.on(Phaser.Input.Events.POINTER_UP, (
      pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      if (pointer.button !== 0) return;
      consumePointerEvent(pointer);
      const shouldClick = this.count > 0 && this.pressed;
      this.pressed = false;
      this.worldInputGate.releasePointer(pointer.id);
      this.refreshVisualState();
      if (shouldClick) this.clickHandler?.();
    });

    this.refreshVisualState();
  }

  setCount(count: number): void {
    const nextCount = Math.max(0, Math.floor(count));
    if (this.count === nextCount) return;
    this.count = nextCount;
    this.label.setText(`🏛️ ${nextCount}`);
    if (nextCount <= 0) {
      this.hovered = false;
      this.pressed = false;
    }
    this.refreshVisualState();
  }

  setOnClick(handler: () => void): void {
    this.clickHandler = handler;
  }

  layout(endTurnLayout: { centerX: number; centerY: number; radius: number }): void {
    const x = Math.round(endTurnLayout.centerX + endTurnLayout.radius - WIDTH + OVERLAP_X);
    const y = Math.round(endTurnLayout.centerY - endTurnLayout.radius + OFFSET_Y);

    this.background.setPosition(x, y).setDisplaySize(WIDTH, HEIGHT);
    this.label.setPosition(x + (WIDTH / 2), y + (HEIGHT / 2));
    this.hitArea.setPosition(x, y).setSize(WIDTH, HEIGHT);
    this.refreshVisualState();
  }

  destroy(): void {
    this.background.destroy();
    this.label.destroy();
    this.hitArea.destroy();
  }

  private refreshVisualState(): void {
    const visible = this.count > 0;
    this.background.setVisible(visible);
    this.label.setVisible(visible);
    this.hitArea.setVisible(visible);

    if (!visible) {
      this.hitArea.disableInteractive();
      return;
    }

    if (!this.hitArea.input?.enabled) {
      this.hitArea.setInteractive({ useHandCursor: true });
      this.hitArea.input!.cursor = 'pointer';
    }

    const fillColor = this.pressed
      ? 0x7f541f
      : this.hovered
        ? 0x26364b
        : 0x172230;
    const strokeAlpha = this.hovered ? 0.88 : 0.55;
    const scale = this.pressed ? 0.97 : this.hovered ? 1.03 : 1;

    this.background
      .setFillStyle(fillColor, 0.94)
      .setStrokeStyle(this.hovered ? 2 : 1, 0xf2d38b, strokeAlpha)
      .setScale(scale);
    this.label
      .setScale(scale)
      .setColor(this.hovered ? '#fff7dd' : '#fff1c7');
  }
}

function getHudTextResolution(): number {
  if (typeof window === 'undefined') return 1;
  return Math.max(1, Math.min(2, window.devicePixelRatio || 1));
}
