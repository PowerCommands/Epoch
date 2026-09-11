import Phaser from 'phaser';
import { GeometryClip, setGeometryClip, clearGeometryClip } from '../src/systems/rendering/GeometryClip';
import { TerrainBaker } from '../src/systems/rendering/TerrainBaker';

class MigrationChecks extends Phaser.Scene {
  create(): void {
    const camera = this.cameras.main.setScroll(100, 50);
    const mask = this.add.graphics().fillStyle(0xffffff).fillCircle(150, 100, 25).setVisible(false);
    const clip = new GeometryClip(mask);
    const target = setGeometryClip(this.add.rectangle(150, 100, 80, 80, 0xff0000), clip);
    this.add.rectangle(250, 100, 60, 60, 0x00ff00);

    const child = this.add.rectangle(0, 0, 80, 80, 0x0000ff);
    this.add.container(350, 100, [child]).setAlpha(0.5);
    const childMask = this.add.graphics().fillStyle(0xffffff).fillCircle(350, 100, 25).setVisible(false);
    setGeometryClip(child, new GeometryClip(childMask));

    const ui = this.cameras.add(0, 0, 400, 300);
    ui.ignore(this.children.list);
    const uiMask = this.add.graphics().fillStyle(0xffffff).fillRect(320, 20, 50, 60).setScrollFactor(0).setVisible(false);
    const uiClip = new GeometryClip(uiMask);
    const uiObjects = [
      setGeometryClip(this.add.rectangle(345, 35, 90, 30, 0xffff00).setScrollFactor(0), uiClip),
      setGeometryClip(this.add.rectangle(345, 65, 90, 30, 0xff00ff).setScrollFactor(0), uiClip),
    ];
    camera.ignore([uiMask, ...uiObjects]);
    const sentinel = this.add.rectangle(350, 120, 60, 30, 0x00ffff).setScrollFactor(0);
    camera.ignore(sentinel);

    const restoreListeners = this.renderer.listenerCount(Phaser.Renderer.Events.RESTORE_WEBGL);
    const terrain = TerrainBaker.bake(this, 4097.25, 11, -1, graphics => {
      graphics.fillStyle(0xff8800).fillRect(0, 0, 4096, 11);
      graphics.fillStyle(0x00ff00).fillRect(4096, 0, 2, 11);
    });
    // Exercise relocated chunks (the river renderer also moves baked chunks).
    terrain[0].setPosition(100, 260);
    terrain[1].setPosition(180, 260);
    ui.ignore(terrain);

    const api = {
      version: Phaser.VERSION,
      scene: this,
      moveMask: () => { mask.setPosition(30, 0); },
      clear: () => clearGeometryClip(target),
      reattach: () => setGeometryClip(target, clip),
      destroySource: () => mask.destroy(),
      destroyShared: () => { uiObjects[0].destroy(); },
      chunks: terrain.map(texture => ({ width: texture.width, height: texture.height })),
      destroyTerrain: () => {
        terrain.forEach(texture => texture.destroy());
        return this.renderer.listenerCount(Phaser.Renderer.Events.RESTORE_WEBGL) === restoreListeners;
      },
      lifecycle: () => {
        const before = this.children.length;
        for (let i = 0; i < 100; i++) {
          const source = this.add.graphics().fillStyle(0xffffff).fillRect(0, 0, 10, 10);
          const clipping = new GeometryClip(source);
          const object = this.add.rectangle(0, 0, 20, 20, 0xffffff);
          for (let n = 0; n < 10; n++) { setGeometryClip(object, clipping); clearGeometryClip(object); }
          setGeometryClip(object, clipping);
          if (i % 2) { object.destroy(); source.destroy(); }
          else { source.destroy(); object.destroy(); }
          clipping.destroy();
        }
        return this.children.length === before;
      },
      benchmark: async (mode: 'stencil' | 'filter', count = 200) => {
        const objects: Phaser.GameObjects.Image[] = [];
        const sources: Phaser.GameObjects.Graphics[] = [];
        for (let i = 0; i < count; i++) {
          const x = 105 + (i % 40) * 9, y = 200 + Math.floor(i / 40) * 9;
          const image = this.add.image(x, y, '__WHITE').setDisplaySize(8, 8);
          const source = this.add.graphics().fillStyle(0xffffff).fillCircle(x, y, 3).setVisible(false);
          ui.ignore([image, source]);
          if (mode === 'stencil') setGeometryClip(image, new GeometryClip(source));
          else image.enableFilters().filters!.internal.addMask(source, false, camera);
          objects.push(image); sources.push(source);
        }
        const samples: number[] = [];
        let start = 0, warmup = 10;
        const before = () => { start = performance.now(); };
        await new Promise<void>(resolve => {
          const after = () => {
            if (warmup-- <= 0) samples.push(performance.now() - start);
            if (samples.length < 30) return;
            this.game.events.off(Phaser.Core.Events.PRE_RENDER, before);
            this.game.events.off(Phaser.Core.Events.POST_RENDER, after);
            resolve();
          };
          this.game.events.on(Phaser.Core.Events.PRE_RENDER, before);
          this.game.events.on(Phaser.Core.Events.POST_RENDER, after);
        });
        const filterCameras = objects.filter(object => object.filterCamera).length;
        objects.forEach(object => object.destroy());
        sources.forEach(source => source.destroy());
        samples.sort((a, b) => a - b);
        return { mode, count, medianRenderMs: samples[15], p95RenderMs: samples[28], filterCameras };
      },
    };
    (window as any).migrationChecks = api;
  }
}
new Phaser.Game({ type: new URLSearchParams(location.search).has('canvas') ? Phaser.CANVAS : Phaser.WEBGL,
  width: 400, height: 300, backgroundColor: '#000000', scene: MigrationChecks, banner: false });
