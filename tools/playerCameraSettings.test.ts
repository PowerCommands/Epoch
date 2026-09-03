import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DEFAULT_CAMERA_ZOOM,
  MAX_DEFAULT_CAMERA_ZOOM,
  MIN_DEFAULT_CAMERA_ZOOM,
  getDefaultCameraZoom,
  normalizeDefaultCameraZoom,
  setDefaultCameraZoom,
} from '../src/systems/PlayerSettings.ts';

test('default camera zoom is constrained to the supported range', () => {
  assert.equal(normalizeDefaultCameraZoom(MIN_DEFAULT_CAMERA_ZOOM), 1);
  assert.equal(normalizeDefaultCameraZoom(1.65), 1.65);
  assert.equal(normalizeDefaultCameraZoom(MAX_DEFAULT_CAMERA_ZOOM), 2);
  assert.equal(normalizeDefaultCameraZoom(3), 2);
  assert.equal(normalizeDefaultCameraZoom(0.5), 1);
  assert.equal(normalizeDefaultCameraZoom(Number.NaN), DEFAULT_CAMERA_ZOOM);
});

test('default camera zoom persists as a cross-game player setting', () => {
  const values = new Map<string, string>();
  const previousStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });

  try {
    assert.equal(getDefaultCameraZoom(), DEFAULT_CAMERA_ZOOM);
    setDefaultCameraZoom(1.75);
    assert.equal(getDefaultCameraZoom(), 1.75);
  } finally {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: previousStorage,
    });
  }
});
