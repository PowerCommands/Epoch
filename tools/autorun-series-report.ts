/**
 * Pure report-building helpers for the autorun series wrapper.
 *
 * Everything in this module is deterministic and side-effect free (aside from the
 * file readers at the bottom). It turns the structured artifacts written by
 * scripts/autorun.ts — metadata, timeline calibration, and the game save — into a
 * consolidated series report. It contains no gameplay logic; it only summarizes
 * evidence the engine already produced.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Shared shapes (a minimal, defensive view of the autorun/save artifacts)
// ---------------------------------------------------------------------------

export interface NationStateSummary {
  id: string;
  name: string;
  isHuman: boolean;
  era: string;
  technologyCount: number;
  cultureNodeCount: number;
  currentResearch: string | null;
  currentCulture: string | null;
  cityCount: number;
  population: number;
}

export interface StateSummary {
  currentRound: number;
  nationCount: number;
  cityCount: number;
  unitCount: number;
  worldYear?: number;
  worldYearLabel?: string;
  scenario?: string;
  nations?: NationStateSummary[];
}

export interface AutorunMetadata {
  scenario: string;
  requestedTurns: number;
  completedTurns: number;
  timestamp: string;
  success: boolean;
  durationMs: number;
  startingTurn?: number;
  startingYear?: number;
  finalTurn?: number;
  finalYear?: number;
  victoryConditions?: Record<string, { enabled: boolean }>;
  victoryDetected: boolean;
  victoryNationId?: string;
  victoryNationName?: string;
  victoryType?: string;
  victoryRound?: number;
  error?: string;
  stateSummary?: StateSummary;
}

/** Structured, engine-authored history event (save.historicalTimeline). */
export interface TimelineEvent {
  id: number;
  type: string;
  round: number;
  dateLabel?: string;
  icon?: string;
  text: string;
  eventNationIds?: string[];
}

export interface SaveNation {
  id: string;
  isHuman?: boolean;
  aiStrategyId?: string;
  aiNationalAgendaId?: string;
  researchedTechIds?: string[];
  unlockedCultureNodeIds?: string[];
  gold?: number;
  culture?: number;
  influence?: number;
}

export interface SaveDiplomacy {
  nationA: string;
  nationB: string;
  state: string;
  lastWarDeclarationTurn?: number;
}

export interface SaveWonder {
  wonderId: string;
  ownerId: string;
  completedTurn?: number;
  broken?: boolean;
}

export interface ResolutionProposal {
  resolutionId: string;
  proposerNationId?: string;
  targetNationId?: string;
  secondaryTargetNationId?: string;
  totalGoldDonated?: number;
  donations?: Array<{ nationId: string; gold: number }>;
  passed?: boolean;
  resolved?: boolean;
  outcomeText?: string;
}

export interface CouncilMeeting {
  id: number;
  kind: string;
  turn: number;
  organization?: string;
  proposals?: ResolutionProposal[];
}

export interface WorldCouncil {
  organizationKind?: string;
  status?: string;
  foundingTurn?: number;
  foundingNationId?: string;
  memberNationIds?: string[];
  meetings?: CouncilMeeting[];
  enactedResolutions?: Array<{ resolutionId: string; turn: number; active?: boolean }>;
}

export interface GameSave {
  worldYear?: number;
  turn?: { currentRound?: number };
  activeNationIds?: string[];
  nations?: SaveNation[];
  cities?: Array<{ id: string; ownerId: string; name?: string }>;
  diplomacy?: SaveDiplomacy[];
  alliances?: unknown[];
  wonders?: SaveWonder[];
  worldCouncil?: WorldCouncil | null;
  tradeDeals?: unknown[];
  tradeConnections?: unknown[];
  historicalTimeline?: TimelineEvent[];
}

export interface BlockResult {
  blockNumber: number;
  dir: string;
  /** Present when the autorun invocation produced a metadata file. */
  metadata: AutorunMetadata | null;
  /** Present when the block produced a readable save. */
  save: GameSave | null;
  exitCode: number | null;
  error?: string;
  checkpointFile?: string;
}

// ---------------------------------------------------------------------------
// Timeline event categorisation
// ---------------------------------------------------------------------------

/**
 * Timeline event types (save.historicalTimeline) that matter for a strategic
 * narrative. High-volume, low-signal chatter (routine scouting, ordinary unit
 * movement) never reaches the timeline, so this list is already curated by the
 * engine; we only decide how to bucket and prioritise what is present.
 */
