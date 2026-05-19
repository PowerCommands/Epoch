import type { DiplomacyManager } from './DiplomacyManager';
import type { NationManager } from './NationManager';

const LONG_WAR_THRESHOLD_1 = 10;
const LONG_WAR_THRESHOLD_2 = 25;

export class WarWearinessSystem {
  constructor(
    private readonly nationManager: NationManager,
    private readonly diplomacyManager: DiplomacyManager,
    private readonly getCurrentRound: () => number,
  ) {}

  getWarWeariness(nationId: string): number {
    const currentTurn = this.getCurrentRound();
    let total = 0;

    for (const other of this.nationManager.getAllNations()) {
      if (other.id === nationId) continue;
      if (this.diplomacyManager.getState(nationId, other.id) !== 'WAR') continue;

      const duration = this.diplomacyManager.getWarDuration(nationId, other.id, currentTurn);
      if (duration > LONG_WAR_THRESHOLD_1) total += 1;
      if (duration > LONG_WAR_THRESHOLD_2) total += 1;

      if (this.diplomacyManager.getAggressorNationId(nationId, other.id) === nationId) {
        total += 1;
      }
    }

    return total;
  }
}
