import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const scene = readFileSync(new URL('../src/scenes/GameScene.ts', import.meta.url), 'utf8');
const humanFlow = scene.slice(
  scene.indexOf('const showDemandCapitulationDialog'),
  scene.indexOf("} else if (action === 'capitulate')"),
);

test('Human demand flow does not gate the accepted runtime threshold behind lower eligibility', () => {
  assert.doesNotMatch(humanFlow, /canDemandCapitulation/);
  assert.match(humanFlow, /evaluateCapitulationDemand/);
  assert.match(humanFlow, /showDemandCapitulationDialog\(targetNationId\)/);
});

test('Human demand resolution uses the normal non-forced application path', () => {
  assert.match(humanFlow, /capitulationSystem\.applyCapitulation\([\s\S]*?humanNationIdForDiplomacy,[\s\S]*?targetNationId,[\s\S]*?reparations,[\s\S]*?demandExploitationRights,[\s\S]*?\)/);
  assert.doesNotMatch(humanFlow, /applyCapitulation\([\s\S]{0,300}\btrue\s*\)/);
});

test('success and every reachable rejection produce player feedback', () => {
  assert.match(humanFlow, /refuses to capitulate\. The war continues\./);
  assert.match(humanFlow, /cannot capitulate under the current conditions\. The war continues\./);
  assert.match(humanFlow, /is now a vassal state of/);
  assert.match(humanFlow, /showLeaderResponsePopup\(targetNationId, `\$\{aiLeaderName\} capitulates`/);
});

test('Human demand diagnostics include ids, pressure, runtime threshold, evaluation, apply, and failure', () => {
  for (const marker of ['demander=', 'target=', 'pressure=', 'threshold=', 'evaluated=', 'apply=', 'failure=']) {
    assert.match(humanFlow, new RegExp(marker));
  }
});
