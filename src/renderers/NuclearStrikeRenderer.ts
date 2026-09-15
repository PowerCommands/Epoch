import Phaser from 'phaser';
import { STRATEGIC_WEAPONS } from '../data/strategicWeapons';
import type { StrategicDetonation, StrategicWeaponsSystem } from '../systems/StrategicWeaponsSystem';
import type { TileMap } from '../systems/TileMap';

import { ensureNuclearEffectTextures, SMOKE_TEXTURE, FIREBALL_TEXTURE } from './NuclearEffectTextures';
const MAX_STRIKES = 3;
const CLOUD_MS = 10500;
const DEPTH = 46;
const clamp = (n: number): number => Math.max(0, Math.min(1, n));
const smooth = (n: number): number => { const t = clamp(n); return t * t * (3 - 2 * t); };
const noise = (n: number): number => (Math.sin(n * 127.1 + 311.7) * 43758.5453) % 1 / 2 + 0.5;
type Point = { x: number; y: number };
interface Puff { image: Phaser.GameObjects.Image; seed: number }
interface Strike {
  event: StrategicDetonation;
  origin: Point;
  target: Point;
  radius: number;
  groundY: number;
  age: number;
  flightMs: number;
  impacted: boolean;
  graphics: Phaser.GameObjects.Graphics;
  fireball: Phaser.GameObjects.Image;
  cloud: Phaser.GameObjects.Container;
  column: Puff[];
  cap: Puff[];
  dust: Puff[];
  terrain?: Phaser.GameObjects.RenderTexture;
}

/** A bounded, disposable scene effect, like AirMissionRenderer and StructureDamageEffects.
 * Receives already-resolved strikes; never advances turns, consumes combat RNG,
 * changes visibility, or calls back into gameplay. All phase times are visual only. */
export class NuclearStrikeRenderer {
  private readonly strikes: Strike[] = [];
  private lastDraw = 0;
  private disposed = false;
  private readonly unsubscribe: () => void;

