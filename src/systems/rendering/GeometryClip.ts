import Phaser from 'phaser';

type Renderable = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.RenderSteps;
type CanvasRender = (
  renderer: Phaser.Renderer.Canvas.CanvasRenderer,
  target: Phaser.GameObjects.GameObject,
  camera: Phaser.Cameras.Scene2D.Camera,
  parentMatrix?: Phaser.GameObjects.Components.TransformMatrix,
) => void;
type CanvasRenderable = Phaser.GameObjects.GameObject & { renderCanvas: CanvasRender };
const bindings = new WeakMap<Phaser.GameObjects.GameObject, GeometryClip>();
const initialized = new WeakSet<Phaser.GameObjects.GameObject>();

/**
 * Shared, hard-edged geometry clipping. Phaser 4's public render-step hook
 * brackets an object with a Stencil and matching StencilReference. No offscreen
 * filter texture is allocated per object, and no raw GL state is changed.
 *
 * The source is independent world/screen-space geometry, as in our UI layouts.
 * It is rendered through the current camera, not the clipped object's parent
 * transform. Sources must be opaque, non-overlapping geometry (a hex, circle,
 * ellipse or rectangle). Canvas retains Phaser's native GeometryMask fallback.
 */
export class GeometryClip {
  private readonly targets = new Set<Phaser.GameObjects.GameObject>();
  private readonly stencil?: Phaser.GameObjects.Stencil;
  private readonly restore?: Phaser.GameObjects.StencilReference;
  private readonly canvasMask?: Phaser.Display.Masks.GeometryMask;
  private disposed = false;

  constructor(readonly graphics: Phaser.GameObjects.Graphics) {
    const scene = graphics.scene;
    if (scene.renderer.type === Phaser.WEBGL) {
      this.stencil = new Phaser.GameObjects.Stencil(scene, 0, 0, [], {
        stencilInvert: true,
        stencilCompositeCheck: false,
        stencilAlphaStrategy: 'keep',
      });
      // The source remains owned by its original renderer / UI component.
      this.stencil.setExclusive(false).add(graphics);
      this.restore = new Phaser.GameObjects.StencilReference(scene, this.stencil, {
        stencilInvert: true,
        stencilLayerMode: 'subtractLayer',
        stencilCompositeCheck: false,
        stencilAlphaStrategy: 'keep',
      });
    } else {
      this.canvasMask = graphics.createGeometryMask();
    }
    graphics.once(Phaser.GameObjects.Events.DESTROY, this.destroy, this);
  }

  attach(target: Phaser.GameObjects.GameObject): void {
    if (this.disposed) throw new Error('Cannot attach a destroyed GeometryClip');
    if (bindings.get(target) === this) return;
    clearGeometryClip(target);
    bindings.set(target, this);
    this.targets.add(target);
    if (!initialized.has(target)) {
      initialized.add(target);
      if (this.stencil) (target as Renderable).addRenderStep(renderClipped, 0);
      else {
        // CanvasRenderer masks top-level children, but ContainerCanvasRenderer
        // bypasses that path for Shapes/Graphics. Scope the native geometry
        // mask around this instance's draw, so both paths behave identically.
        // Do not modify Phaser prototypes or also assign GameObject.mask.
        const canvasTarget = target as CanvasRenderable;
        const original = canvasTarget.renderCanvas;
        canvasTarget.renderCanvas = function (renderer, object, camera, parentMatrix) {
          const clip = bindings.get(object);
          const draw = () => original.call(this, renderer, object, camera, parentMatrix);
          if (clip) clip.renderCanvas(renderer, object, camera, draw);
          else draw();
        };
      }
      target.once(Phaser.GameObjects.Events.DESTROY, () => clearGeometryClip(target));
    }
  }

  detach(target: Phaser.GameObjects.GameObject): void {
    this.targets.delete(target);
    bindings.delete(target);
  }

  renderCanvas(
    renderer: Phaser.Renderer.Canvas.CanvasRenderer,
    target: Phaser.GameObjects.GameObject,
    camera: Phaser.Cameras.Scene2D.Camera,
    draw: () => void,
  ): void {
    this.canvasMask!.preRenderCanvas(renderer, target, camera);
    try { draw(); }
    finally { this.canvasMask!.postRenderCanvas(renderer); }
  }

  render: Phaser.Types.GameObjects.RenderWebGLStep = (
    renderer, target, context, parentMatrix, step = 0, list, index,
  ) => {
    const graphics = this.graphics;
    const visible = graphics.visible;
    const cameraFilter = graphics.cameraFilter;
    // Hidden mask sources still participate in clipping; UI camera exclusions
    // apply to the target, not to its independently positioned clip geometry.
    graphics.setVisible(true);
    graphics.cameraFilter = 0;
    try {
      this.stencil!.renderWebGLStep(renderer, this.stencil!, context);
      (target as Renderable).renderWebGLStep(renderer, target, context, parentMatrix, step + 1, list, index);
    } finally {
      this.restore!.renderWebGLStep(renderer, this.restore!, context);
      // Flush the stencil restore without re-entering the camera context.
      // Pooled camera framebuffers auto-clear on use(); doing that here would
      // erase every previously drawn world layer whenever a sprite is clipped.
      renderer.renderNodes.finishBatch();
      graphics.setVisible(visible);
      graphics.cameraFilter = cameraFilter;
    }
  };

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.graphics.off(Phaser.GameObjects.Events.DESTROY, this.destroy, this);
    for (const target of this.targets) this.detach(target);
    this.restore?.destroy();
    this.stencil?.removeAll(false);
    this.stencil?.destroy();
    this.canvasMask?.destroy();
  }
}

const renderClipped: Phaser.Types.GameObjects.RenderWebGLStep = (
  renderer, target, context, parentMatrix, step = 0, list, index,
) => {
  const clip = bindings.get(target);
  if (clip) clip.render(renderer, target, context, parentMatrix, step, list, index);
  else (target as Renderable).renderWebGLStep(renderer, target, context, parentMatrix, step + 1, list, index);
};

export function setGeometryClip<T extends Phaser.GameObjects.GameObject>(target: T, clip: GeometryClip): T {
  clip.attach(target);
  return target;
}

export function clearGeometryClip<T extends Phaser.GameObjects.GameObject>(target: T, destroyClip = false): T {
  const clip = bindings.get(target);
  clip?.detach(target);
  if (destroyClip) clip?.destroy();
  return target;
}

/** Apply the registered clip to a custom Canvas replacement draw. */
export function renderCanvasWithGeometryClip(
  target: Phaser.GameObjects.GameObject,
  renderer: Phaser.Renderer.Canvas.CanvasRenderer,
  camera: Phaser.Cameras.Scene2D.Camera,
  draw: () => void,
): void {
  const clip = bindings.get(target);
  if (clip) clip.renderCanvas(renderer, target, camera, draw);
  else draw();
}
