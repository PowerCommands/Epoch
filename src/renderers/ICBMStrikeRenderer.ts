import Phaser from 'phaser';
import type { StrategicDetonation, StrategicWeaponsSystem } from '../systems/StrategicWeaponsSystem';
import type { TileMap } from '../systems/TileMap';
import type { CameraController, CinematicCameraState } from '../systems/CameraController';
import type { WorldInputGate } from '../systems/input/WorldInputGate';
import { globeOrientation, wrapLongitude, type PlanetaryView } from '../systems/rendering/PlanetaryProjection';
import { ensureNuclearEffectTextures, SMOKE_TEXTURE } from './NuclearEffectTextures';
import { ballisticAltitude, ballisticSurfacePoint, clampFlight as clamp, smoothFlight as smooth, mixFlight as mix,
  ICBM_ASCENT_MS, ICBM_GLOBE_MS, ICBM_FLIGHT_MS, ICBM_RETURN_MS, icbmImpactHoldMs, type FlightPoint } from './ICBMFlight';

const INPUT_ID = 'strategic-missile-cinematic';
const INTERCEPT_START = 6200;
const INTERCEPT_MS = 650;
const noise = (n: number): number => { const value = Math.sin(n * 127.1 + 311.7) * 43758.5453; return value - Math.floor(value); };
type Interception = NonNullable<StrategicDetonation['interceptions']>[number];
interface Cinematic {
  event: StrategicDetonation;
  origin: FlightPoint;
  target: FlightPoint;
  state: CinematicCameraState;
  age: number;
  launchZoom: number;
  flightEnd: number;
  impactAt: number;
  hold: number;
  interceptions: Interception[];
  originVisible: boolean;
  targetVisible: boolean;
  observed: boolean;
  terrain?: Phaser.GameObjects.RenderTexture;
}

/** Presents already-resolved outcomes. The existing globe remains the only
 * world renderer. A single disposable screen canvas adds high-altitude objects
 * after its camera filter, so exhaust and mushroom clouds can clear the limb.
 * No timers, RNG, turn callbacks, or gameplay mutations belong to this class. */
