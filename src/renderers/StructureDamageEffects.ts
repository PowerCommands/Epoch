import Phaser from 'phaser';
import type { TileMap } from '../systems/TileMap';

/** Shared smoke/fire brush used by transient Improvement destruction and
 * persistent structural damage. No textures, particles, tweens or timers. */
export function drawDamageFeedback(
  gfx: Phaser.GameObjects.Graphics, x: number, y: number, size: number,
  phase: number, age: number, strength: number, fire: boolean,
): void {
  for (let i = 0; i < 4; i++) {
    const rise = (phase * 1.1 + i * 0.22) % 1;
    gfx.fillStyle(0x555750, (1 - rise) * strength * 0.48);
    gfx.fillCircle(x + Math.sin(i * 3 + rise * 2) * size * 0.055,
      y - rise * size * 0.43, size * (0.025 + rise * 0.07));
  }
  if (fire) {
    const flicker = 0.7 + Math.sin(age * 0.035) * 0.2;
    gfx.fillStyle(0xdb7a28, strength * 0.85).fillEllipse(x + size * 0.09, y + size * 0.06, size * 0.045, size * 0.13 * flicker);
    gfx.fillStyle(0xffd477, strength * 0.8).fillEllipse(x + size * 0.09, y + size * 0.08, size * 0.022, size * 0.055 * flicker);
  }
}

interface DamageSite { x: number; y: number; fire: boolean }
export const MAX_VISIBLE_DAMAGE_EFFECTS = 32;

/** One drawing surface and one listener per renderer, only while damaged sites
 * exist. Offscreen/hidden sites cost no drawing; animation is bounded at 25Hz. */
export class StructureDamageEffects {
  private readonly sites = new Map<string, DamageSite>();
  private graphics?: Phaser.GameObjects.Graphics;
  private age = 0;
  private lastDraw = -Infinity;
  private disposed = false;

  constructor(private readonly scene: Phaser.Scene, private readonly tileMap: TileMap,
    private readonly depth: number, private readonly visible: (x: number, y: number) => boolean) {
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  set(key: string, x: number, y: number, damaged: boolean, fire = true): void {
    if (this.disposed) return;
    if (!damaged || !this.visible(x, y)) { this.remove(key); return; }
    this.sites.set(key, { x, y, fire });
    if (!this.graphics) {
      this.graphics = this.scene.add.graphics().setDepth(this.depth).setName('structure-damage');
      this.scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
    }
  }

  remove(key: string): void {
    if (!this.sites.delete(key)) return;
    this.graphics?.clear();
    this.lastDraw = -Infinity;
    if (!this.sites.size) this.stop();
  }

  clear(): void { this.sites.clear(); this.stop(); }

  shutdown(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  private update(_time: number, delta: number): void {
    this.age += Math.min(delta, 100);
    if (this.age - this.lastDraw < 40) return;
    this.lastDraw = this.age;
    this.graphics?.clear();
    const camera = this.scene.cameras.main;
    const detail = Math.max(0, Math.min(1, (camera.zoom - 0.35) / 0.65));
    if (!detail) return;
    const view = camera.worldView;
    let drawn = 0;
    for (const site of this.sites.values()) {
      if (!this.visible(site.x, site.y)) continue;
      const { x, y } = this.tileMap.tileToWorld(site.x, site.y);
      const size = this.tileMap.getTileRect(site.x, site.y).height;
      if (x < view.left - size || x > view.right + size || y < view.top - size || y > view.bottom + size) continue;
      if (drawn++ >= MAX_VISIBLE_DAMAGE_EFFECTS) break;
      const age = this.age + ((site.x * 137 + site.y * 269) % 3000);
      drawDamageFeedback(this.graphics!, x, y, size * 0.7, (age % 3000) / 3000,
        age, detail * 0.6, site.fire && age % 5000 < 1700);
    }
  }

  private stop(): void {
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this);
    this.graphics?.destroy();
    this.graphics = undefined;
    this.lastDraw = -Infinity;
  }
}
