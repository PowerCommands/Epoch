import type { GamesOfNationsUiModel } from '../../src/ui/hud/GamesOfNationsUiModel';
import type { WorldCouncilOverviewState } from '../../src/ui/hud/WorldCouncilOverviewDialog';

export function gamesModel(host = false): GamesOfNationsUiModel {
  return {
    founded: true, gamesNumber: 15, firstGamesTurn: 100, phase: 'preparation', phaseLabel: 'Preparation',
    suspendedForWorldWar: false, hostLabel: 'Argentina — Buenos Aires', founderNationName: 'Argentina',
    preparationProgress: '6 / 10', competitionProgress: null, cooldownProgress: null, activeSport: null,
    activeSports: ['Wrestling', 'Marathon', 'Swimming', 'Javelin', 'Long Jump'],
    turnsUntilCompetition: 5, turnsUntilPreparation: null,
    participant: {
      nationId: 'human', participating: true, cultureCommitment: 0, productionCommitment: 100,
      unallocatedGamesPoints: 0, gamesPointsBySport: { Wrestling: 1000, Marathon: 1000, Swimming: 1000, Javelin: 1000, 'Long Jump': 1000 },
      gamesPointsStrategyBySport: { Wrestling: 200, Marathon: 200, Swimming: 200, Javelin: 200, 'Long Jump': 200 },
      totalGamesPoints: 5000, totalCultureInvested: 0, totalProductionInvested: 500,
      failedCultureCommitmentTurns: 0, failedProductionCommitmentTurns: 0, strategyInitialized: true,
    },
    participating: true, excluded: false, controlsEditable: true, promptPending: false, strategyAdjustmentPending: false,
    hostingPromptPending: false, hostCitySelectionPending: false, candidateNationName: null, hostCityOptions: [],
    publicHostLabel: 'Argentina — Buenos Aires', stadiumStatus: 'Completed — existing infrastructure',
    stadiumEstimatedTurns: null, stadiumAtRisk: false, buttonProgress: 0.6, buttonActive: true, buttonTooltip: '',
    culture: { commitment: 0, available: 84, affordable: true, potentialGamesPoints: 0, achievableGamesPoints: 0, status: 'No commitment' },
    production: { commitment: 100, available: 161, affordable: true, potentialGamesPoints: 1000, achievableGamesPoints: 1000, status: 'Available' },
    theoreticalGamesPointsPerTurn: 1000, achievableGamesPointsPerTurn: 1000, sportResults: [], medalTable: [], overallWinnerName: null,
    humanIsHost: host, hostNationName: 'Argentina', hostBonusCalculated: true, hostBonusGamesPoints: 206,
    hostBonusSport: host ? null : 'Wrestling', hostBonusSelectionRequired: host, hostBonusLocked: !host,
    hostBonusBaseGamesPoints: host ? null : 190, hostBonusEffectiveGamesPoints: host ? null : 396,
    policySportBonuses: {}, sportAuction: null,
  };
}

export const councilModel: WorldCouncilOverviewState = {
  organizationName: 'United Nations', status: 'active', foundingCityName: 'Paris', foundingNationName: 'France',
  constructionTurnsRemaining: 0, diplomacyScoreThreshold: 5000, nextRegularMeetingTurn: 151, currentTurn: 124,
  canHumanLeave: true,
  members: ['France', 'Canada', 'Argentina'].map((nationName, i) => ({ nationName, nationColor: ['#427dba', '#bc443a', '#80aabd'][i],
    isHuman: i === 1, diplomacyScore: 1200 - i * 180, diplomacyScoreSinceLastRegularMeeting: 80,
    goldContributed: 500, scienceContributionPercent: 5, cultureContributionPercent: 5 })),
  enactedResolutions: ['International Development Fund', 'Climate Accord'].map(title => ({ title,
    status: 'active', meetingKind: 'Regular Meeting', turn: 51 })),
  meetings: [],
};
