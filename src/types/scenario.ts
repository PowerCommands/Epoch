import type { AINationalAgendaId } from './aiNationalAgenda';
import type { CovertPersonalityId } from './covertPersonality';
import type { WorldMarker } from './WorldMarker';

/**
 * How in-game time advances per turn. Stored on the scenario and surfaced in the
 * setup screen. NOTE: for now this is metadata only — the gameplay date/year
 * calculation does not consult it yet.
 */
export type ScenarioTimeProgressionMode = 'auto' | 'staticYear' | 'monthly';

export interface ScenarioTimeProgression {
  mode: ScenarioTimeProgressionMode;
  /** Years advanced per turn when mode is "staticYear". Ignored otherwise. */
  staticYearStep?: number;
}

export interface ScenarioMeta {
  name: string;
  version: number;
  /**
   * Optional editor-only background template name (e.g. "Europe"). Pure visual
   * tracing aid for the scenario editor; the game loader ignores it, so it never
   * influences gameplay or simulation.
   */
  template?: string;
  /** Free-text historical context shown in the setup screen. */
  description?: string;
  /** Scenario author, shown in the setup screen when present. */
  author?: string;
  /** Starting year magnitude (always positive); BC/AD is carried by startYearIsBC. */
  startYear?: number;
  /** True when startYear is BC, false when AD. */
  startYearIsBC?: boolean;
  /** Year when Auto progression switches to one quarter per turn. */
  quarterlyTurnsStartYear?: number;
  /** True when quarterlyTurnsStartYear is BC, false when AD. */
  quarterlyTurnsStartYearIsBC?: boolean;
  /** Time progression setup (metadata only for now). */
  timeProgression?: ScenarioTimeProgression;
  /**
   * Rounds between barbarian unit spawns from each (scenario-placed) Barbarian
   * Camp. Authored in the Editor's Scenario Details. Absent/invalid falls back to
   * DEFAULT_BARBARIAN_SPAWN_INTERVAL (10).
   */
  barbarianSpawnInterval?: number;
  /**
   * Turns two nations are prevented from declaring war on each other after making
   * peace. Authored in the Editor's Scenario Details. Absent/invalid falls back to
   * DEFAULT_PEACE_TREATY_COOLDOWN_TURNS (10).
   */
  peaceTreatyCooldownTurns?: number;
  /**
   * Turns a newly accepted trade route remains under establishment before it
   * becomes active. 0 activates the route as part of its creation operation.
   * Absent/invalid values fall back to the legacy establishment duration.
   */
  tradeRouteEstablishmentTurns?: number;
  /** Shorter human-facing trade agreement option. Absent/invalid defaults to 25. */
  shortTradeDealDuration?: number;
  /** Longer human-facing trade agreement option. Must exceed the short option; defaults to 50. */
  longTradeDealDuration?: number;
  /**
   * Percentage of a city's maximum defensive health at/below which an attack on a
   * nation's own original capital forces its capitulation. Authored in the Editor's
   * Scenario Details. Absent/invalid falls back to
   * DEFAULT_ORIGINAL_CAPITAL_COLLAPSE_PERCENT (10). 0 disables the rule.
   */
  originalCapitalCollapsePercent?: number;
  /**
   * Domination Victory land-control route: percentage (1–100) of all existing
   * land tiles a nation must own to win. Authored in the Editor's Scenario
   * Details. Absent/invalid falls back to DEFAULT_DOMINATION_LAND_PERCENT (20).
   */
  dominationLandPercent?: number;
  /**
   * Domination Victory vassal route: number of direct vassal states (integer ≥ 1)
   * a nation must hold to win. Authored in the Editor's Scenario Details.
   * Absent/invalid falls back to DEFAULT_DOMINATION_REQUIRED_VASSALS (3).
   */
  dominationRequiredVassals?: number;
}

export interface ScenarioMap {
  width: number;
  height: number;
  tileSize: number;
  tiles: { q: number; r: number; type: string; resourceId?: string; improvementId?: string; buildingId?: string }[];
}

export interface ScenarioNation {
  id: string;
  name: string;
  color: string;
  secondaryColor?: string;
  isHuman: boolean;
  aiStrategyId?: string;
  aiNationalAgendaId?: AINationalAgendaId;
  /** Covert-warfare personality. Absent → leader default → neutral. */
  covertPersonalityId?: CovertPersonalityId;
  startTerritoryCenter: { q: number; r: number };
  /** Optional non-default leader selected for this nation by the scenario editor. */
  leaderId?: string;
  /**
   * Editor-authored leader name. Empty/absent falls back to the hardcoded leader
   * name from {@link getLeaderByNationId}.
   */
  leaderName?: string;
  /** Editor-authored leader description. Empty/absent falls back to the hardcoded one. */
  leaderDescription?: string;
  /** Starting treasury (gold) for this nation. Defaults to 0. */
  gold?: number;
  researchedTechIds?: string[];
  currentResearchTechId?: string;
  researchProgress?: number;
  unlockedCultureNodeIds?: string[];
  currentCultureNodeId?: string;
  cultureProgress?: number;
}

