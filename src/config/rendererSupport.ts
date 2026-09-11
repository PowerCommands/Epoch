type CapabilityContext = Pick<WebGLRenderingContext, 'getExtension'>;

/** Phaser 4 requires both extensions even when ordinary WebGL1 is available. */
export function supportsPhaserWebGL(context: CapabilityContext | null): boolean {
  return context !== null
    && !!context.getExtension('ANGLE_instanced_arrays')
    && !!context.getExtension('OES_vertex_array_object');
}

/**
 * Probe a disposable context before Phaser boots. AUTO checks WebGL presence,
 * but does not fall back when a required extension is missing during boot.
 * This context never belongs to a Phaser renderer; release it after probing.
 */
export function canUsePhaserWebGL(): boolean {
  let context: WebGLRenderingContext | null = null;
  try {
    const canvas = document.createElement('canvas');
    context = (canvas.getContext('webgl', { stencil: true })
      ?? canvas.getContext('experimental-webgl', { stencil: true })) as WebGLRenderingContext | null;
    return supportsPhaserWebGL(context) && !!context?.getContextAttributes()?.stencil;
  } catch {
    return false;
  } finally {
    // Context cleanup must not prevent the Canvas fallback after a probe error.
    try { context?.getExtension('WEBGL_lose_context')?.loseContext(); }
    catch { /* The browser may already have invalidated the probe context. */ }
  }
}
