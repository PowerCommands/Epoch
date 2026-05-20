import Phaser from 'phaser';
import type { Unit } from '../entities/Unit';
import type { TileMap } from './TileMap';
import type { UnitRenderer } from './UnitRenderer';
import type { AutoplaySystem } from './AutoplaySystem';

const MELEE_LUNGE_FRACTION = 0.28;
const MELEE_LUNGE_MS = 120;
const MELEE_RETURN_MS = 90;

const RANGED_RECOIL_PX = 7;
const RANGED_RECOIL_MS = 80;
const RANGED_RECOIL_RETURN_MS = 70;
const RANGED_PROJECTILE_MS = 280;

const FLASH_MS = 160;
const FLASH_TINT = 0xff3333;

const PROJECTILE_RADIUS = 4;
const PROJECTILE_COLOR = 0xffee66;
const PROJECTILE_DEPTH = 30;

const SHAKE_MS = 110;
const SHAKE_INTENSITY = 0.0025;

export class CombatAnimationSystem {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tileMap: TileMap,
    private readonly unitRenderer: UnitRenderer,
    private readonly autoplaySystem: AutoplaySystem,
  ) {}

  async playMeleeAttack(
    attacker: Unit,
    defenderTileX: number,
    defenderTileY: number,
    defenderUnitId?: string,
  ): Promise<void> {
    if (this.autoplaySystem.isActive()) return;

    const attackerContainer = this.unitRenderer.getUnitContainer(attacker.id);
    if (!attackerContainer) return;

    const attackerPos = this.tileMap.tileToWorld(attacker.tileX, attacker.tileY);
    const defenderPos = this.tileMap.tileToWorld(defenderTileX, defenderTileY);

    this.scene.tweens.killTweensOf(attackerContainer);

    const lungeX = attackerPos.x + (defenderPos.x - attackerPos.x) * MELEE_LUNGE_FRACTION;
    const lungeY = attackerPos.y + (defenderPos.y - attackerPos.y) * MELEE_LUNGE_FRACTION;

    await this.tweenAsync({
      targets: attackerContainer,
      x: lungeX,
      y: lungeY,
      duration: MELEE_LUNGE_MS,
      ease: 'Cubic.Out',
    });

    if (defenderUnitId) this.unitRenderer.flashUnitRed(defenderUnitId, FLASH_MS, FLASH_TINT);
    this.shake();

    await this.tweenAsync({
      targets: attackerContainer,
      x: attackerPos.x,
      y: attackerPos.y,
      duration: MELEE_RETURN_MS,
      ease: 'Cubic.In',
    });
  }

  async playRangedAttack(
    attacker: Unit,
    defenderTileX: number,
    defenderTileY: number,
    defenderUnitId?: string,
  ): Promise<void> {
    if (this.autoplaySystem.isActive()) return;

    const attackerContainer = this.unitRenderer.getUnitContainer(attacker.id);
    if (!attackerContainer) return;

    const attackerPos = this.tileMap.tileToWorld(attacker.tileX, attacker.tileY);
    const defenderPos = this.tileMap.tileToWorld(defenderTileX, defenderTileY);

    const dx = defenderPos.x - attackerPos.x;
    const dy = defenderPos.y - attackerPos.y;
    const mag = Math.sqrt(dx * dx + dy * dy) || 1;
    const recoilX = attackerPos.x - (dx / mag) * RANGED_RECOIL_PX;
    const recoilY = attackerPos.y - (dy / mag) * RANGED_RECOIL_PX;

    this.scene.tweens.killTweensOf(attackerContainer);

    const recoilPromise = this.tweenAsync({
      targets: attackerContainer,
      x: recoilX,
      y: recoilY,
      duration: RANGED_RECOIL_MS,
      ease: 'Cubic.Out',
    });

    const projectile = this.scene.add.graphics();
    projectile.fillStyle(PROJECTILE_COLOR, 1);
    projectile.fillCircle(0, 0, PROJECTILE_RADIUS);
    projectile.setPosition(attackerPos.x, attackerPos.y);
    projectile.setDepth(PROJECTILE_DEPTH);

    const projectilePromise = this.tweenAsync({
      targets: projectile,
      x: defenderPos.x,
      y: defenderPos.y,
      duration: RANGED_PROJECTILE_MS,
      ease: 'Linear',
    });

    await recoilPromise;

    this.scene.tweens.add({
      targets: attackerContainer,
      x: attackerPos.x,
      y: attackerPos.y,
      duration: RANGED_RECOIL_RETURN_MS,
      ease: 'Cubic.In',
    });

    await projectilePromise;

    if (defenderUnitId) this.unitRenderer.flashUnitRed(defenderUnitId, FLASH_MS, FLASH_TINT);
    this.shake();
    projectile.destroy();
  }

  private tweenAsync(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise<void>((resolve) => {
      this.scene.tweens.add({ ...config, onComplete: () => resolve() });
    });
  }

  private shake(): void {
    this.scene.cameras.main.shake(SHAKE_MS, SHAKE_INTENSITY);
  }
}