export interface ScenarioCity {
  id: string;
  name: string;
  nationId: string;
  q: number;
  r: number;
  isCapital: boolean;
  originNationId?: string;
  isOriginalCapital?: boolean;
  isResidenceCapital?: boolean;
  /** Explicit editor-authored starting territory. q/r converts to City x/y at load time. */
  ownedTileCoords?: Array<{ q: number; r: number }>;
  /** Completed city buildings and their authored map locations. */
  buildings?: Array<{ buildingId: string; q: number; r: number }>;
}

export interface ScenarioUnit {
  nationId: string;
  unitTypeId: string;
  q: number;
  r: number;
}

/**
 * Per-nation starting setup configured in the editor's Nation Details dialog.
 * Keyed by nation id in {@link ScenarioData.nationDetails}. Applied to the
 * matching nation before gameplay begins. Nation-specific setup lives here and
 * is NOT duplicated under each diplomacy pair.
 */
export interface ScenarioNationDetails {
  researchedTechIds: string[];
  unlockedCultureNodeIds: string[];
}

/**
 * One pre-configured diplomatic relationship between a pair of nations. Stored
 * once per pair following DiplomacyManager's A/B convention (nationA sorts
 * before nationB alphabetically), so the directional grants below match the
 * manager's `*FromAToB` / `*FromBToA` ordering exactly.
 *
 * `state` adds an editor-level "ALLIANCE" on top of the engine's PEACE/WAR. At
 * load time an ALLIANCE entry sets the relation to PEACE and forms a real
 * alliance through AllianceManager — there is no separate alliance state on the
 * relation itself.
 */
export interface ScenarioInitialDiplomacyEntry {
  nationA: string;
  nationB: string;
  state: 'PEACE' | 'WAR' | 'ALLIANCE';
  openBordersFromAToB: boolean;
  openBordersFromBToA: boolean;
  embassyFromAToB: boolean;
  embassyFromBToA: boolean;
  tradeRelations: boolean;
  trust: number;
  fear: number;
  hostility: number;
  affinity: number;
  /** Suspicion (0–100). Optional for back-compat; absent normalizes to 0. */
  suspicion?: number;
}

/**
 * An event authored in advance as part of a scenario. This is intentionally
 * separate from the runtime HistoricalEvent records produced after gameplay
 * events have actually happened.
 */
export interface ScenarioHistoricalEventBase {
  id: string;
  type: string;
  name: string;
  description: string;
  /** Positive year magnitude; BC/AD is carried separately. */
  startYear: number;
  /** Calendar month, January = 1 through December = 12. */
  startMonth: number;
  startYearIsBC?: boolean;
}

export type ScenarioTurningPointEventType =
  | 'culturalJealousy'
  | 'reconciliation'
  | 'luckyLoser'
  | 'unluckyWinner';

/**
 * A scenario-controlled entry point into built-in Turning Point gameplay.
 * Effects and candidate rules remain code-defined; only presence and year are
 * authored. Turning Points always use their existing built-in month/date rules.
 */
export interface ScenarioTurningPointHistoricalEvent {
  id: string;
  type: ScenarioTurningPointEventType;
  name: string;
  /** Positive AD year in which the built-in system begins its normal logic. */
  startYear: number;
}

/** An unordered pair of scenario nations that will later begin at war. */
export interface ScenarioWorldWarConflict {
  nationAId: string;
  nationBId: string;
}

export interface ScenarioWorldWarHistoricalEvent extends ScenarioHistoricalEventBase {
  type: 'worldWar';
  conflicts: ScenarioWorldWarConflict[];
  /**
   * The war will later end when this nation has no active wars or has been
   * eliminated. Runtime evaluation is deliberately not implemented here.
   */
  endConditionNationId: string;
}

/** Extensible union of scenario-authored historical event definitions. */
export type ScenarioHistoricalEvent =
  | ScenarioWorldWarHistoricalEvent
  | ScenarioTurningPointHistoricalEvent;

export interface ScenarioData {
  meta: ScenarioMeta;
  map: ScenarioMap;
  nations: ScenarioNation[];
  cities: ScenarioCity[];
  units: ScenarioUnit[];
  worldMarkers?: WorldMarker[];
  /** Per-nation starting tech/culture setup, keyed by nation id. */
  nationDetails: Record<string, ScenarioNationDetails>;
  /** Pre-configured diplomacy, one entry per nation pair. */
  initialDiplomacy: ScenarioInitialDiplomacyEntry[];
  /** Authored future events. Absent in older scenarios. */
  historicalEvents?: ScenarioHistoricalEvent[];
  /**
   * True once the scenario has been saved with scenario-authored Turning Point
   * entries. If absent, legacy default years are retained for compatibility.
   */
  turningPointEventsConfigured?: true;
}
