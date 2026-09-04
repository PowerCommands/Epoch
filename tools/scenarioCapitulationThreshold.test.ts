import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  DEFAULT_CAPITULATION_ACCEPTANCE_THRESHOLD,
  resolveCapitulationAcceptanceThreshold,
} from '../src/systems/CapitulationSystem.ts';
import type { ScenarioMeta } from '../src/types/scenario.ts';

const editor = readFileSync(new URL('../public/editor.html', import.meta.url), 'utf8');
const gameScene = readFileSync(new URL('../src/scenes/GameScene.ts', import.meta.url), 'utf8');
const saveLoad = readFileSync(new URL('../src/systems/SaveLoadService.ts', import.meta.url), 'utf8');
const randomGenerator = readFileSync(new URL('../src/systems/procedural/RandomScenarioGenerator.ts', import.meta.url), 'utf8');

test('legacy and invalid values fall back to 0.70 while range endpoints are preserved', () => {
  assert.equal(DEFAULT_CAPITULATION_ACCEPTANCE_THRESHOLD, 0.7);
  assert.equal(resolveCapitulationAcceptanceThreshold(undefined), 0.7);
  assert.equal(resolveCapitulationAcceptanceThreshold(0), 0.7);
  assert.equal(resolveCapitulationAcceptanceThreshold(1.01), 0.7);
  assert.equal(resolveCapitulationAcceptanceThreshold(0.01), 0.01);
  assert.equal(resolveCapitulationAcceptanceThreshold(1), 1);
});

test('scenario metadata preserves authored threshold through JSON serialization', () => {
  for (const threshold of [0.01, 0.5, 1]) {
    const authored: ScenarioMeta = {
      name: 'Threshold Test',
      version: 1,
      capitulationAcceptanceThreshold: threshold,
    };
    const restored = JSON.parse(JSON.stringify(authored)) as ScenarioMeta;
    assert.equal(resolveCapitulationAcceptanceThreshold(restored.capitulationAcceptanceThreshold), threshold);
  }
});

test('Scenario Details exposes a live precise slider and serializes its value', () => {
  assert.match(editor, /id="sd-capitulation-acceptance-threshold" type="range" min="0\.01" max="1\.00" step="0\.01"/);
  assert.match(editor, /id="sd-capitulation-acceptance-threshold-value"[\s\S]*?>0\.70<\/output>/);
  assert.match(editor, /addEventListener\('input', updateCapitulationAcceptanceThresholdValue\)/);
  assert.match(editor, /meta\.capitulationAcceptanceThreshold = DEFAULT_CAPITULATION_ACCEPTANCE_THRESHOLD/);
  assert.match(editor, /sd-capitulation-acceptance-threshold'\)\.value = Number\(meta\.capitulationAcceptanceThreshold\)\.toFixed\(2\)/);
  assert.match(editor, /scenario\.meta\.capitulationAcceptanceThreshold = capitulationAcceptanceThreshold/);
  assert.match(editor, /function buildBlankScenario[\s\S]*?capitulationAcceptanceThreshold: DEFAULT_CAPITULATION_ACCEPTANCE_THRESHOLD/);
});

test('random scenarios default the setting and saves snapshot and restore the active value', () => {
  assert.match(randomGenerator, /capitulationAcceptanceThreshold: 0\.7/);
  assert.match(saveLoad, /capitulationAcceptanceThreshold: context\.capitulationSystem\?\.getAcceptanceThreshold\(\)/);
  assert.match(gameScene, /data\.savedState\?\.capitulationAcceptanceThreshold[\s\S]*?scenarioJson\.meta\?\.capitulationAcceptanceThreshold/);
});
