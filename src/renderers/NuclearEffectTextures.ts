import Phaser from 'phaser';

export const SMOKE_TEXTURE = 'nuclear-smoke-puff';
export const FIREBALL_TEXTURE = 'nuclear-fireball-glow';

export function ensureNuclearEffectTextures(scene: Phaser.Scene): void {
    if (!scene.textures.exists(FIREBALL_TEXTURE)) {
      const glow = scene.textures.createCanvas(FIREBALL_TEXTURE, 128, 128)!;
      const gradient = glow.context.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, '#ffffef');
      gradient.addColorStop(0.3, '#fff6cc');
      gradient.addColorStop(0.48, '#ffdb81');
      gradient.addColorStop(0.65, 'rgba(255,142,38,0.85)');
      gradient.addColorStop(0.83, 'rgba(245,85,20,0.3)');
      gradient.addColorStop(1, 'rgba(225,65,15,0)');
      glow.context.fillStyle = gradient; glow.context.fillRect(0, 0, 128, 128); glow.refresh();
    }
    if (scene.textures.exists(SMOKE_TEXTURE)) return;
    const texture = scene.textures.createCanvas(SMOKE_TEXTURE, 128, 128)!;
    const ctx = texture.context;
    // One reusable shaded smoke brush; the mushroom silhouette is entirely animated.
    for (let i = 0; i < 9; i++) {
      const angle = i * 2.39996, offset = i ? 22 : 0;
      const x = 64 + Math.cos(angle) * offset, y = 64 + Math.sin(angle) * offset;
      const gradient = ctx.createRadialGradient(x - 8, y - 11, 2, x, y, 40);
      gradient.addColorStop(0, 'rgba(255,250,233,0.94)');
      gradient.addColorStop(0.5, 'rgba(225,223,213,0.85)');
      gradient.addColorStop(0.78, 'rgba(190,191,185,0.4)');
      gradient.addColorStop(1, 'rgba(178,181,176,0)');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
    }
    texture.refresh();
  }

