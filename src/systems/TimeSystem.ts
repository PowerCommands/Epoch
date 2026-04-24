import { getGameSpeedById, type GameSpeedDefinition } from '../data/gameSpeeds';

export class TimeSystem {
  constructor(private readonly gameSpeed: GameSpeedDefinition = getGameSpeedById(undefined)) {}

  getYearForTurn(turn: number): number {
    return -4000 + Math.round(turn * 25 * this.gameSpeed.yearProgressionMultiplier);
  }

  getLabelForTurn(turn: number): string {
    const year = this.getYearForTurn(turn);

    let yearLabel: string;

    if (year < 0) {
      yearLabel = `${Math.abs(year)} BC`;
    } else if (year === 0) {
      yearLabel = '0 AD';
    } else {
      yearLabel = `${year} AD`;
    }

    return `Year: ${yearLabel} (turn:${turn})`;
  }
}
