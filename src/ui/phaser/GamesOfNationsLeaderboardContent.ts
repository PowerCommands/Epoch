import type {
  CompletedGamesOfNationsRecord,
  GamesOfNationsHistoricalStanding,
} from '../../types/gamesOfNations';
import type { RightSidebarSection } from './RightSidebarPanelTypes';

const EMPTY_MESSAGE = 'No Games of Nations tournaments have been completed yet.';

export function buildGamesOfNationsLeaderboardSections(
  standings: readonly GamesOfNationsHistoricalStanding[],
  completedGames: readonly CompletedGamesOfNationsRecord[],
): RightSidebarSection[] {
  const medalLeague: RightSidebarSection = {
    title: 'Games of Nations Medal League',
    rows: standings.length === 0
      ? [{ kind: 'text', text: EMPTY_MESSAGE, muted: true }]
      : [{
        kind: 'compactTable',
        columns: [
          { label: 'Rank', weight: 0.35, align: 'left' },
          { label: 'Nation', weight: 1.075 },
          { label: 'Gold', weight: 0.65, align: 'right' },
          { label: 'Silver', weight: 0.72, align: 'right' },
          { label: 'Bronze', weight: 0.78, align: 'right' },
          { label: 'Medals', weight: 0.58, align: 'center' },
        ],
        rows: standings.map((standing, index) => [
          String(index + 1),
          standing.nationName,
          String(standing.gold),
          String(standing.silver),
          String(standing.bronze),
          String(standing.totalMedals),
        ]),
      }],
  };

  const tournamentHistory: RightSidebarSection = {
    title: 'Games of Nations Tournament History',
    rows: completedGames.length === 0
      ? [{ kind: 'text', text: EMPTY_MESSAGE, muted: true }]
      : [{
        kind: 'compactTable',
        columns: [
          { label: 'Year', weight: 1.7, align: 'left' },
          { label: 'Host Nation', weight: 1.55 },
          { label: 'Host City', weight: 1.45 },
          { label: 'Winner', weight: 1.55 },
        ],
        rows: [...completedGames]
          .sort((a, b) => a.gamesNumber - b.gamesNumber)
          .map((games) => [
            games.yearLabel,
            games.hostNationName,
            games.hostCityName,
            games.status === 'cancelled' ? 'Cancelled' : games.overallWinnerNationName ?? 'No winner',
          ]),
      }],
  };

  return [medalLeague, tournamentHistory];
}