  constructor(private readonly scene: Phaser.Scene, private readonly tileMap: TileMap,
    weapons: StrategicWeaponsSystem, private readonly enabled: () => boolean,
    private readonly visible: (x: number, y: number) => boolean) {
    this.unsubscribe = weapons.onDetonation(this.play);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  private readonly play = (event: StrategicDetonation): void => {
    if (this.disposed || !this.enabled() || (!event.nuclear && !event.intercepted) || event.accident || event.weaponId === 'icbm') return;
    const targetVisible = this.visible(event.target.x, event.target.y);
    if (!targetVisible && (!event.origin || !this.visible(event.origin.x, event.origin.y))) return;
    this.ensureTexture();
    if (this.strikes.length === MAX_STRIKES) this.destroyStrike(this.strikes.shift()!);
    const target = this.tileMap.tileToWorld(event.target.x, event.target.y);
    const origin = event.origin ? this.tileMap.tileToWorld(event.origin.x, event.origin.y) : target;
    const tile = this.tileMap.getTileRect(event.target.x, event.target.y);
    const blast = event.radius ?? STRATEGIC_WEAPONS[event.weaponId].radius;
    const radius = tile.width * (blast + 0.5);
    const groundY = tile.height * (blast * 0.75 + 0.5);
    const distance = Math.hypot(target.x - origin.x, target.y - origin.y);
    const flightMs = ['nuclear_missile', 'guided_missile'].includes(event.weaponId) && event.origin
      ? Math.max(1900, Math.min(3400, 1600 + distance * 2)) : 550;
    const cloud = this.scene.add.container(target.x, target.y).setDepth(DEPTH).setName('nuclear-cloud');
    const puffs = (count: number, offset: number): Puff[] => Array.from({ length: count }, (_, i) => {
      const image = this.scene.add.image(0, 0, SMOKE_TEXTURE).setAlpha(0);
      cloud.add(image);
      return { image, seed: noise(i + offset) };
    });
    const strike: Strike = { event, origin, target, radius, groundY, age: 0, flightMs, impacted: false,
      graphics: this.scene.add.graphics().setDepth(DEPTH + 1).setName('nuclear-flight-and-blast'),
      fireball: this.scene.add.image(target.x, target.y, FIREBALL_TEXTURE)
        .setDepth(DEPTH + 0.5).setAlpha(0).setName('nuclear-fireball'),
      cloud, column: puffs(18, 0), cap: puffs(30, 18), dust: puffs(36, 48) };
    // A small region of the old terrain sits below fog and every other map layer.
    // It is discarded under opaque blast dust, never stored in a save.
    if (targetVisible && !event.intercepted && radius * 2 < 2048 && groundY * 2 < 2048) {
      strike.terrain = this.tileMap.captureTerrain({ x: target.x - radius, y: target.y - groundY,
        width: radius * 2, height: groundY * 2 });
    }
    this.strikes.push(strike);
    if (this.strikes.length === 1) this.scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
    this.draw(strike);
  };

  private update(_time: number, delta: number): void {
    if (!this.enabled()) { this.clear(); return; }
    for (const strike of this.strikes) strike.age += delta;
    this.lastDraw += delta;
    if (this.lastDraw < 33) return;
    this.lastDraw = 0;
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const strike = this.strikes[i];
      if (strike.age >= strike.flightMs + (strike.event.intercepted ? 1600 : CLOUD_MS)) {
        this.destroyStrike(strike); this.strikes.splice(i, 1);
      } else this.draw(strike);
    }
    if (!this.strikes.length) this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this);
  }

  private draw(s: Strike): void {
    s.graphics.clear();
    const targetVisible = this.visible(s.event.target.x, s.event.target.y);
    s.cloud.setVisible(targetVisible && !s.event.intercepted);
    s.fireball.setVisible(targetVisible && !s.event.intercepted);
    s.terrain?.setVisible(targetVisible);
    if (s.age < s.flightMs) { this.drawFlight(s); this.drawDefense(s); return; }
    const t = (s.age - s.flightMs) / 1000;
    if (s.event.intercepted) {
      const point = this.flightPoint(s, 0.78);
      if (!this.pointVisible(point)) return;
      const fade = 1 - smooth(t / 1.6), radius = 10 + t * 45;
      s.graphics.fillStyle(0xe2f5ff, fade * 0.6).fillCircle(point.x, point.y, radius * 0.5);
      s.graphics.lineStyle(2, 0x9ddfff, fade).strokeCircle(point.x, point.y, radius);
      for (let i = 0; i < 16; i++) {
        const angle = i * 2.39996, spread = radius * (0.5 + noise(i));
        s.graphics.fillStyle(0xffd39b, fade).fillCircle(point.x + Math.cos(angle) * spread,
          point.y + Math.sin(angle) * spread + t * t * 12, 1.5);
      }
      return;
    }
    if (!s.impacted) {
      s.impacted = true;
      const view = this.scene.cameras.main.worldView;
      if (targetVisible && view.contains(s.target.x, s.target.y)) {
        this.scene.cameras.main.shake(280, 0.0018, false);
      }
    }
    // Remove the presentation copy only once the dust fully covers the ground.
    if (t > 0.35) { s.terrain?.destroy(); s.terrain = undefined; }
    if (!targetVisible) return;
    this.drawCloud(s, t);
    this.drawBlast(s, t);
  }

  /** A short atmospheric arc with a slow vertical departure and accelerating travel. */
  private flightPoint(s: Strike, progress: number): Point {
    const p = clamp(progress);
    const travel = p * p;
    const height = Math.min(150, Math.max(65, Math.hypot(s.target.x - s.origin.x, s.target.y - s.origin.y) * 0.2));
    return { x: s.origin.x + (s.target.x - s.origin.x) * travel,
      y: s.origin.y + (s.target.y - s.origin.y) * travel - Math.sin(Math.PI * p ** 1.35) * height };
  }

  private pointVisible(point: Point): boolean {
    const tile = this.tileMap.worldToTile(point.x, point.y);
    return !!tile && this.visible(tile.x, tile.y);
  }

  private drawFlight(s: Strike): void {
    const g = s.graphics;
    if (!['nuclear_missile', 'guided_missile'].includes(s.event.weaponId) || !s.event.origin) {
      if (!this.visible(s.event.target.x, s.event.target.y)) return;
      const p = s.age / s.flightMs;
      g.fillStyle(0x252c32).fillEllipse(s.target.x, s.target.y - 38 * (1 - p * p), 9, 18);
      return;
    }
    const progress = s.age / s.flightMs * (s.event.intercepted ? 0.78 : 1);
    // Historical path samples form a bounded trail, including a lingering launch plume.
    for (let i = 30; i >= 1; i--) {
      const earlier = progress - i * 0.014;
      if (earlier < 0) continue;
      const point = this.flightPoint(s, earlier);
      if (!this.pointVisible(point)) continue;
      const spread = 3 + i * 0.32;
      g.fillStyle(0xd4ccc0, (1 - i / 32) * 0.48);
      g.fillCircle(point.x + Math.sin(i * 2.4) * spread * 0.3, point.y, spread);
    }
    if (this.visible(s.event.origin.x, s.event.origin.y)) {
      for (let i = 0; i < 6; i++) {
        const spread = Math.min(1, progress * 8) * (10 + i * 2);
        g.fillStyle(0xb8b1a4, 0.35 * (1 - progress));
        g.fillEllipse(s.origin.x + Math.sin(i * 4) * spread, s.origin.y + 6, spread * 2, spread);
      }
    }
    const point = this.flightPoint(s, progress);
    if (!this.pointVisible(point)) return;
    const ahead = this.flightPoint(s, Math.min(1, progress + 0.005));
    const angle = Math.atan2(ahead.y - point.y, ahead.x - point.x);
    // Screen-space minimum size keeps the fuselage and flame readable at normal zoom.
    const size = Math.max(1, Math.min(2.2, 0.85 / this.scene.cameras.main.zoom));
    g.save(); g.translateCanvas(point.x, point.y); g.rotateCanvas(angle); g.scaleCanvas(size, size);
    const flame = 22 + Math.sin(s.age * 0.06) * 5;
    g.fillStyle(0xff631e, 0.35).fillTriangle(-7, -8, -7, 8, -flame - 13, 0);
    g.fillStyle(0xffb932).fillTriangle(-8, -4, -8, 4, -flame, 0);
    g.fillStyle(0xfff4c5).fillTriangle(-8, -2, -8, 2, -flame * 0.7, 0);
    g.fillStyle(0x232b32).fillTriangle(-7, -8, -7, 8, 3, 0);
    g.fillStyle(0xe3e8e7).fillRect(-10, -3, 22, 6);
    g.fillStyle(0xfef9dd).fillTriangle(12, -3, 12, 3, 19, 0);
    g.fillStyle(0x637480).fillRect(-7, 1, 17, 2);
    g.restore();
  }

  /** Ordinary missile defense keeps its short tactical flight presentation. */
  private drawDefense(s: Strike): void {
    const attempts = (s.event.interceptions ?? []).slice(-5);
    attempts.forEach((attempt, index) => {
      const start = s.flightMs * (0.45 + index / Math.max(1, attempts.length) * 0.3);
      const duration = attempt.success ? s.flightMs - start : Math.min(450, s.flightMs * 0.2);
      const p = (s.age - start) / duration;
      if (p < 0 || p > 1) return;
      if (!this.visible(attempt.battery.x, attempt.battery.y)) return;
      const origin = this.tileMap.tileToWorld(attempt.battery.x, attempt.battery.y);
      const target = this.flightPoint(s, attempt.success ? 0.78 : (start + duration) / s.flightMs * (s.event.intercepted ? 0.78 : 1));
      const x = origin.x + (target.x - origin.x + (attempt.success ? 0 : 18)) * p;
      const y = origin.y + (target.y - origin.y - (attempt.success ? 0 : 18)) * p - Math.sin(p * Math.PI) * 25;
      s.graphics.lineStyle(1.5, 0xa9e4ff, 0.8);
      s.graphics.beginPath(); s.graphics.moveTo(origin.x, origin.y); s.graphics.lineTo(x, y); s.graphics.strokePath();
      s.graphics.fillStyle(0xf2fdff).fillCircle(x, y, 2.5);
      if (!attempt.success && p > 0.7) s.graphics.lineStyle(2, 0x96d5ff, (1 - p) * 3).strokeCircle(x, y, 6 + (p - 0.7) * 30);
    });
  }

  private drawCloud(s: Strike, t: number): void {
    const r = s.radius;
    const fade = 1 - smooth((t - 6.2) / 4.3);
    const rise = r * (0.12 + 1.85 * (1 - Math.exp(-t / 2.0)) + t * 0.025);
    const width = r * (0.18 + 0.78 * (1 - Math.exp(-t / 2.8)));
    const born = smooth((t - 0.18) / 1.3);
    const heat = 1 - smooth((t - 0.7) / 2.5);
    const tint = Phaser.Display.Color.GetColor(155 + heat * 100, 150 + heat * 22, 140 - heat * 70);
    s.column.forEach(({ image, seed }, i) => {
      const level = i / (s.column.length - 1);
      const roll = t * 1.3 + i * 2.4;
      const breadth = r * (0.12 + level * 0.08 + t * 0.004);
      image.setPosition(Math.sin(roll) * breadth * 0.22, -rise * level)
        .setDisplaySize(breadth * (1.5 + seed * 0.5), rise / 6 + breadth)
        .setRotation(Math.sin(roll) * 0.25).setTint(tint)
        .setAlpha(born * fade * (0.85 - level * 0.15));
    });
    // Overlapping billows orbit the rim of an expanding, flattened upper cloud.
    // Its underside rolls outward while successive lobes rise from the column.
    s.cap.forEach(({ image, seed }, i) => {
      const angle = i * 2.39996;
      const ring = Math.sqrt((i + 0.5) / s.cap.length);
      const roll = t * 0.65 + angle;
      const size = width * (0.6 + seed * 0.32);
      image.setPosition(Math.cos(angle) * width * ring + Math.sin(roll) * width * 0.05,
        -rise + Math.sin(angle) * width * 0.32 * ring + Math.cos(roll) * width * 0.035)
        .setDisplaySize(size, size * (0.73 + seed * 0.15))
        .setRotation(Math.sin(roll) * 0.2).setTint(tint)
        .setAlpha(born * fade * 0.95);
    });
    const dustSpread = 0.2 + 0.85 * (1 - Math.exp(-t * 3));
    const dustFade = (1 - smooth((t - 4.2) / 5.5)) * smooth(t / 0.22);
    s.dust.forEach(({ image, seed }, i) => {
      const angle = i * 2.39996;
      const ring = Math.sqrt(i / s.dust.length);
      const size = r * (0.62 + seed * 0.2 + t * 0.008);
      image.setPosition(Math.cos(angle) * r * ring * dustSpread,
        Math.sin(angle) * s.groundY * ring * dustSpread - t * r * 0.009)
        .setDisplaySize(size, size * 0.7).setRotation(Math.sin(angle + t * 0.3) * 0.15)
        .setTint(i % 3 === 0 ? 0x716553 : 0x938572).setAlpha(dustFade * 0.97);
    });
  }

  private drawBlast(s: Strike, t: number): void {
    const g = s.graphics, { x, y } = s.target, r = s.radius;
    // Ground-level flash and hot expanding fireball give way to the rising smoke.
    s.fireball.setAlpha(0);
    if (t < 1.7) {
      const ball = r * (0.04 + 0.43 * (1 - Math.exp(-t * 5)));
      const alpha = 1 - smooth((t - 0.5) / 1.2);
      s.fireball.setPosition(x, y - ball * 0.3).setDisplaySize(ball * 3.2, ball * 3.2).setAlpha(alpha);
    }
    if (t < 0.45) {
      g.fillStyle(0xffffed, (1 - t / 0.45) * 0.95).fillEllipse(x, y, r * 2.3, s.groundY * 2.3);
    }
    if (t > 0.12 && t < 2.1) {
      const p = clamp((t - 0.12) / 1.6), spread = 1 - (1 - p) ** 3;
      g.lineStyle(Math.max(2, r * 0.035 * (1 - p)), 0xffe4b5, (1 - p) * 0.85);
      g.strokeEllipse(x, y, r * 2 * spread, s.groundY * 2 * spread);
      g.lineStyle(2, 0xddd5bd, (1 - p) * 0.45);
      g.strokeEllipse(x, y, r * 2.12 * spread, s.groundY * 2.12 * spread);
    }
    if (t < 2.8) {
      for (let i = 0; i < 22; i++) {
        const angle = i * 2.39996, speed = r * (0.12 + noise(i) * 0.27);
        const dx = Math.cos(angle) * speed * t;
        const dy = Math.sin(angle) * speed * t * 0.55 - r * 0.38 * t + r * 0.2 * t * t;
        if (dy > s.groundY * 0.5) continue;
        g.fillStyle(i % 4 === 0 ? 0xefad5e : 0x494035, (1 - t / 2.8) * 0.8);
        g.fillCircle(x + dx, y + dy, Math.max(1.5, r * 0.009));
      }
    }
  }

  private ensureTexture(): void { ensureNuclearEffectTextures(this.scene); }

  private destroyStrike(s: Strike): void {
    s.terrain?.destroy(); s.cloud.destroy(true); s.graphics.destroy(); s.fireball.destroy();
  }
  private clear(): void {
    for (const strike of this.strikes) this.destroyStrike(strike);
    this.strikes.length = 0;
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this);
  }
  shutdown(): void {
    if (this.disposed) return;
    this.disposed = true; this.unsubscribe(); this.clear();
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }
}
