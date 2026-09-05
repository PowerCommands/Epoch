import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolveMinPeaceNegotiationTurns } from '../src/systems/DiplomacyManager.ts';
import type { ScenarioMeta } from '../src/types/scenario.ts';

const editor = readFileSync(new URL('../public/editor.html', import.meta.url), 'utf8');

test('editor exposes a Minimum turns before peace negotiation field defaulting to 15', () => {
  assert.match(editor, /Minimum turns before peace negotiation/);
  assert.match(editor, /id="sd-min-peace-negotiation-turns"/);
  assert.match(editor, /const DEFAULT_MIN_PEACE_NEGOTIATION_TURNS = 15;/);
});

test('editor normalizes, loads and saves the minimum peace negotiation turns', () => {
  // Absent/invalid → default (loads correctly & defaults to 15).
  assert.match(editor, /meta\.minPeaceNegotiationTurns !== 'number'[\s\S]*?meta\.minPeaceNegotiationTurns = DEFAULT_MIN_PEACE_NEGOTIATION_TURNS/);
  // Populated into the input on open (loads from an existing scenario).
  assert.match(editor, /getElementById\('sd-min-peace-negotiation-turns'\)\.value = String\(meta\.minPeaceNegotiationTurns\)/);
  // Read back, validated and written to scenario.meta on save (saved/exported).
  assert.match(editor, /const minPeaceNegotiationTurns = parseInt\(document\.getElementById\('sd-min-peace-negotiation-turns'\)\.value, 10\)/);
  assert.match(editor, /scenario\.meta\.minPeaceNegotiationTurns = minPeaceNegotiationTurns/);
});

test('runtime resolver survives a scenario JSON round-trip and defaults when absent', () => {
  const authored: ScenarioMeta = { name: 'X', version: 1, minPeaceNegotiationTurns: 30 };
  const roundTripped = JSON.parse(JSON.stringify(authored)) as ScenarioMeta;
  assert.equal(resolveMinPeaceNegotiationTurns(roundTripped.minPeaceNegotiationTurns), 30);

  const legacy = JSON.parse(JSON.stringify({ name: 'Legacy', version: 1 })) as ScenarioMeta;
  assert.equal(resolveMinPeaceNegotiationTurns(legacy.minPeaceNegotiationTurns), 15);
});
