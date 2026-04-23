export class TimeSystem {
  getYearForTurn(turn: number): number {
    return -4000 + (turn * 25);
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
