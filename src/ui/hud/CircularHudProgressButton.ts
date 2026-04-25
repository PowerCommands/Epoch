import Phaser from 'phaser';
import type { WorldInputGate } from '../../systems/input/WorldInputGate';
import { consumePointerEvent } from '../../utils/phaserScreenSpaceUi';

type AddOwned = <T extends Phaser.GameObjects.GameObject>(object: T) => T;

interface CircularHudProgressButtonConfig {
  depth: number;
  diameter: number;
  hitDiameter: number;
  icon: string;
  iconSize: number;
  progressColor: number;
  accentColor: number;
}

const BACKGROUND_COLOR = 0x0c141d;
const HOVER_BACKGROUND_COLOR = 0x15303f;
const PRESSED_BACKGROUND_COLOR = 0x16394b;
const ACTIVE_STROKE_COLOR = 0xeff7ff;
const MUTED_PROGRESS_COLOR = 0x223142;
const PROGRESS_START_ANGLE = Phaser.Math.DegToRad(-90);
const PROGRESS_END_ANGLE = Phaser.Math.DegToRad(270);
const RING_LINE_WIDTH = 5;
const RIM_LINE_WIDTH = 3;
const TOOLTIP_PADDING_X = 10;
const TOOLTIP_PADDING_Y = 7;
const TOOLTIP_GAP = 8;

export class CircularHudProgressButton {
  private readonly background: Phaser.GameObjects.Arc;
  private readonly rim: Phaser.GameObjects.Arc;
  private readonly progressRing: Phaser.GameObjects.Graphics;
  private readonly icon: Phaser.GameObjects.Text;
  private readonly hitArea: Phaser.GameObjects.Zone;
  private readonly tooltipBackground: Phaser.GameObjects.Rectangle;
  private readonly tooltipText: Phaser.GameObjects.Text;

