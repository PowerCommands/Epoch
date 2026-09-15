import Phaser from 'phaser';
import type { TileMap } from '../systems/TileMap';
import type { AirFlightEvent, AirOperationsSystem } from '../systems/AirOperationsSystem';
import { getUnitSpriteKey } from '../utils/assetPaths';
import { WORLD_EFFECT_DEPTH } from '../systems/rendering/WorldEffectDepths';
import {
  AIRCRAFT_ANIMATIONS, AIR_HEADING, AIR_SMOKE_MS, airPosition, airWeaponPosition,
  clampAir, mixAir, planAirAttack,
  type AircraftAnimationProfile, type AirAttackPlan, type AirPoint, type AirWeapon,
} from './AirMissionAnimation';

const SMOKE_TEXTURE = 'air-mission-smoke';
const MAX_FLIGHTS = 8;
interface AircraftVisual {
  image: Phaser.GameObjects.Image;
  engines: Phaser.GameObjects.Graphics;
  shadow: Phaser.GameObjects.Image;
  profile: AircraftAnimationProfile;
}
interface Flight {
  kind: AirFlightEvent['kind'];
  targetTile: AirPoint;
  age: number;
  plan: AirAttackPlan;
  aircraft: AircraftVisual;
  interceptor?: AircraftVisual;
  defenseOrigin?: AirPoint;
  destroyed: boolean;
  graphics: Phaser.GameObjects.Graphics;
  smoke: Phaser.GameObjects.Image[][];
  restoreBadge?: () => void;
}

