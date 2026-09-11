import assert from 'node:assert/strict';
import test from 'node:test';
import { supportsPhaserWebGL } from '../src/config/rendererSupport';

function contextWith(available: string[]): Pick<WebGLRenderingContext, 'getExtension'> {
  // The selector only checks presence; no extension methods are called.
  return { getExtension: ((name: string) => available.includes(name) ? {} : null) as WebGLRenderingContext['getExtension'] };
}

test('Phaser 4 capability selection rejects WebGL without either mandatory extension', () => {
  assert.equal(supportsPhaserWebGL(null), false);
  for (const available of [[], ['ANGLE_instanced_arrays'], ['OES_vertex_array_object']]) {
    assert.equal(supportsPhaserWebGL(contextWith(available)), false);
  }
  assert.equal(supportsPhaserWebGL(contextWith(['ANGLE_instanced_arrays', 'OES_vertex_array_object'])), true);
});
