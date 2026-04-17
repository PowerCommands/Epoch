import { CityManager } from './CityManager';
import { NationManager } from './NationManager';
import { TurnManager } from './TurnManager';

type VictoryListener = (nationId: string) => void;

/**
 * VictorySystem checks for win condition after each turn end.
 * Domination victory: one nation owns every active nation's capital.
 */
export class VictorySystem {
  private readonly cityManager: CityManager;
  private readonly nationManager: NationManager;
  private readonly listeners: VictoryListener[] = [];
  private won = false;

  constructor(
    cityManager: CityManager,
    nationManager: NationManager,
    turnManager: TurnManager,
  ) {
    this.cityManager = cityManager;
    this.nationManager = nationManager;

    turnManager.on('turnEnd', () => {
      if (this.won) return;
      const winner = this.checkVictory();
      if (winner) {
        this.won = true;
        for (const cb of this.listeners) cb(winner);
      }
    });
  }

  checkVictory(): string | null {
    const activeNations = this.nationManager.getAllNations();
    if (activeNations.length < 2) return null;

    const capitals = this.cityManager.getAllCities().filter((c) => c.isCapital);
    if (capitals.length < activeNations.length) return null;

    const owners = new Set(capitals.map((c) => c.ownerId));
    if (owners.size === 1) return capitals[0].ownerId;
    return null;
  }

  onVictory(callback: VictoryListener): void {
    this.listeners.push(callback);
  }
}