  private centerX = 0;
  private centerY = 0;
  private progress = 0;
  private tooltip = '';
  private hovered = false;
  private pressed = false;
  private active = false;
  private clickHandler: (() => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    addOwned: AddOwned,
    private readonly worldInputGate: WorldInputGate,
    private readonly config: CircularHudProgressButtonConfig,
  ) {
    const radius = config.diameter / 2;

    this.background = addOwned(new Phaser.GameObjects.Arc(scene, 0, 0, radius, 0, 360, false, BACKGROUND_COLOR, 0.94))
      .setDepth(config.depth)
      .setScrollFactor(0);
    this.rim = addOwned(new Phaser.GameObjects.Arc(scene, 0, 0, radius + 2, 0, 360, false, 0x000000, 0))
      .setDepth(config.depth + 1)
      .setScrollFactor(0);
    this.progressRing = addOwned(new Phaser.GameObjects.Graphics(scene))
      .setDepth(config.depth + 2)
      .setScrollFactor(0);
    this.icon = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, config.icon, {
      fontFamily: 'sans-serif',
      fontSize: `${config.iconSize}px`,
      color: '#eef7ff',
    }))
      .setOrigin(0.5)
      .setDepth(config.depth + 3)
      .setScrollFactor(0)
      .setResolution(getHudTextResolution());
    this.hitArea = addOwned(new Phaser.GameObjects.Zone(scene, 0, 0, config.hitDiameter, config.hitDiameter))
      .setOrigin(0.5)
      .setDepth(config.depth + 4)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.tooltipBackground = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, 10, 10, 0x081018, 0.96))
      .setOrigin(0, 0)
      .setDepth(config.depth + 20)
      .setScrollFactor(0)
      .setStrokeStyle(1, config.accentColor, 0.65)
      .setVisible(false);
    this.tooltipText = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, '', {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: '#f4f1e7',
      wordWrap: { width: 280, useAdvancedWrap: true },
    }))
      .setOrigin(0, 0)
      .setDepth(config.depth + 21)
      .setScrollFactor(0)
      .setResolution(getHudTextResolution())
      .setVisible(false);

    this.hitArea.on(Phaser.Input.Events.POINTER_OVER, (
      _pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      this.hovered = true;
      this.refreshVisualState();
      this.refreshTooltip();
    });
    this.hitArea.on(Phaser.Input.Events.POINTER_OUT, (
      _pointer: Phaser.Input.Pointer,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      this.hovered = false;
      this.pressed = false;
      this.refreshVisualState();
      this.hideTooltip();
    });
    this.hitArea.on(Phaser.Input.Events.POINTER_DOWN, (
      pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      if (pointer.button !== 0) return;
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
      const shouldClick = this.pressed;
      this.pressed = false;
      this.worldInputGate.releasePointer(pointer.id);
      if (shouldClick) {
        this.clickHandler?.();
      }
      this.refreshVisualState();
    });

    this.refreshVisualState();
  }

  setOnClick(handler: () => void): void {
    this.clickHandler = handler;
  }

  setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    this.refreshVisualState();
  }

  setProgress(progress: number): void {
    const clamped = Phaser.Math.Clamp(progress, 0, 1);
    if (this.progress === clamped) return;
    this.progress = clamped;
    this.drawProgressRing();
  }

  setTooltip(tooltip: string): void {
    this.tooltip = tooltip;
    this.refreshTooltip();
  }

  layout(topLeftX: number, topLeftY: number): void {
    const radius = this.config.diameter / 2;
    this.centerX = Math.round(topLeftX + radius);
    this.centerY = Math.round(topLeftY + radius);

    this.background.setPosition(this.centerX, this.centerY).setRadius(radius);
    this.rim.setPosition(this.centerX, this.centerY).setRadius(radius + 2);
    this.icon.setPosition(this.centerX, this.centerY);
    this.hitArea.setPosition(this.centerX, this.centerY).setSize(this.config.hitDiameter, this.config.hitDiameter);
    this.drawProgressRing();
    this.refreshVisualState();
    this.refreshTooltip();
  }

  destroy(): void {
    this.background.destroy();
    this.rim.destroy();
    this.progressRing.destroy();
    this.icon.destroy();
    this.hitArea.destroy();
    this.tooltipBackground.destroy();
    this.tooltipText.destroy();
  }

  private refreshVisualState(): void {
    const fillColor = this.pressed
      ? PRESSED_BACKGROUND_COLOR
      : this.hovered
        ? HOVER_BACKGROUND_COLOR
        : BACKGROUND_COLOR;
    const scale = this.pressed ? 0.96 : this.hovered ? 1.04 : 1;

    this.background
      .setFillStyle(fillColor, 0.94)
      .setScale(scale);
    this.rim
      .setStrokeStyle(
        this.active ? 4 : RIM_LINE_WIDTH,
        this.active ? ACTIVE_STROKE_COLOR : this.config.accentColor,
        this.hovered || this.active ? 0.95 : 0.72,
      )
      .setScale(scale);
    this.icon.setScale(scale);
  }

  private refreshTooltip(): void {
    if (!this.hovered || !this.tooltip) {
      this.hideTooltip();
      return;
    }

    this.tooltipText.setText(this.tooltip);
    const width = this.tooltipText.width + TOOLTIP_PADDING_X * 2;
    const height = this.tooltipText.height + TOOLTIP_PADDING_Y * 2;
    const left = Phaser.Math.Clamp(
      this.centerX + (this.config.diameter / 2) + TOOLTIP_GAP,
      8,
      Math.max(8, this.scene.scale.width - width - 8),
    );
    const top = Phaser.Math.Clamp(
      this.centerY - (height / 2),
      8,
      Math.max(8, this.scene.scale.height - height - 8),
    );

    this.tooltipBackground
      .setPosition(Math.round(left), Math.round(top))
      .setDisplaySize(width, height)
      .setVisible(true);
    this.tooltipText
      .setPosition(Math.round(left + TOOLTIP_PADDING_X), Math.round(top + TOOLTIP_PADDING_Y))
      .setVisible(true);
  }

  private hideTooltip(): void {
    this.tooltipBackground.setVisible(false);
    this.tooltipText.setVisible(false);
  }

  private drawProgressRing(): void {
    const ringRadius = (this.config.diameter / 2) + 6;
    this.progressRing.clear();
    this.progressRing.lineStyle(RING_LINE_WIDTH, MUTED_PROGRESS_COLOR, 0.72);
    this.progressRing.beginPath();
    this.progressRing.arc(this.centerX, this.centerY, ringRadius, PROGRESS_START_ANGLE, PROGRESS_END_ANGLE, false);
    this.progressRing.strokePath();

    if (this.progress <= 0) return;
    this.progressRing.lineStyle(RING_LINE_WIDTH, this.config.progressColor, 0.96);
    this.progressRing.beginPath();
    this.progressRing.arc(
      this.centerX,
      this.centerY,
      ringRadius,
      PROGRESS_START_ANGLE,
      PROGRESS_START_ANGLE + (Math.PI * 2 * this.progress),
      false,
    );
    this.progressRing.strokePath();
  }
}

function getHudTextResolution(): number {
  if (typeof window === 'undefined') return 2;
  return Math.max(2, Math.ceil(window.devicePixelRatio || 1));
}
