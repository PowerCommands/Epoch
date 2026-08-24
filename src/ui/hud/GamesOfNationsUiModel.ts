import { GAMES_POINTS_PER_RESOURCE, GAMES_OF_NATIONS_SPORTS } from '../../systems/GamesOfNationsSystem';
import type {
  GamesOfNationsParticipantState,
  GamesOfNationsSportValues,
  GamesOfNationsSummary,
} from '../../types/gamesOfNations';

export const GAMES_HUD_BUTTON_LAYOUT = {
  left: 16,
  top: 294,
  diameter: 102,
  researchTop: 62,
  cultureTop: 178,
} as const;

export const GAMES_HUD_DARK_BLUE = 0x071d3a;

export interface GamesOfNationsUiContext {
  summary: GamesOfNationsSummary;
  humanNationId: string;
  hostNationName: string | null;
  hostCityName: string | null;
  founderNationName: string | null;
  currentCultureAvailable: number;
  currentBaseProductionAvailable: number;
  nationNames?: Readonly<Record<string, string>>;
}

export interface GamesCommitmentView {
  commitment: number;
  available: number;
  affordable: boolean;
  potentialGamesPoints: number;
  achievableGamesPoints: number;
  status: string;
}

export interface GamesOfNationsUiModel {
  founded: boolean;
  gamesNumber: number;
  firstGamesTurn: number | null;
  phase: GamesOfNationsSummary['phase'];
  phaseLabel: string;
  hostLabel: string;
  founderNationName: string | null;
  preparationProgress: string | null;
  competitionProgress: string | null;
  cooldownProgress: string | null;
  activeSport: string | null;
  turnsUntilCompetition: number | null;
  turnsUntilPreparation: number | null;
  participant: GamesOfNationsParticipantState | null;
  participating: boolean;
  controlsEditable: boolean;
  promptPending: boolean;
  buttonProgress: number;
  buttonActive: boolean;
  buttonTooltip: string;
  culture: GamesCommitmentView;
  production: GamesCommitmentView;
  theoreticalGamesPointsPerTurn: number;
  achievableGamesPointsPerTurn: number;
  sportResults: Array<{
    sport: string;
    status: 'Completed' | 'Current' | 'Upcoming';
    goldName: string | null;
    silverName: string | null;
    bronzeName: string | null;
  }>;
  medalTable: Array<{ nationId: string; nationName: string; gold: number; silver: number; bronze: number }>;
  overallWinnerName: string | null;
}

export function buildGamesOfNationsUiModel(context: GamesOfNationsUiContext): GamesOfNationsUiModel {
  const { summary } = context;
  const participant = summary.participants.find((entry) => entry.nationId === context.humanNationId) ?? null;
  const culture = commitmentView(participant?.cultureCommitment ?? 0, context.currentCultureAvailable);
  const production = commitmentView(participant?.productionCommitment ?? 0, context.currentBaseProductionAvailable);
  const hostLabel = [context.hostNationName, context.hostCityName].filter(Boolean).join(' — ') || 'To be determined';
  const progressTurn = summary.phaseProgressTurn;
  const progressTotal = summary.phaseTotalTurns;
  const preparationProgress = summary.phase === 'preparation' && progressTurn !== null
    ? `${progressTurn} / ${progressTotal ?? 10}`
    : null;
  const competitionProgress = summary.phase === 'competition' && progressTurn !== null
    ? `${progressTurn} / ${progressTotal ?? 5}`
    : null;
  const cooldownProgress = summary.phase === 'cooldown' && progressTurn !== null
    ? `${progressTurn} / ${progressTotal ?? 10}`
    : null;
  const turnsUntilPreparation = summary.phase === 'waitingForFirstGames' || summary.phase === 'cooldown'
    ? summary.turnsUntilNextPhase
    : null;
  const participating = participant?.participating === true;
  const nationName = (nationId: string | undefined): string | null => (
    nationId ? context.nationNames?.[nationId] ?? nationId : null
  );
  return {
    founded: summary.founded,
    gamesNumber: summary.competitionNumber,
    firstGamesTurn: summary.firstGamesTurn,
    phase: summary.phase,
    phaseLabel: phaseLabel(summary.phase),
    hostLabel,
    founderNationName: context.founderNationName,
    preparationProgress,
    competitionProgress,
    cooldownProgress,
    activeSport: summary.activeSport,
    turnsUntilCompetition: summary.turnsUntilGames,
    turnsUntilPreparation,
    participant,
    participating,
    controlsEditable: summary.phase === 'preparation' && participating,
    promptPending: summary.phase === 'preparation'
      && summary.humanPreparationPromptAcknowledgedCompetitionNumber !== summary.competitionNumber,
    buttonProgress: summary.phase === 'preparation'
      ? clamp((progressTurn ?? 0) / 10, 0, 1)
      : summary.phase === 'competition' ? 1 : 0,
    buttonActive: summary.phase === 'preparation' || summary.phase === 'competition',
    buttonTooltip: buildTooltip(summary, hostLabel, preparationProgress, competitionProgress, turnsUntilPreparation),
    culture,
    production,
    theoreticalGamesPointsPerTurn: culture.potentialGamesPoints + production.potentialGamesPoints,
    achievableGamesPointsPerTurn: culture.achievableGamesPoints + production.achievableGamesPoints,
    sportResults: (summary.sportResults ?? []).map((result) => ({
      sport: result.sport,
      status: result.resolved ? 'Completed' : result.sport === summary.activeSport ? 'Current' : 'Upcoming',
      goldName: nationName(result.goldNationId),
      silverName: nationName(result.silverNationId),
      bronzeName: nationName(result.bronzeNationId),
    })),
    medalTable: (summary.medalTable ?? []).map((standing) => ({
      ...standing,
      nationName: nationName(standing.nationId) ?? standing.nationId,
    })),
    overallWinnerName: nationName(summary.overallWinnerNationId ?? undefined),
  };
}

