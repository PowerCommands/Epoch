import { GAMES_POINTS_PER_RESOURCE, GAMES_OF_NATIONS_SPORTS, selectAuctionWinner } from '../../systems/GamesOfNationsSystem';
import type {
  GamesOfNationsParticipantState,
  GamesOfNationsSport,
  GamesOfNationsSportId,
  GamesOfNationsSummary,
} from '../../types/gamesOfNations';
import { getGamesSportById } from '../../data/gamesOfNationsSports';

export const GAMES_HUD_BUTTON_LAYOUT = {
  left: 16,
  top: 302,
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
  candidateNationName?: string | null;
  upcomingHostNationName?: string | null;
  upcomingHostCityName?: string | null;
  hostCityOptions?: Array<{ id: string; name: string; productionPerTurn: number; estimatedTurns: number | null; hasGrandStadium: boolean }>;
  stadiumEstimatedTurns?: number | null;
  stadiumUnderConstruction?: boolean;
  humanTreasury?: number;
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
  activeSports: GamesOfNationsSport[];
  turnsUntilCompetition: number | null;
  turnsUntilPreparation: number | null;
  participant: GamesOfNationsParticipantState | null;
  participating: boolean;
  excluded: boolean;
  controlsEditable: boolean;
  promptPending: boolean;
  hostingPromptPending: boolean;
  hostCitySelectionPending: boolean;
  candidateNationName: string | null;
  hostCityOptions: Array<{ id: string; name: string; productionPerTurn: number; estimatedTurns: number | null; hasGrandStadium: boolean }>;
  publicHostLabel: string;
  stadiumStatus: string;
  stadiumEstimatedTurns: number | null;
  stadiumAtRisk: boolean;
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
  humanIsHost: boolean;
  hostNationName: string | null;
  hostBonusCalculated: boolean;
  hostBonusGamesPoints: number;
  hostBonusSport: GamesOfNationsSport | null;
  hostBonusSelectionRequired: boolean;
  hostBonusLocked: boolean;
  hostBonusBaseGamesPoints: number | null;
  hostBonusEffectiveGamesPoints: number | null;
  sportAuction: {
    era: string;
    treasury: number;
    currentLeader: { nationName: string; sportName: string; bid: number } | null;
    proposals: Array<{ nationName: string; sportName: string; bid: number }>;
    candidates: Array<{ id: GamesOfNationsSportId; name: string }>;
  } | null;
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
  const excluded = (summary.excludedNationIds ?? []).includes(context.humanNationId);
  const humanIsHost = summary.hostNationId === context.humanNationId;
  const hostParticipant = summary.participants.find((entry) => entry.nationId === summary.hostNationId);
  const hostBonusBaseGamesPoints = summary.hostBonusSport
    ? hostParticipant?.gamesPointsBySport[summary.hostBonusSport] ?? 0
    : null;
  const nationName = (nationId: string | undefined): string | null => (
    nationId ? context.nationNames?.[nationId] ?? nationId : null
  );
  const pendingAuction = summary.pendingSportAuction;
  const auctionLeader = pendingAuction
    ? selectAuctionWinner(pendingAuction.proposals, pendingAuction.proposals.map((proposal) => proposal.nationId))
    : undefined;
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
    activeSports: [...(summary.activeSports ?? ((summary.sportResults ?? []).length > 0
      ? (summary.sportResults ?? []).map((result) => result.sport)
      : GAMES_OF_NATIONS_SPORTS))],
    turnsUntilCompetition: summary.turnsUntilGames,
    turnsUntilPreparation,
    participant,
    participating,
    excluded,
    controlsEditable: summary.humanInteractionSuppressed !== true && summary.phase === 'preparation' && participating && !excluded,
    promptPending: summary.humanInteractionSuppressed !== true && summary.phase === 'preparation'
      && !excluded
      && summary.humanPreparationPromptAcknowledgedCompetitionNumber !== summary.competitionNumber,
    hostingPromptPending: summary.humanInteractionSuppressed !== true && summary.hostingDecision === 'pendingDecision'
      && summary.hostCandidateNationId === context.humanNationId,
    hostCitySelectionPending: summary.humanInteractionSuppressed !== true && summary.hostingDecision === 'pendingCity'
      && summary.hostCandidateNationId === context.humanNationId,
    candidateNationName: context.candidateNationName ?? null,
    hostCityOptions: context.hostCityOptions ?? [],
    publicHostLabel: [context.upcomingHostNationName ?? context.hostNationName, context.upcomingHostCityName ?? context.hostCityName]
      .filter(Boolean).join(' — ') || 'To be determined',
    stadiumStatus: summary.stadiumRequirementGrandfathered
      ? 'Fulfilled (legacy cycle)'
      : summary.stadiumExistingInfrastructure
        ? 'Completed — existing infrastructure'
        : summary.stadiumCompleted
          ? 'Completed — new construction'
          : context.stadiumUnderConstruction
            ? 'Under Construction'
            : summary.hostingDecision === 'confirmed' ? 'Not started' : 'Awaiting host',
    stadiumEstimatedTurns: context.stadiumEstimatedTurns ?? null,
    stadiumAtRisk: context.stadiumEstimatedTurns !== undefined
      && context.stadiumEstimatedTurns !== null
      && summary.turnsUntilGames !== null
      && context.stadiumEstimatedTurns > summary.turnsUntilGames,
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
    humanIsHost,
    hostNationName: context.hostNationName,
    hostBonusCalculated: summary.hostBonusCalculated,
    hostBonusGamesPoints: summary.hostBonusGamesPoints,
    hostBonusSport: summary.hostBonusSport,
    hostBonusSelectionRequired: summary.phase === 'preparation'
      && humanIsHost
      && !excluded
      && summary.hostBonusCalculated
      && summary.hostBonusSport === null,
    hostBonusLocked: summary.hostBonusSport !== null,
    hostBonusBaseGamesPoints,
    hostBonusEffectiveGamesPoints: hostBonusBaseGamesPoints === null
      ? null
      : hostBonusBaseGamesPoints + summary.hostBonusGamesPoints,
    sportAuction: pendingAuction && summary.humanInteractionSuppressed !== true ? {
      era: pendingAuction.triggerEra,
      treasury: whole(context.humanTreasury ?? 0),
      currentLeader: auctionLeader ? {
        nationName: nationName(auctionLeader.nationId) ?? auctionLeader.nationId,
        sportName: getGamesSportById(auctionLeader.sportId).name,
        bid: auctionLeader.bid,
      } : null,
      proposals: pendingAuction.proposals.map((proposal) => ({
        nationName: nationName(proposal.nationId) ?? proposal.nationId,
        sportName: getGamesSportById(proposal.sportId).name,
        bid: proposal.bid,
      })),
      candidates: pendingAuction.candidateSportIds.map((id) => ({ id, name: getGamesSportById(id).name })),
    } : null,
  };
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
    case 'cancelled': return 'Cancelled';
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