export class ICBMStrikeRenderer {
  private active?: Cinematic;
  private readonly pending: StrategicDetonation[] = [];
  private disposed = false;
  private readonly unsubscribe: () => void;
  private overlay?: HTMLDivElement;
  private canvas?: HTMLCanvasElement;
  private context?: CanvasRenderingContext2D;
  private caption?: HTMLDivElement;
  private detail?: HTMLDivElement;
  private smoke?: HTMLCanvasElement;
  private dust?: HTMLCanvasElement;
  private hotSmoke?: HTMLCanvasElement;
  private smokeShadow?: HTMLCanvasElement;
  private smokeLight?: HTMLCanvasElement;
  private lastDraw = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly tileMap: TileMap,
    weapons: StrategicWeaponsSystem, private readonly camera: CameraController,
    private readonly input: WorldInputGate, private readonly enabled: () => boolean,
    private readonly visible: (x: number, y: number) => boolean,
    private readonly ownsStrike: (event: StrategicDetonation) => boolean = () => false,
    private readonly onFinished?: () => void) {
    this.unsubscribe = weapons.onDetonation(this.play);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  private readonly play = (event: StrategicDetonation): void => {
    if (this.disposed || !this.enabled() || event.weaponId !== 'icbm' || !event.origin) return;
    if (!this.visible(event.origin.x, event.origin.y) && !this.visible(event.target.x, event.target.y) && !this.ownsStrike(event)) return;
    if (this.active) {
      // A salvo never holds up an AI turn or creates an unbounded movie queue.
      if (this.pending.length === 2) this.pending.shift();
      this.pending.push(event);
      return;
    }
    this.start(event);
  };

  private start(event: StrategicDetonation): void {
    const state = this.camera.beginCinematic();
    if (!state) return;
    const origin = this.tileMap.tileToWorld(event.origin!.x, event.origin!.y);
    const target = this.tileMap.tileToWorld(event.target.x, event.target.y);
    const originVisible = this.visible(event.origin!.x, event.origin!.y);
    const targetVisible = this.visible(event.target.x, event.target.y);
    // Last attempts include the authoritative successful shot in a rare long salvo.
    const interceptions = (event.interceptions ?? []).slice(-5);
    const flightEnd = Math.max(ICBM_FLIGHT_MS, INTERCEPT_START + interceptions.length * INTERCEPT_MS + 600);
    const impactAt = event.intercepted && interceptions.length
      ? INTERCEPT_START + (interceptions.length - 1) * INTERCEPT_MS + 450 : flightEnd;
    const s: Cinematic = { event, state, origin, target, originVisible, targetVisible, interceptions, observed: this.ownsStrike(event),
      age: originVisible ? 0 : ICBM_GLOBE_MS + 1200, launchZoom: Math.max(0.8, Math.min(1.4, state.zoom)),
      flightEnd, impactAt, hold: icbmImpactHoldMs(event.nuclear, !!event.intercepted) };
    if (targetVisible && !event.intercepted) {
      const tile = this.tileMap.getTileRect(event.target.x, event.target.y);
      const radius = tile.width * ((event.radius ?? (event.nuclear ? 3 : 2)) + 0.6);
      if (radius * 2 < 2048) s.terrain = this.tileMap.captureTerrain({ x: target.x - radius, y: target.y - radius,
        width: radius * 2, height: radius * 2 });
    }
    this.active = s;
    this.input.blockWorld(INPUT_ID);
    this.createOverlay();
    this.scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
    this.draw(s);
  }

  private createOverlay(): void {
    ensureNuclearEffectTextures(this.scene);
    const brush = this.scene.textures.get(SMOKE_TEXTURE).getSourceImage() as HTMLCanvasElement;
    const tinted = (color: string): HTMLCanvasElement => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(brush, 0, 0, 128, 128);
      ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = color; ctx.fillRect(0, 0, 128, 128);
      // Retain the canonical brush's shaded billows beneath the colored layer.
      ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.48; ctx.drawImage(brush, 0, 0, 128, 128);
      return canvas;
    };
    this.smoke ??= tinted('#b2b3ad'); this.dust ??= tinted('#8c7b63'); this.hotSmoke ??= tinted('#ffc57b');
    this.smokeShadow ??= tinted('#6e777c'); this.smokeLight ??= tinted('#d3d2c4');
    const root = document.createElement('div');
    root.className = 'icbm-cinematic';
    root.style.cssText = 'position:fixed;z-index:60;overflow:hidden;touch-action:none;color:#edf5fa;font-family:Arial,sans-serif';
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
    canvas.setAttribute('aria-hidden', 'true'); root.append(canvas);
    const label = document.createElement('div');
    label.style.cssText = 'position:absolute;left:36px;bottom:43px;font-size:13px;letter-spacing:4px;font-weight:700;text-shadow:0 1px 8px #000';
    const detail = document.createElement('div');
    detail.style.cssText = 'position:absolute;left:36px;bottom:21px;font-size:11px;letter-spacing:2px;color:#a9bdca';
    const skip = document.createElement('button');
    skip.type = 'button'; skip.textContent = 'Skip · Esc';
    skip.style.cssText = 'position:absolute;right:30px;bottom:25px;border:1px solid #61717a88;border-radius:3px;padding:8px 14px;background:#10202be0;color:#d2e1eb;font:12px Arial;cursor:pointer';
    skip.addEventListener('click', this.skip);
    root.append(label, detail, skip); document.body.append(root);
    this.overlay = root; this.canvas = canvas; this.context = canvas.getContext('2d')!;
    this.caption = label; this.detail = detail;
    window.addEventListener('keydown', this.onKey, true);
  }

  private readonly onKey = (event: KeyboardEvent): void => {
    // Prevent turn/action shortcuts while the temporary camera owns the view.
    if (event.ctrlKey || event.metaKey || event.altKey || event.key === 'F12') return;
    if (event.key === 'Escape') { event.preventDefault(); this.skip(); }
    event.stopImmediatePropagation();
  };
  private readonly skip = (): void => { this.pending.length = 0; this.finish(false); };

  private update(_time: number, delta: number): void {
    if (!this.enabled()) { this.pending.length = 0; this.finish(true); return; }
    const s = this.active;
    if (!s) return;
    s.age += Math.max(0, delta);
    if (s.age >= s.impactAt + s.hold + ICBM_RETURN_MS) { this.finish(false); return; }
    this.lastDraw += delta;
    if (this.lastDraw < 1000 / 30) return;
    this.lastDraw = 0;
    this.draw(s);
  }

  private progress(s: Cinematic, age: number): number {
    if (age < ICBM_ASCENT_MS) return 0;
    if (age < ICBM_GLOBE_MS) return 0.15 * smooth((age - ICBM_ASCENT_MS) / (ICBM_GLOBE_MS - ICBM_ASCENT_MS));
    return mix(0.15, 1, clamp((age - ICBM_GLOBE_MS) / (s.flightEnd - ICBM_GLOBE_MS)));
  }

  private surfacePoint(s: Cinematic, progress: number): FlightPoint {
    const view = this.camera.cinematicGlobeView;
    return view ? ballisticSurfacePoint(s.origin, s.target, progress, view)
      : { x: mix(s.origin.x, s.target.x, progress), y: mix(s.origin.y, s.target.y, progress) };
  }

  private framePoint(point: FlightPoint, longitudeOffset: number, latitudeOffset: number, view?: PlanetaryView): FlightPoint {
    if (!view) return point;
    const orientation = globeOrientation(point.x, point.y, view);
    const longitude = wrapLongitude(orientation.longitude + longitudeOffset);
    const latitude = Math.max(-1.48, Math.min(1.48, orientation.latitude + latitudeOffset));
    const surface = view.surface ?? { originX: 0, originY: 0, width: view.mapWidth, height: view.mapHeight, shearX: 0 };
    const v = 0.5 + latitude / Math.PI;
    return { x: surface.originX + (0.5 + longitude / (2 * Math.PI)) * surface.width + v * surface.shearX,
      y: surface.originY + v * surface.height };
  }

  private updateCamera(s: Cinematic): void {
    const { min } = this.camera.cinematicZoomRange;
    const pull = smooth((s.age - ICBM_ASCENT_MS) / (ICBM_GLOBE_MS - ICBM_ASCENT_MS));
    const progress = this.progress(s, Math.min(s.age, s.impactAt));
    let point = this.surfacePoint(s, progress);
    // Tilt toward the flight at altitude; compose the ground lower in frame as
    // re-entry begins, leaving space for the cloud to climb into the atmosphere.
    const approach = smooth((progress - 0.65) / 0.35);
    const impactPitch = s.event.nuclear && !s.event.intercepted ? 0.08 : -0.34;
    const sweep = mix(0.4, -0.4, smooth((progress - 0.15) / 0.55));
    point = this.framePoint(point, sweep * pull * (1 - approach), mix(0.75, impactPitch, approach) * pull, this.camera.cinematicGlobeView);
    let zoom = s.launchZoom * (min / s.launchZoom) ** pull;
    const returning = smooth((s.age - s.impactAt - s.hold) / ICBM_RETURN_MS);
    if (returning > 0) {
      const destination = (s.targetVisible || s.observed) && !s.event.intercepted ? s.target : { x: s.state.centerX, y: s.state.centerY };
      if (!s.event.intercepted && (s.targetVisible || s.observed)) point = this.framePoint(destination, 0, impactPitch * (1 - returning), this.camera.cinematicGlobeView);
      else point = { x: mix(point.x, destination.x, returning), y: mix(point.y, destination.y, returning) };
      const returnZoom = Math.max(s.state.zoom, this.camera.cinematicZoomRange.start * 1.3, 0.65);
      zoom = min * (returnZoom / min) ** returning;
    }
    this.camera.setCinematicView(point.x, point.y, zoom);
  }

  private draw(s: Cinematic): void {
    this.updateCamera(s);
    const ctx = this.context!, canvas = this.canvas!;
    const rect = this.scene.game.canvas.getBoundingClientRect();
    this.overlay!.style.left = `${rect.left}px`; this.overlay!.style.top = `${rect.top}px`;
    this.overlay!.style.width = `${rect.width}px`; this.overlay!.style.height = `${rect.height}px`;
    const width = this.scene.scale.width, height = this.scene.scale.height;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
    const fade = 1 - smooth((s.age - s.impactAt - s.hold) / ICBM_RETURN_MS);
    this.overlay!.style.opacity = `${fade}`;
    // Small letterbox bands keep flight captions legible without replacing HUD state.
    const shade = ctx.createLinearGradient(0, 0, 0, height);
    shade.addColorStop(0, '#020812e8'); shade.addColorStop(0.13, '#02081200');
    shade.addColorStop(0.83, '#02081200'); shade.addColorStop(1, '#020812fa');
    ctx.fillStyle = shade; ctx.fillRect(0, 0, width, height);
    s.targetVisible = this.visible(s.event.target.x, s.event.target.y);
    s.terrain?.setVisible(s.targetVisible);
    if (s.age > s.impactAt + 180) { s.terrain?.destroy(); s.terrain = undefined; }
    const impact = s.age >= s.impactAt;
    const impactKnown = s.targetVisible || s.observed;
    if (s.age < ICBM_GLOBE_MS && s.originVisible) this.drawLaunch(s);
    if (s.age >= ICBM_ASCENT_MS && !impact) this.drawFlight(s);
    this.drawInterceptions(s);
    if (impact && !s.event.intercepted && impactKnown) this.drawImpact(s, (s.age - s.impactAt) / 1000);
    const phase = impact ? s.event.intercepted ? 'MISSILE INTERCEPTED' : impactKnown ? s.event.nuclear ? 'NUCLEAR DETONATION' : 'CONVENTIONAL IMPACT' : 'SIGNAL LOST'
      : s.age < 650 ? 'IGNITION' : s.age < ICBM_ASCENT_MS ? 'VERTICAL ASCENT' : s.age < ICBM_GLOBE_MS ? 'LEAVING THE ATMOSPHERE'
      : this.progress(s, s.age) > 0.78 ? 'RE-ENTRY' : 'BALLISTIC FLIGHT';
    this.caption!.textContent = phase;
    this.detail!.textContent = `ICBM  /  ${impact && s.event.intercepted ? 'PATRIOT DEFENSE SUCCESSFUL' : impact && impactKnown ? s.event.nuclear ? 'NUCLEAR PAYLOAD' : 'CONVENTIONAL PAYLOAD' : 'STRATEGIC MISSILE'}`;
  }

  private puff(brush: HTMLCanvasElement, x: number, y: number, width: number, height: number, alpha: number): void {
    if (width <= 0 || height <= 0 || alpha <= 0) return;
    const ctx = this.context!;
    ctx.globalAlpha = clamp(alpha); ctx.drawImage(brush, x - width / 2, y - height / 2, width, height); ctx.globalAlpha = 1;
  }

  private glow(x: number, y: number, radius: number, alpha: number, cold = false): void {
    if (radius <= 0 || alpha <= 0) return;
    const ctx = this.context!, gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(255,255,239,${clamp(alpha)})`);
    gradient.addColorStop(0.16, `rgba(${cold ? '194,236,255' : '255,226,151'},${clamp(alpha * 0.9)})`);
    gradient.addColorStop(0.4, `rgba(${cold ? '81,182,255' : '255,124,35'},${clamp(alpha * 0.55)})`);
    gradient.addColorStop(1, 'rgba(255,100,20,0)');
    ctx.fillStyle = gradient; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  private rocket(point: FlightPoint, angle: number, size: number, age: number, reentry = false): void {
    const ctx = this.context!;
    this.glow(point.x, point.y, reentry ? 32 : 20, reentry ? 0.85 : 0.5);
    ctx.save(); ctx.translate(point.x, point.y); ctx.rotate(angle); ctx.scale(size, size);
    const flame = (reentry ? 25 : 35) + Math.sin(age * 0.07) * 6;
    for (const [breadth, length, color] of [[8, flame * 1.4, '#ff551c55'], [4, flame, '#ffc23e'], [2, flame * 0.75, '#fff5cb']] as const) {
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(-10, -breadth); ctx.lineTo(-10 - length, 0); ctx.lineTo(-10, breadth); ctx.fill();
    }
    ctx.fillStyle = '#637a86'; ctx.beginPath(); ctx.moveTo(-8, -9); ctx.lineTo(-8, 9); ctx.lineTo(4, 0); ctx.fill();
    const body = ctx.createLinearGradient(0, -3, 0, 3); body.addColorStop(0, '#fff8de'); body.addColorStop(0.4, '#dce4e9'); body.addColorStop(1, '#536472');
    ctx.fillStyle = body; ctx.fillRect(-11, -3, 22, 6); ctx.beginPath(); ctx.moveTo(11, -3); ctx.lineTo(20, 0); ctx.lineTo(11, 3); ctx.fill();
    ctx.fillStyle = '#7d3530'; ctx.fillRect(6, -3, 3, 6); ctx.restore();
  }

  private drawLaunch(s: Cinematic): void {
    const ground = this.camera.projectCinematicPoint(s.origin.x, s.origin.y);
    if (!ground || !this.visible(s.event.origin!.x, s.event.origin!.y)) return;
    const p = clamp((s.age - 450) / (ICBM_ASCENT_MS - 450));
    const pull = smooth((s.age - ICBM_ASCENT_MS) / (ICBM_GLOBE_MS - ICBM_ASCENT_MS));
    const scale = mix(1, 0.2, pull), rise = p * p * 190 * scale;
    for (let i = 0; i < 26; i++) {
      const spread = (12 + Math.min(s.age / 1000, 2.5) * (20 + noise(i) * 30)) * scale;
      const angle = i * 2.39996;
      this.puff(this.smoke!, ground.x + Math.cos(angle) * spread, ground.y + Math.sin(angle) * spread * 0.26,
        spread * 1.4, spread * 0.8, (1 - pull) * smooth(s.age / 500) * 0.66);
    }
    if (pull < 0.25) {
      this.glow(ground.x, ground.y, (48 + Math.sin(s.age * 0.03) * 7) * scale, (1 - p * 0.7) * smooth(s.age / 220));
      for (let i = 14; i > 0; i--) {
        const age = s.age - i * 35, earlier = clamp((age - 450) / (ICBM_ASCENT_MS - 450));
        this.puff(i < 4 ? this.hotSmoke! : this.smoke!, ground.x + Math.sin(i * 4.2) * i * 0.9,
          ground.y - earlier * earlier * 190 * scale, (9 + i * 2.8) * scale, (15 + i * 3) * scale, (1 - pull * 3) * 0.5);
      }
      this.rocket({ x: ground.x, y: ground.y - rise }, -Math.PI / 2, mix(1.25, 0.6, pull), s.age);
    }
  }

  private flightPoint(s: Cinematic, progress: number): FlightPoint | null {
    const surface = this.surfacePoint(s, progress);
    const point = this.camera.projectCinematicPoint(surface.x, surface.y, ballisticAltitude(progress));
    if (!point) return null;
    const strength = this.camera.cinematicGlobeView?.strength ?? 0;
    return { x: point.x, y: point.y - 190 * (1 - strength) * (1 - smooth(progress / 0.35)) };
  }

  private drawFlight(s: Cinematic): void {
    const ctx = this.context!, progress = this.progress(s, s.age);
    const birth = s.originVisible ? 0 : this.progress(s, ICBM_GLOBE_MS + 1200);
    // A thin fading atmospheric trail, with a brighter hot plume near the vehicle.
    for (let i = 55; i > 0; i--) {
      const earlier = progress - i * 0.0042;
      if (earlier < birth) continue;
      const a = this.flightPoint(s, earlier), b = this.flightPoint(s, Math.max(birth, earlier - 0.0042));
      if (!a || !b) continue;
      ctx.lineWidth = 1.2 + (1 - i / 56) * 2.3;
      ctx.strokeStyle = `rgba(${progress > 0.78 ? '255,170,89' : '155,220,255'},${(1 - i / 56) * 0.58})`;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(a.x, a.y); ctx.stroke();
      if (i < 15) this.puff(this.smoke!, a.x, a.y, 3 + i * 0.55, 3 + i * 0.55, (1 - i / 16) * 0.35);
    }
    const point = this.flightPoint(s, progress), ahead = this.flightPoint(s, Math.min(1, progress + 0.002));
    if (!point || !ahead) return;
    const pull = smooth((s.age - ICBM_ASCENT_MS) / (ICBM_GLOBE_MS - ICBM_ASCENT_MS));
    if (pull < 0.25) return;
    this.rocket(point, Math.atan2(ahead.y - point.y, ahead.x - point.x), mix(0.9, 0.55, pull), s.age, progress > 0.78);
    if (progress > 0.8) {
      for (let i = 0; i < 12; i++) {
        const angle = Math.atan2(ahead.y - point.y, ahead.x - point.x) + Math.PI;
        const distance = noise(i + 7) * 45;
        ctx.fillStyle = `rgba(255,205,133,${(1 - distance / 50) * 0.9})`;
        ctx.fillRect(point.x + Math.cos(angle) * distance + Math.sin(i * 9 + s.age * 0.02) * 5,
          point.y + Math.sin(angle) * distance + Math.cos(i * 9 + s.age * 0.02) * 5, 2, 2);
      }
    }
  }

  private drawInterceptions(s: Cinematic): void {
    const ctx = this.context!;
    s.interceptions.forEach((attempt, index) => {
      const age = s.age - INTERCEPT_START - index * INTERCEPT_MS;
      if (age < 0 || age > (attempt.success ? 1800 : 900)) return;
      const interceptAge = INTERCEPT_START + index * INTERCEPT_MS + 450;
      const target = this.flightPoint(s, this.progress(s, interceptAge));
      if (!target) return;
      const battery = this.tileMap.tileToWorld(attempt.battery.x, attempt.battery.y);
      const ground = this.visible(attempt.battery.x, attempt.battery.y) ? this.camera.projectCinematicPoint(battery.x, battery.y) : null;
      const start = ground ?? { x: target.x + 45, y: target.y + 95 };
      const p = clamp(age / 450), miss = attempt.success ? 0 : 35;
      const point = { x: mix(start.x, target.x + miss, p), y: mix(start.y, target.y - miss, p) - Math.sin(Math.PI * p) * 38 };
      if (age < 450) {
        ctx.strokeStyle = '#94e2ffb0'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.quadraticCurveTo(mix(start.x, point.x, 0.5), mix(start.y, point.y, 0.5) - 22, point.x, point.y); ctx.stroke();
        this.glow(point.x, point.y, 15, 1, true);
        if (ground) this.glow(start.x, start.y, 19, 1 - p, true);
      } else {
        const explosion = (age - 450) / 1000;
        const size = attempt.success ? 75 : 23;
        const alpha = 1 - smooth(explosion / (attempt.success ? 1.4 : 0.4));
        this.glow(point.x, point.y, size * (0.4 + explosion), alpha, true);
        ctx.strokeStyle = `rgba(197,235,255,${alpha * 0.8})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(point.x, point.y, Math.max(1, explosion * size * 1.8), 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < (attempt.success ? 20 : 7); i++) {
          const angle = i * 2.39996, spread = size * explosion * (0.5 + noise(i));
          ctx.fillStyle = `rgba(255,222,162,${alpha})`;
          ctx.fillRect(point.x + Math.cos(angle) * spread, point.y + Math.sin(angle) * spread + explosion * explosion * 30, 2, 2);
        }
      }
    });
  }

  private drawImpact(s: Cinematic, t: number): void {
    const point = this.camera.projectCinematicPoint(s.target.x, s.target.y);
    if (!point) return;
    const ctx = this.context!, globeRadius = Math.min(this.scene.scale.width, this.scene.scale.height) * 0.43;
    const nuclear = s.event.nuclear, r = globeRadius * (nuclear ? 0.34 : 0.11);
    const fade = 1 - smooth((t - (nuclear ? 4.6 : 1.5)) / (nuclear ? 3.0 : 2));
    if (t < (nuclear ? 0.7 : 0.25)) {
      ctx.fillStyle = `rgba(255,249,217,${(1 - t / (nuclear ? 0.7 : 0.25)) * (nuclear ? 0.78 : 0.23)})`;
      ctx.fillRect(0, 0, this.scene.scale.width, this.scene.scale.height);
    }
    const shock = clamp(t / (nuclear ? 2.2 : 1.4));
    ctx.strokeStyle = `rgba(255,231,182,${(1 - shock) * 0.85})`; ctx.lineWidth = (nuclear ? 5 : 3) * (1 - shock) + 0.5;
    ctx.beginPath(); ctx.ellipse(point.x, point.y, Math.max(1, r * (nuclear ? 2.2 : 2.7) * (1 - (1 - shock) ** 3)), Math.max(1, r * (nuclear ? 1.0 : 1.3) * (1 - (1 - shock) ** 3)), 0, 0, Math.PI * 2); ctx.stroke();
    // Ground dust is broad and low for both payloads; conventional dust never
    // grows a vertical stem or mushroom cap.
    for (let i = 0; i < (nuclear ? 38 : 22); i++) {
      const angle = i * 2.39996, ring = Math.sqrt((i + 1) / (nuclear ? 38 : 22));
      const spread = r * (0.2 + 1.3 * (1 - Math.exp(-t * 2.5)));
      const size = r * (0.65 + noise(i) * 0.45 + t * 0.03);
      this.puff(this.dust!, point.x + Math.cos(angle) * spread * ring,
        point.y + Math.sin(angle) * spread * ring * 0.43 - t * r * (nuclear ? 0.02 : 0.12), size, size * 0.65, fade * smooth(t / 0.18) * 0.82);
    }
    if (t < 1.8) this.glow(point.x, point.y - r * 0.2, r * (0.2 + 1.3 * (1 - Math.exp(-t * 5))), 1 - smooth((t - 0.35) / 1.45));
    if (nuclear) {
      const born = smooth((t - 0.13) / 1.1);
      const width = r * (0.17 + 1.35 * (1 - Math.exp(-t / 2.6)));
      const rise = Math.min(r * (0.18 + 2.65 * (1 - Math.exp(-t / 2)) + t * 0.025),
        Math.max(r * 0.6, point.y - width * 0.67 - 26));
      const hot = 1 - smooth((t - 0.6) / 2.1);
      for (let i = 0; i < 20; i++) {
        const level = i / 19, breadth = r * (0.30 + level * 0.25);
        const x = point.x + Math.sin(i * 2.4 + t) * breadth * 0.16, y = point.y - rise * level;
        this.puff(this.smokeShadow!, x + breadth * 0.06, y, breadth, rise / 6 + breadth, born * fade * 0.95);
        this.puff(i % 3 === 0 ? this.smokeLight! : this.smoke!, x - breadth * 0.12, y - breadth * 0.05,
          breadth * 0.78, rise / 6 + breadth * 0.8, born * fade * 0.8);
        this.puff(this.hotSmoke!, x - breadth * 0.08, y + breadth * 0.1, breadth * 0.8, rise / 6 + breadth * 0.8, born * fade * hot * 0.7);
      }
      for (let i = 0; i < 44; i++) {
        const angle = i * 2.39996, ring = Math.sqrt((i + 1) / 44);
        const size = width * (0.48 + noise(i + 30) * 0.4);
        const x = point.x + Math.cos(angle) * width * ring + Math.sin(angle + t * 0.7) * width * 0.035;
        const y = point.y - rise + Math.sin(angle) * width * 0.30 * ring + Math.cos(angle + t * 0.7) * width * 0.035;
        const brush = Math.sin(angle) > 0.15 ? this.smokeShadow! : noise(i + 40) > 0.55 ? this.smokeLight! : this.smoke!;
        this.puff(brush, x, y, size, size * 0.78, born * fade);
        this.puff(this.hotSmoke!, x - size * 0.05, y + size * 0.1, size * 0.9, size * 0.6, born * fade * hot * 0.8);
      }
      if (t > 1 && t < 4.5) {
        ctx.strokeStyle = `rgba(220,227,221,${0.22 * fade})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(point.x, point.y - rise * 0.63, width * 0.72, width * 0.12, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
    if (t < 2.4) for (let i = 0; i < (nuclear ? 36 : 30); i++) {
      const angle = i * 2.39996, speed = r * (0.3 + noise(i) * 0.8);
      const x = point.x + Math.cos(angle) * speed * t;
      const y = point.y + Math.sin(angle) * speed * t * 0.4 - r * t * 0.85 + r * t * t * 0.45;
      if (y > point.y + r * 0.6) continue;
      ctx.fillStyle = i % 3 === 0 ? `rgba(255,183,87,${1 - t / 2.4})` : `rgba(61,51,41,${1 - t / 2.4})`;
      ctx.fillRect(x, y, nuclear ? 3 : 2, nuclear ? 3 : 2);
    }
  }

  private finish(restore: boolean): void {
    const s = this.active;
    if (!s) return;
    s.terrain?.destroy();
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this);
    this.overlay?.remove(); this.overlay = undefined; this.canvas = undefined; this.context = undefined;
    this.caption = undefined; this.detail = undefined;
    window.removeEventListener('keydown', this.onKey, true);
    this.input.unblockWorld(INPUT_ID);
    this.camera.endCinematic(restore || s.event.intercepted || (!s.targetVisible && !s.observed) ? s.state : undefined);
    if (!restore && !s.event.intercepted && (s.targetVisible || s.observed)) this.camera.focusOn(s.target.x, s.target.y,
      Math.max(s.state.zoom, this.camera.cinematicZoomRange.start * 1.3, 0.65));
    this.active = undefined;
    // Visibility can change while a salvo is playing. Drain newly hidden clips
    // so an abandoned queue cannot retain presentation ownership or defer HUD UI.
    if (!this.disposed && this.enabled()) {
      while (!this.active && this.pending.length) this.play(this.pending.shift()!);
    } else this.pending.length = 0;
    // Only presentation UI resumes here; strategic outcomes were already committed.
    // Never reopen dialogs while the scene itself is shutting down.
    if (!this.disposed && !this.active && !this.pending.length) this.onFinished?.();
  }

  shutdown(): void {
    if (this.disposed) return;
    this.disposed = true; this.unsubscribe(); this.pending.length = 0; this.finish(true);
    this.smoke = undefined; this.dust = undefined; this.hotSmoke = undefined;
    this.smokeShadow = undefined; this.smokeLight = undefined;
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }
}
