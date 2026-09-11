import assert from 'node:assert/strict';
import test from 'node:test';
import { ContextualTipSystem } from '../src/systems/ContextualTipSystem';
import {
  CONTEXTUAL_TIP_DEFS,
  CONTEXT_TIP_PRIORITY,
} from '../src/data/contextualTips';
import { buildGuideTipMap } from '../src/data/progressiveGuide';
import type { GuideTip } from '../src/data/progressiveGuide';
import { SaveLoadService } from '../src/systems/SaveLoadService';
import { SAVED_GAME_VERSION, type SavedContextualTips } from '../src/types/saveGame';
import { Nation } from '../src/entities/Nation';
import { NationManager } from '../src/systems/NationManager';
import { PolicySystem } from '../src/systems/PolicySystem';

const guideOptions = {
  enabledVictories: { domination: true, science: true, cultural: true, diplomatic: true },
  requiredAerospaceParts: 10,
};

function content(): Map<string, GuideTip> {
  return buildGuideTipMap(guideOptions);
}

interface Harness {
  system: ContextualTipSystem;
  shownTitles: string[];
  setEnabled: (value: boolean) => void;
  setAutoplay: (value: boolean) => void;
  setBusy: (value: boolean) => void;
  closePresentation: () => void;
}

function makeHarness(saved?: SavedContextualTips): Harness {
  let enabled = true;
  let autoplay = false;
  let busy = false;
  const shownTitles: string[] = [];
  const system = new ContextualTipSystem(
    content(),
    () => enabled,
    () => autoplay,
    () => busy,
    saved,
  );
  system.setPresenter((tip) => {
    busy = true; // A real wizard occupies the screen until closed.
    shownTitles.push(tip.title);
  });
  return {
    system,
    shownTitles,
    setEnabled: (v) => { enabled = v; },
    setAutoplay: (v) => { autoplay = v; },
    setBusy: (v) => { busy = v; },
    closePresentation: () => { busy = false; system.onPresentationClosed(); },
  };
}

test('every contextual tip id resolves to real guide content', () => {
  const map = content();
  for (const def of CONTEXTUAL_TIP_DEFS) {
    assert.ok(map.has(def.id), `missing guide content for contextual tip "${def.id}"`);
  }
  // Ids are unique.
  assert.equal(new Set(CONTEXTUAL_TIP_DEFS.map((d) => d.id)).size, CONTEXTUAL_TIP_DEFS.length);
});

test('a contextual tip is shown once and never repeats', () => {
  const h = makeHarness();
  h.system.fire('first-contact');
  h.closePresentation();
  h.system.fire('first-contact');
  h.closePresentation();
  assert.equal(h.shownTitles.length, 1);
  assert.match(h.shownTitles[0], /Meeting other nations/);
});

test('node-scoped triggers only fire for their node id', () => {
  const h = makeHarness();
  h.system.fire('tech-inspected', { nodeId: 'pottery' }); // no tip mapped
  assert.equal(h.shownTitles.length, 0);
  h.system.fire('tech-inspected', { nodeId: 'writing' });
  assert.equal(h.shownTitles.length, 1);
  assert.match(h.shownTitles[0], /Writing/);
});

test('several triggers in one action queue rather than overlap, highest priority first', () => {
  const h = makeHarness();
  h.setBusy(true); // Simulate a modal open during the burst of triggers.
  // NEW_SYSTEM then IMMEDIATE — the immediate one must present first.
  h.system.fire('first-contact');
  h.system.fire('city-captured');
  h.system.fire('first-contact'); // duplicate: must not double-queue
  assert.equal(h.shownTitles.length, 0, 'nothing shown while busy');

  h.setBusy(false);
  h.system.flush();
  assert.equal(h.shownTitles.length, 1);
  assert.match(h.shownTitles[0], /Conquest has a cost/); // IMMEDIATE wins

  h.closePresentation();
  assert.equal(h.shownTitles.length, 2);
  assert.match(h.shownTitles[1], /Meeting other nations/);

  h.closePresentation();
  assert.equal(h.shownTitles.length, 2, 'no third (duplicate) presentation');
});

test('disabled tips never interrupt; re-enabling resumes future delivery', () => {
  const h = makeHarness();
  h.setEnabled(false);
  h.system.fire('first-contact');
  assert.equal(h.shownTitles.length, 0);
  // Re-enable and fire a fresh trigger.
  h.setEnabled(true);
  h.system.fire('city-founded');
  assert.equal(h.shownTitles.length, 1);
  assert.match(h.shownTitles[0], /cities create your power/);
});

test('autoplay never enqueues or presents a contextual tip', () => {
  const h = makeHarness();
  h.setAutoplay(true);
  h.system.fire('first-contact');
  h.system.fire('city-captured');
  h.setAutoplay(false);
  h.system.flush();
  assert.equal(h.shownTitles.length, 0);
});

test('shown state persists and blocks a repeat after reload', () => {
  const first = makeHarness();
  first.system.fire('first-contact');
  first.closePresentation();
  const state = first.system.getState();
  assert.deepEqual(state.shown, ['meet-nations']);

  const reloaded = makeHarness(state);
  reloaded.system.fire('first-contact');
  reloaded.closePresentation();
  assert.equal(reloaded.shownTitles.length, 0, 'already shown before reload');
});

