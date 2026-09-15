import Phaser from 'phaser';
import type { TileMap } from '../systems/TileMap';
import type { MissileStorageSystem } from '../systems/MissileStorageSystem';

/** Owner-only magazine badges. No enemy stockpile information is drawn onto the map. */
export class MissilePadRenderer {
  private badges = new Map<string, Phaser.GameObjects.Text>();
  constructor(private readonly scene: Phaser.Scene, private readonly tileMap: TileMap,
    private readonly storage: MissileStorageSystem, private readonly ownerId: string | undefined) {
    const timer = scene.time.addEvent({ delay: 400, loop: true, callback: () => this.refresh() });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      timer.remove(); for (const badge of this.badges.values()) badge.destroy(); this.badges.clear();
    });
    this.refresh();
  }
  refresh(): void {
    if (!this.ownerId) return;
    const seen = new Set<string>();
    for (const pad of this.storage.getPads(this.ownerId)) {
      const key = `${pad.x},${pad.y}`; seen.add(key);
      let badge = this.badges.get(key);
      if (!badge) {
        const at = this.tileMap.tileToWorld(pad.x, pad.y);
        badge = this.scene.add.text(at.x, at.y + 21, '', { fontFamily: 'Arial', fontSize: '12px', color: '#fff3d5', backgroundColor: '#16222e', padding: { x: 5, y: 2 } }).setOrigin(.5).setDepth(16.6);
        this.badges.set(key, badge);
      }
      badge.setText(`${pad.operational ? '▲' : '×'} ${this.storage.getStoredMissiles(pad.x, pad.y).length}/${pad.capacity}`);
      badge.setColor(pad.operational ? '#fff3d5' : '#ff9b85');
    }
    for (const [key, badge] of this.badges) if (!seen.has(key)) { badge.destroy(); this.badges.delete(key); }
  }
}
