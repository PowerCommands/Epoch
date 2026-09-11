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

    const g = scene.make.graphics({}, false);
    drawInto(g);

    const result: Phaser.GameObjects.RenderTexture[] = [];
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const chunkX = cx * MAX_CHUNK;
        const chunkY = cy * MAX_CHUNK;
        const chunkW = Math.ceil(Math.min(MAX_CHUNK, worldWidth - chunkX));
        const chunkH = Math.ceil(Math.min(MAX_CHUNK, worldHeight - chunkY));
        const rt = scene.add.existing(new Phaser.GameObjects.RenderTexture(
          scene, chunkX, chunkY, chunkW, chunkH, false,
        ))
          .setOrigin(0, 0)
          .setDepth(depth);
        // Phaser 4 queues draw commands. Execute while the source still exists.
        rt.draw(g, -chunkX, -chunkY).render();
        result.push(rt);
      }
    }

    g.destroy();

    // Framebuffer contents are lost with the GL context. Keep the drawing
    // recipe, not a full-world Graphics command buffer, until all chunks die.
    if (scene.renderer.type === Phaser.WEBGL && result.length > 0) {
      const live = new Set(result);
      const redraw = (): void => {
        const source = scene.make.graphics({}, false);
        try {
          drawInto(source);
          for (const rt of live) {
            // Rivers can reposition their chunks after baking, so use the
            // original bake offset rather than the object's current position.
            const offset = offsets.get(rt)!;
            rt.clear().draw(source, -offset.x, -offset.y).render();
          }
        } finally {
          source.destroy();
        }
      };
      const offsets = new Map(result.map(rt => [rt, { x: rt.x, y: rt.y }]));
      const renderer = scene.renderer;
      renderer.on(Phaser.Renderer.Events.RESTORE_WEBGL, redraw);
      for (const rt of result) {
        rt.once(Phaser.GameObjects.Events.DESTROY, () => {
          live.delete(rt);
          offsets.delete(rt);
          if (live.size === 0) renderer.off(Phaser.Renderer.Events.RESTORE_WEBGL, redraw);
        });
      }
    }
    return result;
  }
}
