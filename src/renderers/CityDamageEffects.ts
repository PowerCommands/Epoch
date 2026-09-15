import Phaser from 'phaser';
import type { City } from '../entities/City';
import type { TileMap } from '../systems/TileMap';
import type { CityPoint } from '../systems/rendering/OrganicCityArtwork';
import { WORLD_EFFECT_DEPTH } from '../systems/rendering/WorldEffectDepths';
import { isMapAnimationsEnabled } from '../systems/PlayerSettings';

interface BurningCity { city: City; anchors: readonly CityPoint[]; size: number }

/** Persistent roof fires: one drawing surface, bounded cities/anchors, no game state. */
export class CityDamageEffects {
  private readonly sites = new Map<string, BurningCity>();
  private graphics?: Phaser.GameObjects.Graphics;
  private age = 0;
  private lastDraw = -Infinity;
  private readonly reducedMotion = typeof matchMedia === 'undefined' ? undefined : matchMedia('(prefers-reduced-motion: reduce)');

  constructor(private readonly scene: Phaser.Scene, private readonly tileMap: TileMap,
    private readonly visible: (x: number, y: number) => boolean) {
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  set(city: City, anchors: readonly CityPoint[], size: number): void {
    if (!city.isVisuallyDamaged) { this.remove(city.id); return; }
    // Sample the whole streetscape, including the foreground and rear buildings.
    const count = Math.min(anchors.length, city.settlementStage === 'Metropolis' ? 10 : 7);
    this.sites.set(city.id, { city, size, anchors: Array.from({ length: count }, (_, i) => anchors[Math.floor(i * anchors.length / count)]) });
    if (!this.graphics) {
      this.graphics = this.scene.add.graphics().setDepth(WORLD_EFFECT_DEPTH.cityFire).setName('city-damage-fires');
      this.scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
    }
    this.lastDraw = -Infinity;
    this.update(0, 0);
  }

  remove(id: string): void {
    if (!this.sites.delete(id)) return;
    this.lastDraw = -Infinity;
    if (!this.sites.size) this.clear();
    else this.update(0, 0);
  }

  private update(_time: number, delta: number): void {
    this.age += Math.min(delta, 100);
    if (this.age - this.lastDraw < 40) return;
    this.lastDraw = this.age;
    const g = this.graphics;
    if (!g) return;
    g.clear();
    const view = this.scene.cameras.main.worldView;
    const animate = isMapAnimationsEnabled() && !this.reducedMotion?.matches;
    let drawn = 0;
    for (const { city, anchors, size } of this.sites.values()) {
      if (!city.isVisuallyDamaged || !this.visible(city.tileX, city.tileY)) continue;
      const origin = this.tileMap.tileToWorld(city.tileX, city.tileY);
      if (origin.x + size * 2 < view.left || origin.x - size * 2 > view.right
        || origin.y + size * 2 < view.top || origin.y - size * 2 > view.bottom) continue;
      if (drawn++ >= 32) break;
      for (const [i, anchor] of anchors.entries()) {
        const x = origin.x + anchor.x, y = origin.y + anchor.y;
        const tile = this.tileMap.worldToTile(x, y);
        if (!tile || !this.visible(tile.x, tile.y)) continue;
        const time = animate ? this.age : 1200;
        const phase = time / 1900 + i * .217 + city.tileX * .13 + city.tileY * .07;
        const flame = size * (.15 + .035 * Math.sin(phase * 16));
        // Several opaque tongues remain legible against both glass and tiled roofs.
        for (let j = 0; j < 3; j++) {
          const dx = (j - 1) * size * .035;
          const lean = Math.sin(phase * 23 + j) * size * .025;
          g.fillStyle(0xf05b1d, .9).fillTriangle(x + dx - size * .035, y, x + dx + size * .035, y, x + dx + lean, y - flame * (j === 1 ? 1.25 : .8));
          g.fillStyle(0xffc84c, .95).fillTriangle(x + dx - size * .016, y, x + dx + size * .020, y, x + dx + lean * .5, y - flame * .7);
        }
        for (let j = 0; j < 5; j++) {
          const rise = (phase + j / 5) % 1;
          g.fillStyle(j % 2 ? 0x454a47 : 0x6a6b60, (1 - rise) * .5);
          g.fillEllipse(x + rise * size * .13 + Math.sin(phase + j) * size * .025,
            y - flame * .85 - rise * size * .47, size * (.07 + rise * .18), size * (.08 + rise * .16));
        }
      }
    }
  }

  clear(): void {
    this.sites.clear(); this.graphics?.destroy(); this.graphics = undefined;
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this);
  }

  shutdown(): void {
    this.clear();
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }
}
