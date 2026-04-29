import Phaser from 'phaser';

type AddOwned = <T extends Phaser.GameObjects.GameObject>(object: T) => T;

const DEPTH = 260;
const PADDING_X = 10;
const PADDING_Y = 7;
const OFFSET_X = 12;
const OFFSET_Y = 14;

export class Tooltip {
  private readonly background: Phaser.GameObjects.Rectangle;
  private readonly text: Phaser.GameObjects.Text;
  private pointer: Phaser.Input.Pointer | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    addOwned: AddOwned,
  ) {
    this.background = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, 10, 10, 0x081018, 0.96))
      .setOrigin(0, 0)
      .setDepth(DEPTH)
      .setScrollFactor(0)
      .setStrokeStyle(1, 0x6f89a2, 0.75)
      .setVisible(false);

    this.text = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      color: '#edf5ff',
      wordWrap: { width: 240 },
    }))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 1)
      .setScrollFactor(0)
      .setVisible(false);

    this.scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove);
  }

  show(text: string, pointer: Phaser.Input.Pointer): void {
    this.pointer = pointer;
    this.text.setText(text);
    this.background
      .setSize(this.text.width + PADDING_X * 2, this.text.height + PADDING_Y * 2)
      .setVisible(true);
    this.text.setVisible(true);
    this.positionAt(pointer);
  }

  hide(): void {
    this.pointer = null;
    this.background.setVisible(false);
    this.text.setVisible(false);
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove);
    this.background.destroy();
    this.text.destroy();
  }

  private readonly handlePointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (this.pointer === null || pointer.id !== this.pointer.id || !this.background.visible) return;
    this.positionAt(pointer);
  };

  private positionAt(pointer: Phaser.Input.Pointer): void {
    const width = this.background.width;
    const height = this.background.height;
    const maxX = this.scene.scale.width - width - 8;
    const maxY = this.scene.scale.height - height - 8;
    const x = Math.max(8, Math.min(maxX, pointer.x + OFFSET_X));
    const y = Math.max(8, Math.min(maxY, pointer.y + OFFSET_Y));

    this.background.setPosition(x, y);
    this.text.setPosition(x + PADDING_X, y + PADDING_Y);
  }
}
