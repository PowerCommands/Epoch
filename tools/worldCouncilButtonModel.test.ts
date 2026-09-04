import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildWorldCouncilButtonModel,
  WORLD_COUNCIL_HUD_BUTTON_LAYOUT,
  type WorldCouncilButtonContext,
} from '../src/ui/hud/WorldCouncilButtonModel';
import { GAMES_HUD_BUTTON_LAYOUT } from '../src/ui/hud/GamesOfNationsUiModel';

function activeCouncil(overrides: Partial<WorldCouncilButtonContext['council']> = {}): WorldCouncilButtonContext['council'] {
  return {
    status: 'active',
    constructionTurnsRemaining: 0,
    lastRegularMeetingTurn: 100,
    nextRegularMeetingTurn: 150,
    ...overrides,
  };
}

test('button sits directly below the Games of Nations button in the stack', () => {
  assert.equal(WORLD_COUNCIL_HUD_BUTTON_LAYOUT.left, GAMES_HUD_BUTTON_LAYOUT.left);
  assert.equal(WORLD_COUNCIL_HUD_BUTTON_LAYOUT.diameter, GAMES_HUD_BUTTON_LAYOUT.diameter);
  assert.ok(
    WORLD_COUNCIL_HUD_BUTTON_LAYOUT.top >= GAMES_HUD_BUTTON_LAYOUT.top + GAMES_HUD_BUTTON_LAYOUT.diameter,
    'World Council button must not overlap the Games of Nations button',
  );
});

test('progress is near 0 immediately after a regular meeting', () => {
  const model = buildWorldCouncilButtonModel({
    organizationName: 'World Council',
    foundationOffer: false,
    council: activeCouncil({ lastRegularMeetingTurn: 100, nextRegularMeetingTurn: 150 }),
    currentTurn: 100,
  });
  assert.equal(model.visible, true);
  assert.equal(model.active, true);
  assert.equal(model.progress, 0);
});

test('progress advances as turns pass and clamps at 1 before the meeting', () => {
  const halfway = buildWorldCouncilButtonModel({
    organizationName: 'World Council',
    foundationOffer: false,
    council: activeCouncil({ lastRegularMeetingTurn: 100, nextRegularMeetingTurn: 150 }),
    currentTurn: 125,
  });
  assert.ok(Math.abs(halfway.progress - 0.5) < 1e-9);

  const almostThere = buildWorldCouncilButtonModel({
    organizationName: 'World Council',
    foundationOffer: false,
    council: activeCouncil({ lastRegularMeetingTurn: 100, nextRegularMeetingTurn: 150 }),
    currentTurn: 149,
  });
  assert.ok(almostThere.progress > 0.95 && almostThere.progress <= 1);

  const overshoot = buildWorldCouncilButtonModel({
    organizationName: 'World Council',
    foundationOffer: false,
    council: activeCouncil({ lastRegularMeetingTurn: 100, nextRegularMeetingTurn: 150 }),
    currentTurn: 200,
  });
  assert.equal(overshoot.progress, 1);
});

test('tooltip reports the organization name and turns remaining', () => {
  const model = buildWorldCouncilButtonModel({
    organizationName: 'World Council',
    foundationOffer: false,
    council: activeCouncil({ lastRegularMeetingTurn: 100, nextRegularMeetingTurn: 150 }),
    currentTurn: 132,
  });
  assert.equal(model.tooltip, 'World Council\nNext regular meeting in 18 turns');
});

test('UN upgrade changes only the displayed name, not the button contract', () => {
  const un = buildWorldCouncilButtonModel({
    organizationName: 'United Nations',
    foundationOffer: false,
    council: activeCouncil({ lastRegularMeetingTurn: 100, nextRegularMeetingTurn: 150 }),
    currentTurn: 132,
  });
  assert.equal(un.organizationName, 'United Nations');
  assert.equal(un.tooltip, 'United Nations\nNext regular meeting in 18 turns');
  assert.equal(un.active, true);
});

test('singular turn is rendered without a plural s', () => {
  const model = buildWorldCouncilButtonModel({
    organizationName: 'World Council',
    foundationOffer: false,
    council: activeCouncil({ lastRegularMeetingTurn: 100, nextRegularMeetingTurn: 150 }),
    currentTurn: 149,
  });
  assert.equal(model.tooltip, 'World Council\nNext regular meeting in 1 turn');
});

test('construction status shows a build message and no meeting progress', () => {
  const model = buildWorldCouncilButtonModel({
    organizationName: 'World Council',
    foundationOffer: false,
    council: activeCouncil({ status: 'construction', constructionTurnsRemaining: 12 }),
    currentTurn: 110,
  });
  assert.equal(model.visible, true);
  assert.equal(model.active, false);
  assert.equal(model.progress, 0);
  assert.match(model.tooltip, /Under construction — 12 turns remaining/);
});

test('foundation offer is visible with a found-the-council tooltip', () => {
  const model = buildWorldCouncilButtonModel({
    organizationName: 'World Council',
    foundationOffer: true,
    council: null,
    currentTurn: 40,
  });
  assert.equal(model.visible, true);
  assert.equal(model.active, false);
  assert.equal(model.progress, 0);
  assert.match(model.tooltip, /Found World Council/);
});

test('no council and no offer yields an invisible button', () => {
  const model = buildWorldCouncilButtonModel({
    organizationName: 'World Council',
    foundationOffer: false,
    council: null,
    currentTurn: 40,
  });
  assert.equal(model.visible, false);
});

test('missing/inconsistent schedule falls back defensively without invalid numbers', () => {
  const model = buildWorldCouncilButtonModel({
    organizationName: 'World Council',
    foundationOffer: false,
    council: activeCouncil({ lastRegularMeetingTurn: 0, nextRegularMeetingTurn: 0 }),
    currentTurn: 25,
  });
  assert.equal(model.progress, 0);
  assert.match(model.tooltip, /scheduling/);
});
