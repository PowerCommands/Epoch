import Phaser from 'phaser';

const PADDING = 10;
const LINE_HEIGHT = 20;
const FONT_SIZE = '14px';
const BG_COLOR = 0x000000;
const BG_ALPHA = 0.55;
const TEXT_COLOR = '#e8e8e8';

/**
 * DebugHUD — en fast overlay i övre vänstra hörnet.
 *
 * Använder scrollFactor(0) så att texten inte påverkas av kamerarörelse.
 * Uppdateras varje frame med aktuell zoom och kameraposition.
 */
export class DebugHUD {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    // Placerad under ResourceBar (som tar ~50px i höjd)
    const offsetY = 60;

    // Bakgrundsruta — bredden justeras dynamiskt i update()
    this.bg = scene.add.rectangle(
      PADDING,
      PADDING + offsetY,
      120,
      LINE_HEIGHT * 2 + PADDING,
      BG_COLOR,
      BG_ALPHA,
    );
    this.bg.setOrigin(0, 0).setScrollFactor(0).setDepth(100);

    this.label = scene.add
      .text(PADDING * 2, PADDING * 1.5 + offsetY, '', {
        fontSize: FONT_SIZE,
        color: TEXT_COLOR,
        lineSpacing: 4,
      })
      .setScrollFactor(0)
      .setDepth(101);
  }

  /** Uppdatera HUD-innehållet. Anropas varje frame från GameScene.update(). */
  update(zoom: number, camX: number, camY: number): void {
    this.label.setText([
      `Zoom: ${zoom.toFixed(2)}`,
      `Cam:  (${Math.round(camX)}, ${Math.round(camY)})`,
    ]);

    // Anpassa bakgrundens bredd efter textens faktiska bredd
    this.bg.width = this.label.width + PADDING * 3;
  }
}