export const IMPORTANT_TIMELINE_TYPES: Record<string, { label: string; priority: number }> = {
  warDeclared: { label: 'War declared', priority: 1 },
  joinedWar: { label: 'Joined war', priority: 2 },
  peace: { label: 'Peace agreement', priority: 1 },
  cityCaptured: { label: 'City captured', priority: 2 },
  cityFounded: { label: 'City founded', priority: 4 },
  wonderBuilt: { label: 'World Wonder built', priority: 3 },
  worldCouncilFounded: { label: 'World Council / UN founded', priority: 1 },
  worldCouncilActive: { label: 'World Council / UN active', priority: 2 },
  worldCouncilMeeting: { label: 'Council meeting', priority: 3 },
  firstContact: { label: 'First contact', priority: 5 },
  embassyEstablished: { label: 'Embassy established', priority: 5 },
  tradeRelations: { label: 'Trade relations', priority: 5 },
  tradeRouteCompleted: { label: 'Trade route completed', priority: 5 },
};

export interface CategorizedEvent {
  round: number;
  dateLabel: string;
  type: string;
  label: string;
  text: string;
  priority: number;
}

/**
 * Bucket a timeline (already cumulative in each save) into important events plus
 * per-type counts. Deterministic: stable order by round then id-equivalent input
 * order. Unknown types are ignored for the highlight list but still counted so the
 * report can flag anything unexpected.
 */
export function categorizeTimeline(timeline: readonly TimelineEvent[]): {
  events: CategorizedEvent[];
  counts: Record<string, number>;
} {
  const counts: Record<string, number> = {};
  const events: CategorizedEvent[] = [];
  for (const entry of timeline) {
    counts[entry.type] = (counts[entry.type] ?? 0) + 1;
    const meta = IMPORTANT_TIMELINE_TYPES[entry.type];
    if (!meta) continue;
    events.push({
      round: entry.round,
      dateLabel: entry.dateLabel ?? '',
      type: entry.type,
      label: meta.label,
      text: entry.text,
      priority: meta.priority,
    });
  }
  events.sort((a, b) => (a.round - b.round) || (a.priority - b.priority));
  return { events, counts };
}

