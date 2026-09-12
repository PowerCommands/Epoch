import Phaser from 'phaser';
import { planetaryHalfExtents, planetaryParameters, planetaryStrength, planetaryZoomRange, unprojectPlanetary, type PlanetaryView } from './PlanetaryProjection';

const NODE = 'EpochPlanetary';
const registeredManagers = new WeakSet<object>();

// One viewport-sized pass over the complete world camera. No tile geometry,
// duplicate world, readback, or map-sized render texture is needed.
const fragment = `
#pragma phaserTemplate(shaderName)
precision highp float;
uniform sampler2D uMainSampler;
uniform vec2 viewport;
uniform vec2 sourceScale;
uniform vec4 mapRect;
uniform float strength;
uniform float radius;
varying vec2 outTexCoord;
#pragma phaserTemplate(fragmentHeader)
void main() {
    float bend = sqrt(strength);
    vec2 p = (outTexCoord * viewport - viewport * 0.5) * bend / radius;
    float r2 = dot(p, p);
    float r = sqrt(r2);
    vec3 space = vec3(0.008, 0.015, 0.033);
    float halo = exp(-max(r - 1.0, 0.0) * 48.0) * strength;
    vec3 outside = space + vec3(0.08, 0.24, 0.42) * halo * 0.65;
    if (r2 >= 1.0) { gl_FragColor = vec4(outside, 1.0); return; }
    float z = sqrt(1.0 - r2);
    vec2 angles = vec2(atan(p.x, z), asin(p.y));
    vec2 uv = (viewport * 0.5 + angles * sourceScale / bend) / viewport;
    vec4 terrain = boundedSampler(uMainSampler, uv);
    // Outside the finite flat map is a quiet ocean, never repeated geography.
    float inMap = step(mapRect.x, uv.x) * step(mapRect.y, uv.y)
                * step(uv.x, mapRect.z) * step(uv.y, mapRect.w);
    vec3 color = mix(vec3(0.035, 0.105, 0.16), terrain.rgb, terrain.a * inMap);
    float light = clamp(dot(vec3(p.x, -p.y, z), normalize(vec3(-0.35, 0.45, 1.0))), 0.0, 1.0);
    color *= mix(1.0, 0.48 + 0.55 * light, strength);
    float haze = pow(1.0 - z, 3.0) * strength;
    color = mix(color, vec3(0.22, 0.48, 0.68), haze * 0.58);
    float edge = smoothstep(0.0, 1.5 * bend / radius, 1.0 - r);
    gl_FragColor = vec4(mix(outside, color, edge), 1.0);
}
`;

class PlanetaryFilter extends Phaser.Filters.Controller {
  view!: PlanetaryView;
  constructor(camera: Phaser.Cameras.Scene2D.Camera) {
    super(camera, NODE);
    this.ignoreDestroy = true;
  }
}

class PlanetaryNode extends Phaser.Renderer.WebGL.RenderNodes.BaseFilterShader {
  constructor(manager: Phaser.Renderer.WebGL.RenderNodes.RenderNodeManager) {
    super(NODE, manager, undefined, fragment);
  }
  setupUniforms(controller: PlanetaryFilter): void {
    const v = controller.view;
    const params = planetaryParameters(v);
    const cam = controller.camera;
    const left = (0 - cam.worldView.x) * cam.zoom / v.width;
    const top = (0 - cam.worldView.y) * cam.zoom / v.height;
    this.programManager.setUniform('viewport', [v.width, v.height]);
    this.programManager.setUniform('sourceScale', [params.scaleX, params.scaleY]);
    this.programManager.setUniform('radius', params.radius);
    this.programManager.setUniform('strength', v.strength);
    this.programManager.setUniform('mapRect', [left, top, left + v.mapWidth * cam.zoom / v.width, top + v.mapHeight * cam.zoom / v.height]);
  }
}

/** Owns only presentation; logical world coordinates and saves stay flat. */
export class PlanetaryRenderer {
  private readonly filter: PlanetaryFilter;
  private attached = false;
  private readonly originalClampX: Phaser.Cameras.Scene2D.Camera['clampX'];
  private readonly originalClampY: Phaser.Cameras.Scene2D.Camera['clampY'];
  private readonly originalGetWorldPoint: Phaser.Cameras.Scene2D.Camera['getWorldPoint'];

  constructor(private readonly camera: Phaser.Cameras.Scene2D.Camera, renderer: Phaser.Renderer.WebGL.WebGLRenderer,
    private readonly mapWidth: number, private readonly mapHeight: number) {
    const manager = renderer.renderNodes;
    if (!registeredManagers.has(manager)) {
      manager.addNodeConstructor(NODE, PlanetaryNode);
      registeredManagers.add(manager);
    }
    this.originalClampX = camera.clampX;
    this.originalClampY = camera.clampY;
    // Clamp against the visible hemisphere, allowing east/west panning at
    // maximum altitude. The source remains a live, ordinary flat camera image.
    camera.clampX = x => {
      if (this.view.strength <= 0) return this.originalClampX.call(camera, x);
      const half = Math.min(mapWidth / 2, planetaryHalfExtents(this.view).x);
      return Phaser.Math.Clamp(x + camera.width / 2, half, mapWidth - half) - camera.width / 2;
    };
    camera.clampY = y => {
      if (this.view.strength <= 0) return this.originalClampY.call(camera, y);
      const half = Math.min(mapHeight / 2, planetaryHalfExtents(this.view).y);
      return Phaser.Math.Clamp(y + camera.height / 2, half, mapHeight - half) - camera.height / 2;
    };
    this.filter = new PlanetaryFilter(camera);
    this.originalGetWorldPoint = camera.getWorldPoint;
    // Phaser's own object hit tests also use getWorldPoint, so banners and
    // sprites receive the same inverse mapping as SelectionManager's hex picks.
    camera.getWorldPoint = <O extends Phaser.Math.Vector2>(x: number, y: number, output = new Phaser.Math.Vector2() as O): O => {
      const point = unprojectPlanetary(x - camera.x, y - camera.y, this.view);
      if (!point) { output.x = -1e9; output.y = -1e9; return output; }
      return this.originalGetWorldPoint.call(camera, point.x + camera.x, point.y + camera.y, output) as O;
    };
    this.update();
  }

  get range() { return planetaryZoomRange(this.camera.width, this.camera.height, this.mapWidth, this.mapHeight); }
  get view(): PlanetaryView {
    const range = this.range;
    return { width: this.camera.width, height: this.camera.height, mapWidth: this.mapWidth, mapHeight: this.mapHeight,
      zoom: this.camera.zoom, strength: planetaryStrength(this.camera.zoom, range.start, range.min) };
  }
  update(): void {
    this.filter.view = this.view;
    const enabled = this.filter.view.strength > 0;
    // Remove entirely at normal zoom to keep the ordinary camera render path
    // and avoid retaining a dormant effect in the camera's filter chain.
    if (enabled && !this.attached) this.camera.filters.internal.add(this.filter);
    if (!enabled && this.attached) this.camera.filters.internal.remove(this.filter);
    this.attached = enabled;
  }
  destroy(): void {
    this.camera.getWorldPoint = this.originalGetWorldPoint;
    this.camera.clampX = this.originalClampX;
    this.camera.clampY = this.originalClampY;
    this.camera.filters.internal.remove(this.filter);
    this.filter.destroy();
  }
}
