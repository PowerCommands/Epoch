import Phaser from 'phaser';

const MAX_CHUNK = 4096;

export class TerrainBaker {
  static bake(
    scene: Phaser.Scene,
    worldWidth: number,
    worldHeight: number,
    depth: number,
    drawInto: (graphics: Phaser.GameObjects.Graphics) => void,
  ): Phaser.GameObjects.RenderTexture[] {
    const cols = Math.ceil(worldWidth / MAX_CHUNK);
    const rows = Math.ceil(worldHeight / MAX_CHUNK);

    const g = scene.make.graphics({ add: false } as Phaser.Types.GameObjects.Graphics.Options);
    drawInto(g);

    const result: Phaser.GameObjects.RenderTexture[] = [];
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const chunkX = cx * MAX_CHUNK;
        const chunkY = cy * MAX_CHUNK;
        const chunkW = Math.min(MAX_CHUNK, worldWidth - chunkX);
        const chunkH = Math.min(MAX_CHUNK, worldHeight - chunkY);
        const rt = scene.add
          .renderTexture(chunkX, chunkY, chunkW, chunkH)
          .setOrigin(0, 0)
          .setDepth(depth);
        rt.draw(g, -chunkX, -chunkY);
        result.push(rt);
      }
    }

    g.destroy();
    return result;
  }
}
