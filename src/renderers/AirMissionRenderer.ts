import Phaser from 'phaser';
import type { TileMap } from '../systems/TileMap';
import type { AirFlightEvent, AirOperationsSystem } from '../systems/AirOperationsSystem';
import { getUnitSpriteKey } from '../utils/assetPaths';

/** Disposable presentation sprites; no gameplay waits for tween callbacks. */
export class AirMissionRenderer {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tileMap: TileMap,
    air: AirOperationsSystem,
    enabled: () => boolean,
    private readonly visible: (x: number, y: number) => boolean,
  ) {
    air.onFlight(event => { if (enabled()) this.fly(event); });
  }

  private fly(event: AirFlightEvent): void {
    if (!this.visible(event.origin.x, event.origin.y) && !this.visible(event.destination.x, event.destination.y)) return;
    const origin = this.tileMap.tileToWorld(event.origin.x, event.origin.y);
    const target = this.tileMap.tileToWorld(event.destination.x, event.destination.y);
    const sprite = this.scene.add.image(origin.x, origin.y, getUnitSpriteKey(event.aircraft.unitType.id))
      .setDepth(45).setDisplaySize(44, 44);
    const duration = Math.max(300, Math.min(1400, Phaser.Math.Distance.Between(origin.x, origin.y, target.x, target.y) * 2));
    const updateVisibility = (object: Phaser.GameObjects.Image | Phaser.GameObjects.Arc): void => {
      const tile = this.tileMap.worldToTile?.(object.x, object.y);
      if (tile) object.setVisible(this.visible(tile.x, tile.y));
    };
    updateVisibility(sprite);
    const impact = (): void => {
      if (!this.visible(event.destination.x, event.destination.y)) return;
      const flash = this.scene.add.circle(target.x, target.y, 8, 0xffcc66).setDepth(47);
      this.scene.tweens.add({ targets: flash, scale: 3, alpha: 0, duration: 180, onComplete: () => flash.destroy() });
    };
    this.scene.tweens.add({
      targets: sprite, x: target.x, y: target.y, duration,
      onUpdate: () => updateVisibility(sprite),
      onComplete: () => {
        if (event.interceptor && event.interceptorOrigin) {
          const base = this.tileMap.tileToWorld(event.interceptorOrigin.x, event.interceptorOrigin.y);
          const fighter = event.interceptor.unitType.aircraftRole === 'fighter';
          const defense = fighter
            ? this.scene.add.image(base.x, base.y, getUnitSpriteKey(event.interceptor.unitType.id)).setDisplaySize(40, 40)
            : this.scene.add.circle(base.x, base.y, 4, 0xffdd66);
          defense.setDepth(46);
          updateVisibility(defense);
          this.scene.tweens.add({
            targets: defense, x: target.x, y: target.y, duration: 300, yoyo: fighter,
            onUpdate: () => updateVisibility(defense),
            onYoyo: impact,
            onComplete: () => { if (!fighter) impact(); defense.destroy(); },
          });
        } else if (event.kind === 'strike') impact();

        if (event.kind === 'rebase') { sprite.destroy(); return; }
        if (event.destroyed) {
          this.scene.time.delayedCall(300, () => sprite.destroy());
          return;
        }
        this.scene.tweens.add({
          targets: sprite, x: origin.x, y: origin.y, duration,
          delay: event.kind === 'intercepted' ? 300 : 150,
          onUpdate: () => updateVisibility(sprite),
          onComplete: () => sprite.destroy(),
        });
      },
    });
  }
}