/** Disposable, bounded presentation of already-resolved air missions. */
export class AirMissionRenderer {
  private readonly flights: Flight[] = [];
  private readonly unsubscribe: () => void;
  private disposed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tileMap: TileMap,
    air: AirOperationsSystem,
    private readonly enabled: () => boolean,
    private readonly visible: (x: number, y: number) => boolean,
    private readonly suppressBadge?: (target: AirPoint) => () => void,
  ) {
    this.unsubscribe = air.onFlight(this.fly);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  private readonly fly = (event: AirFlightEvent): void => {
    if (this.disposed || !this.enabled()) return;
    if (!this.visible(event.origin.x, event.origin.y) && !this.visible(event.destination.x, event.destination.y)) return;
    const target = this.tileMap.tileToWorld(event.destination.x, event.destination.y);
    const plan = planAirAttack(target, event.aircraft.unitType.aircraftRole ?? 'fighter', event.kind !== 'strike', this.scene.cameras.main.worldView);
    if (event.kind === 'rebase') {
      plan.start = this.tileMap.tileToWorld(event.origin.x, event.origin.y);
      plan.end = target;
      plan.flightMs = Math.max(450, Math.min(1800, Math.hypot(target.x - plan.start.x, target.y - plan.start.y) * 2));
      plan.endMs = plan.flightMs;
    }
    if (this.flights.length >= MAX_FLIGHTS) this.destroyFlight(this.flights.shift()!);
    const flight: Flight = { kind: event.kind, targetTile: { ...event.destination }, age: 0, plan,
      aircraft: this.createAircraft(event.aircraft.unitType.id, 'aircraft-attack'), destroyed: event.destroyed,
      graphics: this.scene.add.graphics().setDepth(WORLD_EFFECT_DEPTH.airImpact).setName('air-mission-weapons'), smoke: [] };
    if (event.kind === 'intercepted' && event.interceptor && event.interceptorOrigin) {
      flight.defenseOrigin = this.tileMap.tileToWorld(event.interceptorOrigin.x, event.interceptorOrigin.y);
      if (event.interceptor.unitType.aircraftRole === 'fighter') flight.interceptor = this.createAircraft(event.interceptor.unitType.id, 'aircraft-interceptor');
    }
    if (plan.weapons.length) {
      this.ensureSmokeTexture();
      flight.smoke = plan.weapons.map(() => Array.from({ length: 7 }, () =>
        this.scene.add.image(target.x, target.y, SMOKE_TEXTURE).setDepth(WORLD_EFFECT_DEPTH.airSmoke).setVisible(false).setName('air-impact-smoke')));
    }
    this.flights.push(flight);
    if (this.flights.length === 1) this.scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
    this.draw(flight);
  };

  private createAircraft(id: string, name: string): AircraftVisual {
    const profile = AIRCRAFT_ANIMATIONS[id] ?? AIRCRAFT_ANIMATIONS.jet_fighter;
    const key = getUnitSpriteKey(id);
    return { profile,
      image: this.scene.add.image(0, 0, key).setDepth(WORLD_EFFECT_DEPTH.aircraft).setDisplaySize(profile.size, profile.size).setName(name),
      engines: this.scene.add.graphics().setDepth(WORLD_EFFECT_DEPTH.aircraftEngines).setName('aircraft-engines'),
      shadow: this.scene.add.image(0, 0, key).setDepth(WORLD_EFFECT_DEPTH.aircraftShadow).setTint(0x101820).setName('aircraft-shadow') };
  }

  private update(_time: number, delta: number): void {
    if (!this.enabled()) { this.clear(); return; }
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const flight = this.flights[i];
      flight.age += delta;
      if (flight.age >= flight.plan.endMs) {
        this.destroyFlight(flight); this.flights.splice(i, 1);
      } else this.draw(flight);
    }
    if (!this.flights.length) this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this);
  }

  private pointVisible(point: AirPoint): boolean {
    const tile = this.tileMap.worldToTile(point.x, point.y);
    return !!tile && this.visible(tile.x, tile.y);
  }

  private draw(flight: Flight): void {
    const { plan, age, aircraft, graphics: g } = flight;
    g.clear();
    if (plan.weapons.length && age >= plan.weapons[0].impactMs - 100
      && this.visible(flight.targetTile.x, flight.targetTile.y) && !flight.restoreBadge) {
      flight.restoreBadge = this.suppressBadge?.(flight.targetTile);
    }
    const point = airPosition(plan, age);
    const heading = flight.kind === 'rebase' ? Math.atan2(plan.end.y - plan.start.y, plan.end.x - plan.start.x) : AIR_HEADING;
    let alpha = clampAir(age / 160) * clampAir((plan.flightMs - age) / 220);
    if (flight.kind === 'intercepted') {
      // Break off before reaching the objective; no weapons, blast or destruction flash.
      alpha *= 1 - clampAir((age - plan.passMs + 210) / (flight.destroyed ? 170 : 340));
    }
    this.drawAircraft(aircraft, point, heading, alpha, age, plan.altitude);
    if (flight.kind === 'intercepted') this.drawInterception(flight);
    for (let i = 0; i < plan.weapons.length; i++) {
      const weapon = plan.weapons[i];
      if (age >= weapon.releaseMs && age < weapon.impactMs) this.drawWeapon(g, weapon, age);
      const smoke = flight.smoke[i];
      smoke.forEach(puff => puff.setVisible(false));
      if (age >= weapon.impactMs && age < weapon.impactMs + AIR_SMOKE_MS
        && this.visible(flight.targetTile.x, flight.targetTile.y)) this.drawImpact(g, weapon.target, age - weapon.impactMs, smoke);
    }
  }

  private drawAircraft(visual: AircraftVisual, point: AirPoint, heading: number, alpha: number, age: number, altitude: number): void {
    const { image, shadow, engines: g, profile } = visual;
    const shown = alpha > 0 && this.pointVisible({ x: point.x, y: point.y + altitude });
    image.setVisible(shown); shadow.setVisible(shown); g.clear().setVisible(shown);
    if (!shown) return;
    const bank = Math.sin(age * .003) * .025;
    const rotation = heading - profile.heading * Math.PI / 180 + bank;
    const bob = Math.sin(age * .006) * 1.1;
    image.setPosition(point.x, point.y + bob).setRotation(rotation).setAlpha(alpha);
    shadow.setPosition(point.x + 8, point.y + altitude).setRotation(rotation)
      .setDisplaySize(profile.size * .78, profile.size * .65).setAlpha(alpha * .2);
    g.save(); g.translateCanvas(point.x, point.y + bob); g.rotateCanvas(rotation);
    const size = profile.size;
    for (const [index, prop] of profile.propellers.entries()) {
      const x = (prop.x - .5) * size, y = (prop.y - .5) * size;
      g.fillStyle(0xe8e1bc, .16 * alpha).fillEllipse(x, y, size * .14, size * .09);
      const angle = age * .055 + index * 1.7;
      g.lineStyle(1.4, 0xffedbb, .62 * alpha);
      g.lineBetween(x - Math.cos(angle) * size * .068, y - Math.sin(angle) * size * .043,
        x + Math.cos(angle) * size * .068, y + Math.sin(angle) * size * .043);
    }
    const nose = profile.heading * Math.PI / 180;
    for (const exhaust of profile.exhausts) {
      const x = (exhaust.x - .5) * size, y = (exhaust.y - .5) * size;
      const length = size * (.10 + .025 * Math.sin(age * .08));
      g.lineStyle(4, 0x63b9ff, alpha * .22).lineBetween(x, y, x - Math.cos(nose) * length, y - Math.sin(nose) * length);
      g.lineStyle(1.6, 0xffdf9f, alpha * .8).lineBetween(x, y, x - Math.cos(nose) * length * .6, y - Math.sin(nose) * length * .6);
    }
    g.restore();
  }

  private drawWeapon(g: Phaser.GameObjects.Graphics, weapon: AirWeapon, age: number): void {
    const point = airWeaponPosition(weapon, age);
    if (weapon.kind === 'missile') {
      for (let i = 1; i <= 12; i++) {
        const earlier = age - i * 15;
        if (earlier < weapon.releaseMs) break;
        const trail = airWeaponPosition(weapon, earlier);
        if (this.pointVisible(trail)) g.fillStyle(0xddd9c9, .36 * (1 - i / 13)).fillCircle(trail.x, trail.y, 1 + i * .21);
      }
    }
    if (!this.pointVisible(point)) return;
    const next = airWeaponPosition(weapon, age + 1);
    const angle = Math.atan2(next.y - point.y, next.x - point.x);
    g.save(); g.translateCanvas(point.x, point.y); g.rotateCanvas(angle);
    if (weapon.kind === 'missile') {
      g.fillStyle(0xff6f28, .55).fillTriangle(-5, -3, -5, 3, -18, 0);
      g.fillStyle(0xfff1ac).fillTriangle(-5, -1.4, -5, 1.4, -12, 0);
      g.fillStyle(0x7c8991).fillTriangle(-5, -4, -5, 4, 1, 0);
      g.fillStyle(0xeff3ef).fillRect(-6, -1.8, 12, 3.6).fillTriangle(6, -1.8, 6, 1.8, 10, 0);
    } else {
      const p = clampAir((age - weapon.releaseMs) / (weapon.impactMs - weapon.releaseMs));
      g.scaleCanvas(1 - p * .35, 1 - p * .35);
      g.fillStyle(0x172029).fillTriangle(-7, -4, -7, 4, 0, 0).fillEllipse(1, 0, 13, 7);
      g.fillStyle(0x9c9e7d).fillRect(-1, -2, 3, 4);
    }
    g.restore();
  }

  private drawImpact(g: Phaser.GameObjects.Graphics, point: AirPoint, age: number, smoke: Phaser.GameObjects.Image[]): void {
    const t = age / AIR_SMOKE_MS;
    const fade = 1 - clampAir((t - .35) / .65);
    smoke.forEach((puff, i) => {
      const angle = i * 2.39996;
      const spread = 6 + t * 21;
      const size = 20 + t * 38 + i % 3 * 4;
      puff.setVisible(true).setPosition(point.x + Math.cos(angle) * spread + t * 10,
        point.y + Math.sin(angle) * spread * .45 - t * (28 + i * 3))
        .setDisplaySize(size, size * .86).setRotation(angle + t * .2)
        .setTint(age < 200 ? 0x967c5c : i % 2 ? 0x676968 : 0x89877e)
        .setAlpha(clampAir(age / 90) * fade * .75);
    });
    if (age < 420) {
      const p = age / 420;
      g.fillStyle(0xff6d24, (1 - p) * .75).fillCircle(point.x, point.y - p * 6, 5 + p * 24);
      g.fillStyle(0xffc64b, (1 - p) * .95).fillCircle(point.x, point.y - p * 5, 4 + p * 15);
      g.fillStyle(0xfff7d6, 1 - p).fillCircle(point.x, point.y, 3 + p * 7);
      g.lineStyle(2 * (1 - p), 0xd9bd8a, (1 - p) * .6).strokeEllipse(point.x, point.y + 3, 60 * p, 30 * p);
      for (let i = 0; i < 7; i++) {
        const angle = i * 2.39996;
        g.fillStyle(0xffc15c, 1 - p).fillCircle(point.x + Math.cos(angle) * p * 32, point.y + Math.sin(angle) * p * 23 - p * 10, 1.5);
      }
    }
  }

  private drawInterception(flight: Flight): void {
    if (!flight.defenseOrigin) return;
    const { plan, age, defenseOrigin: base, interceptor } = flight;
    const meeting = airPosition(plan, plan.passMs - 200);
    const p = (age - plan.passMs + 650) / 450;
    if (interceptor) {
      const progress = p < 1 ? clampAir(p) : 1 - clampAir((p - 1) * .6);
      const point = mixAir(base, meeting, progress);
      const heading = Math.atan2(meeting.y - base.y, meeting.x - base.x) + (p > 1 ? Math.PI : 0);
      this.drawAircraft(interceptor, point, heading, p >= 0 && progress > 0 ? 1 : 0, age, plan.altitude);
    } else if (p >= 0 && p <= 1) {
      const point = mixAir(base, meeting, p), tail = mixAir(base, meeting, Math.max(0, p - .08));
      if (this.pointVisible(point) && this.pointVisible(tail)) flight.graphics.lineStyle(2, 0xffd983, .9).lineBetween(tail.x, tail.y, point.x, point.y);
    }
  }

  private ensureSmokeTexture(): void {
    if (this.scene.textures.exists(SMOKE_TEXTURE)) return;
    const texture = this.scene.textures.createCanvas(SMOKE_TEXTURE, 64, 64)!;
    const ctx = texture.context;
    for (let i = 0; i < 6; i++) {
      const angle = i * 2.39996, x = 32 + Math.cos(angle) * 10, y = 32 + Math.sin(angle) * 10;
      const gradient = ctx.createRadialGradient(x - 3, y - 4, 1, x, y, 22);
      gradient.addColorStop(0, 'rgba(255,255,255,.8)');
      gradient.addColorStop(.55, 'rgba(225,225,220,.55)');
      gradient.addColorStop(1, 'rgba(190,190,185,0)');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
    }
    texture.refresh();
  }

  private destroyFlight(flight: Flight): void {
    flight.restoreBadge?.();
    for (const visual of [flight.aircraft, flight.interceptor]) {
      visual?.image.destroy(); visual?.engines.destroy(); visual?.shadow.destroy();
    }
    flight.graphics.destroy();
    for (const cloud of flight.smoke) for (const puff of cloud) puff.destroy();
  }
  private clear(): void {
    this.flights.forEach(flight => this.destroyFlight(flight)); this.flights.length = 0;
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this);
  }
  shutdown(): void {
    if (this.disposed) return;
    this.disposed = true; this.unsubscribe(); this.clear();
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }
}