/** Turn `defense_support` into `Defense Support`. Robust to unknown ids. */
export function prettifyResolutionId(id: string): string {
  return id
    .replace(/_resolution$/, '')
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ---------------------------------------------------------------------------
// World Council / UN structured summary (from the save, not the log)
// ---------------------------------------------------------------------------

export interface CouncilSummary {
  founded: boolean;
  organizationKind: string | null;
  status: string | null;
  foundingTurn: number | null;
  memberCount: number;
  meetingCount: number;
  resolutionsProposed: number;
  resolutionsPassed: number;
  resolutionsRejected: number;
  resolutionsByType: Record<string, number>;
  /** Gold donated to Defense Support resolutions, keyed by nation id. */
  defenseSupportGoldByNation: Record<string, number>;
  /** Total gold donated across every resolution, keyed by nation id. */
  totalDonatedGoldByNation: Record<string, number>;
}

export function summarizeCouncil(save: GameSave | null): CouncilSummary {
  const council = save?.worldCouncil ?? null;
  const summary: CouncilSummary = {
    founded: Boolean(council && council.foundingTurn != null),
    organizationKind: council?.organizationKind ?? null,
    status: council?.status ?? null,
    foundingTurn: council?.foundingTurn ?? null,
    memberCount: council?.memberNationIds?.length ?? 0,
    meetingCount: council?.meetings?.length ?? 0,
    resolutionsProposed: 0,
    resolutionsPassed: 0,
    resolutionsRejected: 0,
    resolutionsByType: {},
    defenseSupportGoldByNation: {},
    totalDonatedGoldByNation: {},
  };
  for (const meeting of council?.meetings ?? []) {
    for (const proposal of meeting.proposals ?? []) {
      summary.resolutionsProposed += 1;
      summary.resolutionsByType[proposal.resolutionId] =
        (summary.resolutionsByType[proposal.resolutionId] ?? 0) + 1;
      if (proposal.resolved) {
        if (proposal.passed) summary.resolutionsPassed += 1;
        else summary.resolutionsRejected += 1;
      }
      for (const donation of proposal.donations ?? []) {
        if (!donation.gold) continue;
        summary.totalDonatedGoldByNation[donation.nationId] =
          (summary.totalDonatedGoldByNation[donation.nationId] ?? 0) + donation.gold;
        if (proposal.resolutionId === 'defense_support') {
          summary.defenseSupportGoldByNation[donation.nationId] =
            (summary.defenseSupportGoldByNation[donation.nationId] ?? 0) + donation.gold;
        }
      }
    }
  }
  return summary;
}

// ---------------------------------------------------------------------------
// Derived per-nation / world state
// ---------------------------------------------------------------------------

/** Nation ids that are active but hold no cities in the final save (eliminated). */
export function computeEliminatedNations(save: GameSave | null): string[] {
  if (!save?.activeNationIds) return [];
  const cityOwners = new Set((save.cities ?? []).map((city) => city.ownerId));
  return save.activeNationIds.filter((id) => !cityOwners.has(id));
}

/**
 * Nations that appeared in the starting roster but are gone from the final roster
 * — i.e. conquered/collapsed out of the game entirely (removed from
 * `activeNationIds`), which the final-save-only `computeEliminatedNations` cannot
 * detect on its own. Returns ids in first-roster order.
 */
export function computeRosterAttrition(
  firstNations: readonly NationStateSummary[],
  finalNations: readonly NationStateSummary[],
): string[] {
  const survivors = new Set(finalNations.map((nation) => nation.id));
  return firstNations.filter((nation) => !survivors.has(nation.id)).map((nation) => nation.id);
}

export function currentWarPairs(save: GameSave | null): SaveDiplomacy[] {
  return (save?.diplomacy ?? []).filter((rel) => rel.state === 'WAR');
}

export function wondersCompleted(save: GameSave | null): SaveWonder[] {
  return (save?.wonders ?? []).filter((wonder) => wonder.completedTurn != null);
}

// ---------------------------------------------------------------------------
// Checkpoint naming
// ---------------------------------------------------------------------------

/**
 * Name a checkpoint save by the actual final turn recorded in metadata, never by
 * an assumed 100-turn boundary. Falls back to the block number when the turn is
 * unknown so a checkpoint is still preserved.
 */
export function checkpointFileName(finalTurn: number | undefined, blockNumber: number): string {
  if (typeof finalTurn === 'number' && Number.isFinite(finalTurn)) {
    return `checkpoint-turn-${finalTurn}.json`;
  }
  return `checkpoint-block-${String(blockNumber).padStart(3, '0')}-unknown-turn.json`;
}

// ---------------------------------------------------------------------------
// Diagnostics (explicit thresholds only — factual, no interpretation)
// ---------------------------------------------------------------------------

const RUNAWAY_TECH_GAP = 6;
const RUNAWAY_CULTURE_GAP = 6;

export function buildDiagnostics(
  eliminatedNames: readonly string[],
  finalNations: NationStateSummary[],
  council: CouncilSummary,
  timelineCounts: Record<string, number>,
): string[] {
  const notes: string[] = [];
  if (finalNations.length >= 2) {
    const byTech = [...finalNations].sort((a, b) => b.technologyCount - a.technologyCount);
    const techGap = byTech[0].technologyCount - byTech[1].technologyCount;
    if (techGap >= RUNAWAY_TECH_GAP) {
      notes.push(
        `Technology runaway: ${byTech[0].name} leads by ${techGap} techs (${byTech[0].technologyCount} vs ${byTech[1].technologyCount}).`,
      );
    }
    const byCulture = [...finalNations].sort((a, b) => b.cultureNodeCount - a.cultureNodeCount);
    const cultureGap = byCulture[0].cultureNodeCount - byCulture[1].cultureNodeCount;
    if (cultureGap >= RUNAWAY_CULTURE_GAP) {
      notes.push(
        `Culture runaway: ${byCulture[0].name} leads by ${cultureGap} nodes (${byCulture[0].cultureNodeCount} vs ${byCulture[1].cultureNodeCount}).`,
      );
    }
  }

  if (eliminatedNames.length > 0) {
    notes.push(`Nations conquered/removed from the game: ${eliminatedNames.join(', ')}.`);
  }

  if ((timelineCounts.warDeclared ?? 0) === 0) {
    notes.push('No wars were declared during the entire run.');
  }
  if (!council.founded) {
    notes.push('No World Council / United Nations was ever founded.');
  } else if (council.resolutionsProposed === 0) {
    notes.push('A council existed but no resolutions were ever proposed.');
  }

  // Repeated identical resolution type: one type dominating the docket.
  const resolutionTypes = Object.entries(council.resolutionsByType).sort((a, b) => b[1] - a[1]);
  if (resolutionTypes.length > 0 && council.resolutionsProposed >= 4) {
    const [topId, topCount] = resolutionTypes[0];
    if (topCount / council.resolutionsProposed >= 0.75) {
      notes.push(
        `Resolution monoculture: ${Math.round((topCount / council.resolutionsProposed) * 100)}% of proposals were "${prettifyResolutionId(topId)}" (${topCount}/${council.resolutionsProposed}).`,
      );
    }
  }

  if ((timelineCounts.cityCaptured ?? 0) === 0 && (timelineCounts.warDeclared ?? 0) > 0) {
    notes.push('Wars were declared but no city ever changed hands.');
  }

  return notes;
}

// ---------------------------------------------------------------------------
// Consolidated series report model + renderers
// ---------------------------------------------------------------------------

export interface SeriesReportModel {
  generatedAt: string;
  testSummary: {
    scenario: string;
    configuredMaxTurns: number;
    blockSize: number;
    blocksExecuted: number;
    actualTurnsCompleted: number | null;
    startingTurn: number | null;
    finalTurn: number | null;
    startingDate: string | null;
    finalDate: string | null;
    totalDurationMs: number;
    endReason: 'victory' | 'max-turns' | 'failure' | 'incomplete';
    winner: string | null;
    victoryType: string | null;
    victoryTurn: number | null;
    enabledVictoryConditions: string[];
    failureError: string | null;
  };
  blocks: Array<{
    blockNumber: number;
    startingTurn: number | null;
    completedTurns: number | null;
    finalTurn: number | null;
    finalDate: string | null;
    durationMs: number | null;
    nationCount: number | null;
    cityCount: number | null;
    unitCount: number | null;
    victoryDetected: boolean;
    winner: string | null;
    victoryType: string | null;
    checkpointFile: string | null;
    error: string | null;
  }>;
  nationProgression: Array<{
    checkpointTurn: number | null;
    blockNumber: number;
    nations: Array<{
      id: string;
      name: string;
      isHuman: boolean;
      era: string;
      technologyCount: number;
      cultureNodeCount: number;
      cityCount: number;
      population: number;
      currentResearch: string | null;
      currentCulture: string | null;
      influence: number | null;
      gold: number | null;
    }>;
  }>;
  importantEvents: CategorizedEvent[];
  eventCounts: {
    wars: number | null;
    peaceAgreements: number | null;
    cityFoundations: number | null;
    cityCaptures: number | null;
    eliminatedNations: number | null;
    councilMeetings: number | null;
    resolutionsProposed: number | null;
    resolutionsPassed: number | null;
    resolutionsRejected: number | null;
    wondersCompleted: number | null;
    tradeRoutes: number | null;
    influenceSpentPerNation: 'unavailable';
    defenseSupportGoldPerNation: Record<string, number>;
    totalDonatedGoldPerNation: Record<string, number>;
    resolutionsByType: Record<string, number>;
  };
  finalWorldState: {
    finalTurn: number | null;
    finalDate: string | null;
    nations: Array<{
      id: string;
      name: string;
      isHuman: boolean;
      era: string;
      technologyCount: number;
      cultureNodeCount: number;
      cityCount: number;
      population: number;
      currentResearch: string | null;
      currentCulture: string | null;
      influence: number | null;
      gold: number | null;
      culture: number | null;
      aiStrategyId: string | null;
      aiNationalAgendaId: string | null;
      eliminated: boolean;
    }>;
    wars: Array<{ a: string; b: string }>;
    council: CouncilSummary;
    wondersCompleted: number;
    tradeConnections: number;
    tradeDeals: number;
  };
  diagnostics: string[];
}

function nameLookup(nations: readonly NationStateSummary[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const nation of nations) map.set(nation.id, nation.name);
  return map;
}

export interface SeriesRunContext {
  scenario: string;
  maxTurns: number;
  blockSize: number;
  enabledVictoryConditions: string[];
  blocks: BlockResult[];
  totalDurationMs: number;
  endReason: 'victory' | 'max-turns' | 'failure' | 'incomplete';
  generatedAt: string;
}

export function buildSeriesReportModel(ctx: SeriesRunContext): SeriesReportModel {
  const successfulBlocks = ctx.blocks.filter((b) => b.metadata);
  const firstBlock = ctx.blocks[0] ?? null;
  const lastWithSave = [...ctx.blocks].reverse().find((b) => b.save) ?? null;
  const lastWithMeta = [...ctx.blocks].reverse().find((b) => b.metadata) ?? null;
  const finalSave = lastWithSave?.save ?? null;
  const finalMeta = lastWithMeta?.metadata ?? null;

  const finalNations = finalMeta?.stateSummary?.nations ?? [];
  const names = nameLookup(finalNations);

  const timeline = finalSave?.historicalTimeline ?? [];
  const { events, counts } = categorizeTimeline(timeline);
  const council = summarizeCouncil(finalSave);
  // A nation counts as eliminated if it dropped out of the roster between the
  // first and final block (conquered out of activeNationIds) or, in the rare edge
  // case, is still active at the end but holds no cities.
  const firstRosterNations = firstBlock?.metadata?.stateSummary?.nations ?? [];
  const eliminated = new Set<string>([
    ...computeRosterAttrition(firstRosterNations, finalNations),
    ...computeEliminatedNations(finalSave),
  ]);
  // Names come from the starting roster (conquered nations are gone from the final one).
  const rosterNames = new Map<string, string>();
  for (const nation of [...firstRosterNations, ...finalNations]) rosterNames.set(nation.id, nation.name);
  const eliminatedNames = [...eliminated].map((id) => rosterNames.get(id) ?? id);

  // Victory detection: first block whose metadata reports a victory.
  const victoryBlock = ctx.blocks.find((b) => b.metadata?.victoryDetected);
  const victoryMeta = victoryBlock?.metadata ?? null;

  const failedBlock = ctx.blocks.find((b) => b.error || (b.metadata && !b.metadata.success));

  const startingTurn = firstBlock?.metadata?.startingTurn ?? null;
  const finalTurn = finalMeta?.finalTurn ?? null;

  const saveNationById = (save: GameSave | null): Map<string, SaveNation> => {
    const map = new Map<string, SaveNation>();
    for (const nation of save?.nations ?? []) map.set(nation.id, nation);
    return map;
  };

  const nationProgression: SeriesReportModel['nationProgression'] = successfulBlocks.map((block) => {
    const summaryNations = block.metadata?.stateSummary?.nations ?? [];
    const saveNations = saveNationById(block.save);
    return {
      checkpointTurn: block.metadata?.finalTurn ?? null,
      blockNumber: block.blockNumber,
      nations: summaryNations.map((nation) => {
        const saved = saveNations.get(nation.id);
        return {
          id: nation.id,
          name: nation.name,
          isHuman: nation.isHuman,
          era: nation.era,
          technologyCount: nation.technologyCount,
          cultureNodeCount: nation.cultureNodeCount,
          cityCount: nation.cityCount,
          population: nation.population,
          currentResearch: nation.currentResearch,
          currentCulture: nation.currentCulture,
          influence: saved?.influence ?? null,
          gold: saved?.gold ?? null,
        };
      }),
    };
  });

  const finalSaveNations = saveNationById(finalSave);

  const model: SeriesReportModel = {
    generatedAt: ctx.generatedAt,
    testSummary: {
      scenario: ctx.scenario,
      configuredMaxTurns: ctx.maxTurns,
      blockSize: ctx.blockSize,
      blocksExecuted: ctx.blocks.length,
      actualTurnsCompleted:
        startingTurn != null && finalTurn != null ? finalTurn - startingTurn : null,
      startingTurn,
      finalTurn,
      startingDate: firstBlock?.metadata?.startingYear != null
        ? String(firstBlock.metadata.startingYear)
        : null,
      finalDate: finalMeta?.stateSummary?.worldYearLabel
        ?? (finalMeta?.finalYear != null ? String(finalMeta.finalYear) : null),
      totalDurationMs: ctx.totalDurationMs,
      endReason: ctx.endReason,
      winner: victoryMeta?.victoryNationName ?? victoryMeta?.victoryNationId ?? null,
      victoryType: victoryMeta?.victoryType ?? null,
      victoryTurn: victoryMeta?.victoryRound ?? null,
      enabledVictoryConditions: ctx.enabledVictoryConditions,
      failureError: failedBlock?.error ?? failedBlock?.metadata?.error ?? null,
    },
    blocks: ctx.blocks.map((block) => {
      const meta = block.metadata;
      const summary = meta?.stateSummary;
      return {
        blockNumber: block.blockNumber,
        startingTurn: meta?.startingTurn ?? null,
        completedTurns: meta?.completedTurns ?? null,
        finalTurn: meta?.finalTurn ?? null,
        finalDate: summary?.worldYearLabel ?? (meta?.finalYear != null ? String(meta.finalYear) : null),
        durationMs: meta?.durationMs ?? null,
        nationCount: summary?.nationCount ?? null,
        cityCount: summary?.cityCount ?? null,
        unitCount: summary?.unitCount ?? null,
        victoryDetected: Boolean(meta?.victoryDetected),
        winner: meta?.victoryNationName ?? meta?.victoryNationId ?? null,
        victoryType: meta?.victoryType ?? null,
        checkpointFile: block.checkpointFile ?? null,
        error: block.error ?? meta?.error ?? null,
      };
    }),
    nationProgression,
    importantEvents: events,
    eventCounts: {
      wars: counts.warDeclared ?? 0,
      peaceAgreements: counts.peace ?? 0,
      cityFoundations: counts.cityFounded ?? 0,
      cityCaptures: counts.cityCaptured ?? 0,
      eliminatedNations: eliminated.size,
      councilMeetings: council.meetingCount,
      resolutionsProposed: council.resolutionsProposed,
      resolutionsPassed: council.resolutionsPassed,
      resolutionsRejected: council.resolutionsRejected,
      wondersCompleted: wondersCompleted(finalSave).length,
      tradeRoutes: counts.tradeRouteCompleted ?? 0,
      influenceSpentPerNation: 'unavailable',
      defenseSupportGoldPerNation: council.defenseSupportGoldByNation,
      totalDonatedGoldPerNation: council.totalDonatedGoldByNation,
      resolutionsByType: council.resolutionsByType,
    },
    finalWorldState: {
      finalTurn,
      finalDate: finalMeta?.stateSummary?.worldYearLabel ?? null,
      nations: finalNations.map((nation) => {
        const saved = finalSaveNations.get(nation.id);
        return {
          id: nation.id,
          name: nation.name,
          isHuman: nation.isHuman,
          era: nation.era,
          technologyCount: nation.technologyCount,
          cultureNodeCount: nation.cultureNodeCount,
          cityCount: nation.cityCount,
          population: nation.population,
          currentResearch: nation.currentResearch,
          currentCulture: nation.currentCulture,
          influence: saved?.influence ?? null,
          gold: saved?.gold ?? null,
          culture: saved?.culture ?? null,
          aiStrategyId: saved?.aiStrategyId ?? null,
          aiNationalAgendaId: saved?.aiNationalAgendaId ?? null,
          eliminated: eliminated.has(nation.id),
        };
      }),
      wars: currentWarPairs(finalSave).map((rel) => ({
        a: names.get(rel.nationA) ?? rel.nationA,
        b: names.get(rel.nationB) ?? rel.nationB,
      })),
      council,
      wondersCompleted: wondersCompleted(finalSave).length,
      tradeConnections: finalSave?.tradeConnections?.length ?? 0,
      tradeDeals: finalSave?.tradeDeals?.length ?? 0,
    },
    diagnostics: buildDiagnostics(eliminatedNames, finalNations, council, counts),
  };
  return model;
}

// ---------------------------------------------------------------------------
// Markdown rendering
// ---------------------------------------------------------------------------

function fmt(value: number | string | null | undefined): string {
  return value === null || value === undefined ? 'n/a' : String(value);
}

function fmtDuration(ms: number | null | undefined): string {
  if (ms == null) return 'n/a';
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export function renderSeriesReportMarkdown(model: SeriesReportModel, names: Map<string, string>): string {
  const lines: string[] = [];
  const ts = model.testSummary;

  lines.push('# Maritime Expansion — Autorun Series Report', '');
  lines.push(`_Generated ${model.generatedAt} — assembled mechanically from autorun metadata, timeline, and saves._`, '');

  // 1. Test summary
  lines.push('## 1. Test summary', '');
  lines.push(`- Scenario: \`${ts.scenario}\``);
  lines.push(`- Configured maximum turns: ${ts.configuredMaxTurns}`);
  lines.push(`- Block size: ${ts.blockSize}`);
  lines.push(`- Blocks executed: ${ts.blocksExecuted}`);
  lines.push(`- Actual turns completed: ${fmt(ts.actualTurnsCompleted)}`);
  lines.push(`- Starting turn / date: ${fmt(ts.startingTurn)} / ${fmt(ts.startingDate)}`);
  lines.push(`- Final turn / date: ${fmt(ts.finalTurn)} / ${fmt(ts.finalDate)}`);
  lines.push(`- Total execution duration: ${fmtDuration(ts.totalDurationMs)}`);
  lines.push(`- End reason: **${ts.endReason}**`);
  lines.push(`- Enabled victory conditions: ${ts.enabledVictoryConditions.join(', ') || 'none'}`);
  if (ts.endReason === 'victory') {
    lines.push(`- Winner: **${fmt(ts.winner)}** by **${fmt(ts.victoryType)}** victory on turn ${fmt(ts.victoryTurn)}`);
  }
  if (ts.failureError) lines.push(`- Failure error: ${ts.failureError}`);
  lines.push('');

  // 2. Block overview
  lines.push('## 2. Block overview', '');
  lines.push('| Block | Start turn | Turns run | Final turn | Final date | Duration | Nations | Cities | Units | Victory | Winner / type |');
  lines.push('| ---: | ---: | ---: | ---: | --- | --- | ---: | ---: | ---: | :---: | --- |');
  for (const block of model.blocks) {
    const victory = block.victoryDetected
      ? `✅ ${fmt(block.winner)} / ${fmt(block.victoryType)}`
      : block.error ? '❌ error' : '—';
    lines.push(
      `| ${block.blockNumber} | ${fmt(block.startingTurn)} | ${fmt(block.completedTurns)} | ${fmt(block.finalTurn)} | ${fmt(block.finalDate)} | ${fmtDuration(block.durationMs)} | ${fmt(block.nationCount)} | ${fmt(block.cityCount)} | ${fmt(block.unitCount)} | ${block.victoryDetected ? 'yes' : 'no'} | ${victory} |`,
    );
  }
  lines.push('');

  // 3. Nation progression snapshots
  lines.push('## 3. Nation progression snapshots', '');
  lines.push('_Per-checkpoint per-nation values. Diplomatic/science/cultural victory progress is not separately exposed by the engine; era, tech count, culture-node count and influence are shown as the closest reliable proxies._', '');
  for (const snapshot of model.nationProgression) {
    lines.push(`### Checkpoint turn ${fmt(snapshot.checkpointTurn)} (block ${snapshot.blockNumber})`, '');
    lines.push('| Nation | Era | Techs | Culture | Cities | Pop | Influence | Gold | Researching | Culture target |');
    lines.push('| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |');
    for (const nation of snapshot.nations) {
      const label = nation.isHuman ? `${nation.name} (human)` : nation.name;
      lines.push(
        `| ${label} | ${nation.era} | ${nation.technologyCount} | ${nation.cultureNodeCount} | ${nation.cityCount} | ${nation.population} | ${fmt(nation.influence)} | ${fmt(nation.gold)} | ${fmt(nation.currentResearch)} | ${fmt(nation.currentCulture)} |`,
      );
    }
    lines.push('');
  }

  // 4. Important gameplay events
  lines.push('## 4. Important gameplay events', '');
  lines.push('_Extracted from the engine\'s structured historical timeline (routine movement never reaches it). Council resolution detail comes from the save\'s council record._', '');
  const highlightPriority = 3; // priority <= this is a "headline" event
  const headlines = model.importantEvents.filter((event) => event.priority <= highlightPriority);
  if (headlines.length > 0) {
    lines.push('| Turn | Date | Category | Event |');
    lines.push('| ---: | --- | --- | --- |');
    for (const event of headlines) {
      lines.push(`| ${event.round} | ${event.dateLabel} | ${event.label} | ${event.text.replace(/\|/g, '\\|')} |`);
    }
  } else {
    lines.push('- No headline events (wars, peace, captures, wonders, councils) were recorded.');
  }
  lines.push('');

  // 5. Event counts
  const ec = model.eventCounts;
  lines.push('## 5. Event counts', '');
  lines.push('| Metric | Value |');
  lines.push('| --- | ---: |');
  lines.push(`| Wars declared | ${fmt(ec.wars)} |`);
  lines.push(`| Peace agreements | ${fmt(ec.peaceAgreements)} |`);
  lines.push(`| Cities founded | ${fmt(ec.cityFoundations)} |`);
  lines.push(`| Cities captured | ${fmt(ec.cityCaptures)} |`);
  lines.push(`| Nations eliminated | ${fmt(ec.eliminatedNations)} |`);
  lines.push(`| Council meetings | ${fmt(ec.councilMeetings)} |`);
  lines.push(`| Resolutions proposed | ${fmt(ec.resolutionsProposed)} |`);
  lines.push(`| Resolutions passed | ${fmt(ec.resolutionsPassed)} |`);
  lines.push(`| Resolutions rejected | ${fmt(ec.resolutionsRejected)} |`);
  lines.push(`| Wonders completed | ${fmt(ec.wondersCompleted)} |`);
  lines.push(`| Trade routes completed | ${fmt(ec.tradeRoutes)} |`);
  lines.push(`| Total Influence spent per nation | unavailable (engine does not expose an influence ledger) |`);
  lines.push('');
  if (Object.keys(ec.resolutionsByType).length > 0) {
    lines.push('Resolutions by type:', '');
    for (const [id, count] of Object.entries(ec.resolutionsByType).sort((a, b) => b[1] - a[1])) {
      lines.push(`- ${prettifyResolutionId(id)}: ${count}`);
    }
    lines.push('');
  }
  if (Object.keys(ec.defenseSupportGoldPerNation).length > 0) {
    lines.push('Defense Support gold donated per nation:', '');
    for (const [id, gold] of Object.entries(ec.defenseSupportGoldPerNation).sort((a, b) => b[1] - a[1])) {
      lines.push(`- ${names.get(id) ?? id}: ${gold}`);
    }
    lines.push('');
  }

  // 6. Final world state
  const fw = model.finalWorldState;
  lines.push('## 6. Final world state', '');
  lines.push(`Final turn ${fmt(fw.finalTurn)} (${fmt(fw.finalDate)}).`, '');
  lines.push('| Nation | Era | Techs | Culture | Cities | Pop | Influence | Gold | Strategy | Agenda | Status |');
  lines.push('| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |');
  for (const nation of fw.nations) {
    const label = nation.isHuman ? `${nation.name} (human)` : nation.name;
    const status = nation.eliminated ? '💀 eliminated' : 'alive';
    lines.push(
      `| ${label} | ${nation.era} | ${nation.technologyCount} | ${nation.cultureNodeCount} | ${nation.cityCount} | ${nation.population} | ${fmt(nation.influence)} | ${fmt(nation.gold)} | ${fmt(nation.aiStrategyId)} | ${fmt(nation.aiNationalAgendaId)} | ${status} |`,
    );
  }
  lines.push('');
  lines.push(`- Active wars: ${fw.wars.length > 0 ? fw.wars.map((w) => `${w.a} ⚔ ${w.b}`).join('; ') : 'none'}`);
  lines.push(`- Council: ${fw.council.founded ? `${fw.council.organizationKind ?? 'council'} (${fw.council.status ?? 'unknown'}), founded turn ${fmt(fw.council.foundingTurn)}, ${fw.council.memberCount} members` : 'never founded'}`);
  lines.push(`- Wonders completed: ${fw.wondersCompleted}`);
  lines.push(`- Trade connections: ${fw.tradeConnections}; active trade deals: ${fw.tradeDeals}`);
  lines.push('');

  // 7. Diagnostic observations
  lines.push('## 7. Diagnostic observations', '');
  if (model.diagnostics.length > 0) {
    for (const note of model.diagnostics) lines.push(`- ⚠️ ${note}`);
  } else {
    lines.push('- No threshold-based diagnostics triggered.');
  }
  lines.push('');

  return `${lines.join('\n')}\n`;
}

/** Convenience: name map from the final block's state summary. */
export function finalNameLookup(model: SeriesReportModel): Map<string, string> {
  const map = new Map<string, string>();
  for (const nation of model.finalWorldState.nations) map.set(nation.id, nation.name);
  return map;
}

// ---------------------------------------------------------------------------
// File readers (isolated I/O)
// ---------------------------------------------------------------------------

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function loadBlockArtifacts(blockDir: string): Promise<{ metadata: AutorunMetadata | null; save: GameSave | null }> {
  const [metadata, save] = await Promise.all([
    readJsonFile<AutorunMetadata>(path.join(blockDir, 'latest-metadata.json')),
    readJsonFile<GameSave>(path.join(blockDir, 'latest-save.json')),
  ]);
  return { metadata, save };
}
