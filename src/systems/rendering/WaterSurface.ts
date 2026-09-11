import Phaser from 'phaser';
import { TileType, type MapData } from '../../types/map';
import type { TileMap } from '../TileMap';

// One texel per axial hex, rather than another world-sized render target.
// R = water, G = shallows, B = visible. Sampling never changes terrain data.
const FRAGMENT = `
precision highp float;
varying vec2 outTexCoord;
uniform sampler2D waterMap;
uniform vec2 mapSize;
uniform vec2 worldSize;
uniform float radius;
uniform float time;
uniform float detail;
vec4 tile(vec2 q) {
    if (any(lessThan(q, vec2(0.0))) || any(greaterThanEqual(q, mapSize))) return vec4(0.0);
    vec2 uv = (q + 0.5) / mapSize;
    return texture2D(waterMap, vec2(uv.x, 1.0 - uv.y));
}
vec2 center(vec2 q) {
    return radius * vec2(1.732050808 * (q.x + q.y * 0.5) + 1.0, 1.5 * q.y + 1.0);
}
float shore(vec2 q, vec2 offset, vec2 p) {
    vec4 next = tile(q + offset);
    if (next.a < 0.5 || next.r > 0.5) return 10.0;
    // Distance to the actual land hex, including its corners. Infinite edge
    // lines would cut off the wash at water-tile boundaries near headlands.
    vec2 h = abs((p - (center(q + offset) - center(q)) / radius).yx);
    vec2 normal = vec2(-0.866025404, 0.5);
    h -= 2.0 * min(dot(normal, h), 0.0) * normal;
    h -= vec2(clamp(h.x, -0.5, 0.5), 0.866025404);
    return length(h);
}
void main() {
    vec2 world = vec2(outTexCoord.x, 1.0 - outTexCoord.y) * worldSize;
    vec2 local = world / radius - 1.0;
    vec2 axial = vec2(local.x / 1.732050808 - local.y / 3.0, local.y * 2.0 / 3.0);
    vec3 cube = vec3(axial, -axial.x - axial.y);
    vec3 rounded = floor(cube + 0.5);
    vec3 diff = abs(rounded - cube);
    if (diff.x > diff.y && diff.x > diff.z) rounded.x = -rounded.y - rounded.z;
    else if (diff.y > diff.z) rounded.y = -rounded.x - rounded.z;
    vec2 q = rounded.xy;
    vec4 water = tile(q);
    if (water.r < 0.5 || water.b < 0.5 || detail <= 0.0) discard;
    vec2 p = (world - center(q)) / radius;
    float edge = min(shore(q, vec2(1,0), p), shore(q, vec2(0,1), p));
    edge = min(edge, shore(q, vec2(-1,1), p));
    edge = min(edge, shore(q, vec2(-1,0), p));
    edge = min(edge, shore(q, vec2(0,-1), p));
    edge = min(edge, shore(q, vec2(1,-1), p));
    // All phases and advection live in world space, including across the
    // Coast/Ocean boundary. Tile type affects contrast, never wave velocity.
    vec2 s = world / radius;
    vec2 drift = s - vec2(0.16, -0.09) * time;
    vec2 bend = vec2(
        sin(dot(drift, vec2(0.31, 0.22)) - time * 0.13),
        sin(dot(drift, vec2(-0.19, 0.27)) + time * 0.11));
    vec2 surface = drift + bend * 0.8;
    // Broad travelling swells span several hexes; a crossing swell bends
    // their crests and produces a slow rocking motion rather than stripes.
    float primary = dot(surface, vec2(0.65, 1.05)) - time * 0.38;
    float crossing = dot(surface, vec2(-0.83, 0.42)) - time * 0.29;
    float height = sin(primary) * 0.7 + sin(crossing) * 0.3;
    float slope = cos(primary) * 0.7 + cos(crossing) * 0.3;
    vec2 refracted = surface + vec2(slope, height) * 0.32;
    float ripples = sin(dot(refracted, vec2(2.4, 9.0)) - time * 0.85
                        + sin(dot(refracted, vec2(1.7, -0.6))));
    float broken = smoothstep(-0.3, 0.65,
        sin(dot(refracted, vec2(1.9, -0.8)) + time * 0.16));
    float glint = smoothstep(0.78, 1.0, ripples) * broken;
    float crest = smoothstep(0.48, 0.94, slope) * (0.65 + height * 0.25);
    float trough = smoothstep(0.05, 0.85, -slope);

    // A shared tide advances and recedes along the entire shoreline. The
    // returning sheet is wider and dimmer than the arriving crest.
    float tide = time * 0.78 + sin(dot(s, vec2(0.12, 0.09))) * 0.28;
    float reach = 0.09 + 0.43 * (0.5 + 0.5 * cos(tide));
    float incoming = 0.5 + 0.5 * sin(tide);
    float wash = (1.0 - smoothstep(0.018, 0.085, abs(edge - reach)))
                 * (0.3 + 0.7 * incoming);
    float retreat = (1.0 - smoothstep(0.03, 0.21, abs(edge - reach)))
                    * (1.0 - incoming) * 0.35;
    float shoreFade = smoothstep(0.0, 0.05, edge);
    wash *= shoreFade;
    retreat *= shoreFade;

    // Both shaded faces and moving highlights make the surface read as
    // volume. The underlying terrain palette and hex artwork stay in place.
    float light = crest * mix(0.16, 0.19, water.g) + glint * 0.075;
    float dark = trough * 0.14;
    float foam = wash * 0.25 + retreat * 0.15;
    float alpha = (light + dark + foam) * detail;
    vec3 color = (vec3(0.38, 0.65, 0.70) * light
                + vec3(0.035, 0.16, 0.23) * dark
                + vec3(0.73, 0.83, 0.77) * foam)
                / max(light + dark + foam, 0.0001);
    // Phaser's normal blending expects premultiplied alpha.
    gl_FragColor = vec4(color * alpha, alpha);
}`;

