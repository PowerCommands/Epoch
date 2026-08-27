import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolvePeaceTreatyCooldownTurns } from '../src/systems/DiplomacyManager.ts';
import type { ScenarioMeta } from '../src/types/scenario.ts';

const editor = readFileSync(new URL('../public/editor.html', import.meta.url), 'utf8');

test('editor exposes a Peace Treaty cooldown field defaulting to 10', () => {
  assert.match(editor, /Peace Treaty cooldown \(turns\)/);
  assert.match(editor, /id="sd-peace-treaty-cooldown"/);
  assert.match(editor, /const DEFAULT_PEACE_TREATY_COOLDOWN_TURNS = 10;/);
});

test('editor normalizes, loads and saves the Peace Treaty cooldown', () => {
  // Absent/invalid → default (loads correctly & defaults to 10).
  assert.match(editor, /meta\.peaceTreatyCooldownTurns !== 'number'[\s\S]*?meta\.peaceTreatyCooldownTurns = DEFAULT_PEACE_TREATY_COOLDOWN_TURNS/);
  // Populated into the input on open (loads from an existing scenario).
  assert.match(editor, /getElementById\('sd-peace-treaty-cooldown'\)\.value = String\(meta\.peaceTreatyCooldownTurns\)/);
  // Read back, validated and written to scenario.meta on save (saved/exported).
  assert.match(editor, /const peaceTreatyCooldownTurns = parseInt\(document\.getElementById\('sd-peace-treaty-cooldown'\)\.value, 10\)/);
  assert.match(editor, /scenario\.meta\.peaceTreatyCooldownTurns = peaceTreatyCooldownTurns/);
});

test('runtime resolver survives a scenario JSON round-trip and defaults when absent', () => {
  const authored: ScenarioMeta = { name: 'X', version: 1, peaceTreatyCooldownTurns: 25 };
  const roundTripped = JSON.parse(JSON.stringify(authored)) as ScenarioMeta;
  assert.equal(resolvePeaceTreatyCooldownTurns(roundTripped.peaceTreatyCooldownTurns), 25);

  const legacy = JSON.parse(JSON.stringify({ name: 'Legacy', version: 1 })) as ScenarioMeta;
  assert.equal(resolvePeaceTreatyCooldownTurns(legacy.peaceTreatyCooldownTurns), 10);
});