test('old saves without contextual-tip state initialize empty and safe', () => {
  const safe = makeHarness(undefined);
  safe.system.fire('first-contact');
  assert.equal(safe.shownTitles.length, 1);
  // Corrupt/partial data is tolerated.
  const corrupt = makeHarness({ shown: [null as unknown as string, 42 as unknown as string] });
  assert.deepEqual(corrupt.system.getState().shown, []);
});

test('contextualTips survives save validation and old saves omit it safely', () => {
  const withTips = SaveLoadService.validate(minimalSave({ shown: ['meet-nations', 'peace'] }));
  assert.ok(withTips.ok);
  if (withTips.ok) assert.deepEqual(withTips.state.contextualTips, { shown: ['meet-nations', 'peace'] });

  // A pre-feature save (field absent) still validates and defaults to undefined.
  const legacy = minimalSave(undefined);
  delete (legacy as { contextualTips?: unknown }).contextualTips;
  const parsedLegacy = SaveLoadService.validate(legacy);
  assert.ok(parsedLegacy.ok);
  if (parsedLegacy.ok) assert.equal(parsedLegacy.state.contextualTips, undefined);
});

test('the five refined triggers map to their intended tips and drop the old ones', () => {
  const byId = new Map(CONTEXTUAL_TIP_DEFS.map((d) => [d.id, d]));
  assert.equal(byId.get('peace')?.type, 'peace-negotiation-opened');
  assert.equal(byId.get('victory-conditions')?.type, 'victory-progress-opened');
  assert.equal(byId.get('advanced-planning')?.type, 'games-invitation');
  assert.equal(byId.get('culture-and-tech')?.type, 'policy-opportunity');
  assert.equal(byId.get('balanced-building')?.type, 'city-population-capacity');
  // victory-conditions and advanced-planning are no longer Technology/Culture node-scoped.
  assert.equal(byId.get('victory-conditions')?.nodeId, undefined);
  assert.equal(byId.get('advanced-planning')?.nodeId, undefined);
  // Retired trigger types are gone entirely.
  const types = new Set<string>(CONTEXTUAL_TIP_DEFS.map((d) => d.type));
  assert.ok(!types.has('culture-completed'));
  assert.ok(!types.has('human-war-as-defender'));
});

test('each refined trigger presents its correct tip exactly once', () => {
  const cases = [
    ['peace-negotiation-opened', /Peace can be strategically useful/],
    ['victory-progress-opened', /victory conditions/i],
    ['games-invitation', /Games/],
    ['policy-opportunity', /policies you unlock/i],
    ['city-population-capacity', /room to grow/i],
  ] as const;
  for (const [type, re] of cases) {
    const h = makeHarness();
    h.system.fire(type);
    assert.equal(h.shownTitles.length, 1, `${type} should show one tip`);
    assert.match(h.shownTitles[0], re);
    h.closePresentation();
    h.system.fire(type);
    assert.equal(h.shownTitles.length, 1, `${type} must not repeat`);
  }
});

test('inspecting Rocketry or the Games civic no longer triggers any tip', () => {
  const h = makeHarness();
  h.system.fire('tech-inspected', { nodeId: 'rocketry' });
  h.system.fire('culture-inspected', { nodeId: 'games_recreation' });
  assert.equal(h.shownTitles.length, 0);
});

test('hasEquippablePolicyOpportunity reflects a genuine equip chance, not mere node completion', () => {
  const policiesFor = (nodes: readonly string[]) => {
    const nations = new NationManager();
    nations.addNation(new Nation({
      id: 'human', name: 'Human', color: 0, isHuman: true, unlockedCultureNodeIds: [...nodes],
    }));
    return { policy: new PolicySystem(nations), nationId: 'human' };
  };

  // No culture progress: nothing to equip.
  assert.equal(policiesFor([]).policy.hasEquippablePolicyOpportunity('human'), false);

  // A policy unlocked but with no compatible slot yet is NOT an opportunity.
  assert.equal(policiesFor(['mercenaries']).policy.hasEquippablePolicyOpportunity('human'), false);

  // Policy + a compatible (military) slot → a real opportunity.
  const ready = policiesFor(['mercenaries', 'craftsmanship']);
  assert.equal(ready.policy.hasEquippablePolicyOpportunity('human'), true);

  // Filling the single (military) slot with an unlocked policy removes the only
  // free compatible slot, so no opportunity remains.
  const unlocked = ready.policy.getUnlockedPolicies('human');
  assert.ok(unlocked.length > 0);
  assert.ok(ready.policy.activatePolicy('human', unlocked[0].id, 'military'));
  assert.equal(ready.policy.hasEquippablePolicyOpportunity('human'), false);
});

test('priority constants are strictly ordered', () => {
  assert.ok(CONTEXT_TIP_PRIORITY.IMMEDIATE > CONTEXT_TIP_PRIORITY.NEW_SYSTEM);
  assert.ok(CONTEXT_TIP_PRIORITY.NEW_SYSTEM > CONTEXT_TIP_PRIORITY.WARNING);
  assert.ok(CONTEXT_TIP_PRIORITY.WARNING > CONTEXT_TIP_PRIORITY.ADVICE);
});

function minimalSave(contextualTips: SavedContextualTips | undefined): Record<string, unknown> {
  return {
    version: SAVED_GAME_VERSION,
    mapKey: 'test-map',
    humanNationId: 'human',
    activeNationIds: ['human'],
    turn: { currentRound: 1, currentTurnIndex: 0 },
    contextualTips,
    tiles: [],
    nations: [],
    cities: [],
    units: [],
    diplomacy: [],
    discovery: [],
    wonders: [],
  };
}
