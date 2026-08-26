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
  /** Time progression setup (metadata only for now). */
  timeProgression?: ScenarioTimeProgression;
  /**
   * Rounds between barbarian unit spawns from each (scenario-placed) Barbarian
   * Camp. Authored in the Editor's Scenario Details. Absent/invalid falls back to
   * DEFAULT_BARBARIAN_SPAWN_INTERVAL (10).
   */
  barbarianSpawnInterval?: number;
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
}