/** Phaser 4 ShaderQuad: one draw, no offscreen filter pass, no per-frame tile work.
 * Uses Epoch's pointy-top axial layout, matching HexGridLayout's cube rounding.
 * The ordinary fog layer remains above this surface; the visibility channel also
 * suppresses animation in explored but currently unseen water.
 */
export class WaterSurface {
  private readonly texture: Phaser.Textures.CanvasTexture;
  readonly shader: Phaser.GameObjects.Shader;
  private elapsed = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tileMap: TileMap,
    private readonly data: MapData,
    private readonly canSee: (x: number, y: number) => boolean,
  ) {
    this.texture = scene.textures.createCanvas(`water-surface-${Phaser.Utils.String.UUID()}`, data.width, data.height)!;
    this.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.refresh();
    const { width, height } = tileMap.getWorldBounds();
    this.shader = scene.add.shader({
      name: 'EpochWaterSurface',
      fragmentSource: FRAGMENT,
      setupUniforms: (setUniform: (name: string, value: number | number[]) => void, context: Phaser.Renderer.WebGL.DrawingContext) => {
        setUniform('waterMap', 0);
        setUniform('mapSize', [data.width, data.height]);
        setUniform('worldSize', [width, height]);
        setUniform('radius', tileMap.getTileSize() / 2);
        setUniform('time', this.elapsed);
        setUniform('detail', Phaser.Math.Clamp(((context.camera?.zoom ?? 1) - 0.35) / 0.75, 0, 1));
      },
    }, width / 2, height / 2, width, height, [this.texture.key]).setDepth(1).setName('ambient-water-gpu');
    // Phaser 4.2.1 Shader.preDestroy drops its node reference but does not
    // release the node's private quad buffer/VAOs. Release these per-instance
    // wrappers while retaining Phaser's shared cached program and index buffer.
    const node = this.shader.renderNode;
    this.shader.once(Phaser.GameObjects.Events.DESTROY, () => {
      for (const suite of Object.values(node.programManager.programs)) {
        Phaser.Utils.Array.Remove(node.renderer.glVAOWrappers, suite.vao);
        suite.vao.destroy();
      }
      node.renderer.deleteBuffer(node.vertexBufferLayout.buffer);
    });
    scene.events.on('terrain-rebuilt', this.refresh, this);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
  }

  private update(_time: number, delta: number): void {
    this.elapsed += Math.min(delta, 100) / 1000;
  }

  /** Called only when terrain or visibility changes, never by the frame loop. */
  refresh(): void {
    const pixels = this.texture.context.createImageData(this.data.width, this.data.height);
    for (const row of this.data.tiles) for (const tile of row) {
      const i = (tile.y * this.data.width + tile.x) * 4;
      pixels.data[i] = tile.type === TileType.Ocean || tile.type === TileType.Coast ? 255 : 0;
      pixels.data[i + 1] = tile.type === TileType.Coast ? 255 : 0;
      pixels.data[i + 2] = this.canSee(tile.x, tile.y) ? 255 : 0;
      pixels.data[i + 3] = 255;
    }
    this.texture.context.putImageData(pixels, 0, 0);
    this.texture.refresh();
  }

  destroy(): void {
    this.scene.events.off('terrain-rebuilt', this.refresh, this);
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this);
    this.shader.destroy();
    this.texture.destroy();
  }
}