export function validateGamesAllocation(allocation: GamesOfNationsSportValues): string | null {
  const values = GAMES_OF_NATIONS_SPORTS.map((sport) => allocation[sport]);
  if (values.some((value) => !Number.isInteger(value) || value < 0 || value > 100)) {
    return 'Each allocation must be a whole percentage from 0 to 100.';
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return total === 100 ? null : `Allocation must equal 100% (currently ${total}%).`;
}

function commitmentView(commitmentValue: number, availableValue: number): GamesCommitmentView {
  const commitment = whole(commitmentValue);
  const available = whole(availableValue);
  const affordable = commitment === 0 || available >= commitment;
  const potentialGamesPoints = commitment * GAMES_POINTS_PER_RESOURCE;
  return {
    commitment,
    available,
    affordable,
    potentialGamesPoints,
    achievableGamesPoints: affordable ? potentialGamesPoints : 0,
    status: commitment === 0
      ? 'No commitment'
      : affordable
        ? 'Available'
        : 'Cannot be fulfilled this turn — this resource will contribute 0 GP',
  };
}

function phaseLabel(phase: GamesOfNationsSummary['phase']): string {
  switch (phase) {
    case 'waitingForFirstGames': return 'First Games approaching';
    case 'preparation': return 'Preparation';
    case 'competition': return 'Competition';
    case 'cooldown': return 'Cooldown';
    default: return 'Not founded';
  }
}

function buildTooltip(
  summary: GamesOfNationsSummary,
  hostLabel: string,
  preparationProgress: string | null,
  competitionProgress: string | null,
  turnsUntilPreparation: number | null,
): string {
  const hostCity = hostLabel.includes(' — ') ? hostLabel.split(' — ').slice(1).join(' — ') : hostLabel;
  if (summary.phase === 'preparation') {
    return [
      'Games of Nations',
      `Preparation ${preparationProgress}`,
      `Host: ${hostCity}`,
      `Competition in ${summary.turnsUntilGames ?? 0} turns`,
      'Click to manage investment',
    ].join('\n');
  }
  if (summary.phase === 'competition') {
    return [
      'Games of Nations',
      `Competition ${competitionProgress}`,
      summary.activeSport ?? 'Competition',
      `Host: ${hostCity}`,
    ].join('\n');
  }
  if (summary.phase === 'cooldown') {
    return `Games of Nations\nCooldown\nNext preparation in ${turnsUntilPreparation ?? 0} turns`;
  }
  if (summary.phase === 'waitingForFirstGames') {
    return `Games of Nations\nFirst Games: ${hostCity}\nPreparation begins in ${turnsUntilPreparation ?? 0} turns`;
  }
  return 'Games of Nations has not yet been founded.';
}

function whole(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
