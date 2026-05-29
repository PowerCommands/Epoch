import { getBuildingById } from '../data/buildings';
import type { CityManager } from './CityManager';
import type { DiplomacyManager } from './DiplomacyManager';
import type { NationManager } from './NationManager';
import type { TradeConnection, TradeConnectionStatus } from '../types/tradeConnection';

export type TradeConnectionValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export class TradeConnectionSystem {
  private readonly connections = new Map<string, TradeConnection>();
  private nextConnectionNumber = 1;

  constructor(
    private readonly cityManager: CityManager,
    private readonly diplomacyManager: DiplomacyManager,
    private readonly nationManager: NationManager,
    private readonly log?: (message: string, nationId: string) => void,
  ) {}

  getCityTradeCapacity(cityId: string): number {
    const buildings = this.cityManager.getBuildings(cityId);
    if (!buildings) return 0;
    let capacity = 0;
    for (const id of buildings.getAll()) {
      const def = getBuildingById(id);
      if (def?.modifiers.tradeCapacity) {
        capacity += def.modifiers.tradeCapacity;
      }
    }
    return capacity;
  }

  getCityUsedTradeCapacity(cityId: string): number {
    let used = 0;
    for (const conn of this.connections.values()) {
      if (conn.cityAId === cityId || conn.cityBId === cityId) {
        used += conn.capacity;
      }
    }
    return used;
  }

  getCityAvailableTradeCapacity(cityId: string): number {
    return this.getCityTradeCapacity(cityId) - this.getCityUsedTradeCapacity(cityId);
  }

  canCreateTradeConnection(cityAId: string, cityBId: string): TradeConnectionValidationResult {
    const cityA = this.cityManager.getCity(cityAId);
    const cityB = this.cityManager.getCity(cityBId);

    if (!cityA) return { ok: false, reason: `City ${cityAId} does not exist.` };
    if (!cityB) return { ok: false, reason: `City ${cityBId} does not exist.` };
    if (cityA.ownerId === cityB.ownerId) {
      return { ok: false, reason: 'Domestic routes are not supported.' };
    }

    const nationAId = cityA.ownerId;
    const nationBId = cityB.ownerId;

    if (this.diplomacyManager.getState(nationAId, nationBId) === 'WAR') {
      return { ok: false, reason: 'Cannot establish a trade connection while at war.' };
    }

    // TODO: enforce Trade Relations once the diplomatic prerequisite is confirmed as always present
    if (!this.diplomacyManager.hasTradeRelations(nationAId, nationBId)) {
      return { ok: false, reason: 'Active Trade Relations are required.' };
    }

    if (this.getCityAvailableTradeCapacity(cityAId) < 1) {
      return { ok: false, reason: `${cityA.name} has no available trade capacity.` };
    }
    if (this.getCityAvailableTradeCapacity(cityBId) < 1) {
      return { ok: false, reason: `${cityB.name} has no available trade capacity.` };
    }

    return { ok: true };
  }

  createTradeConnectionDraft(cityAId: string, cityBId: string, currentRound: number): TradeConnection {
    const cityA = this.cityManager.getCity(cityAId)!;
    const cityB = this.cityManager.getCity(cityBId)!;

    const connection: TradeConnection = {
      id: `trade_connection_${this.nextConnectionNumber++}`,
      nationAId: cityA.ownerId,
      cityAId,
      nationBId: cityB.ownerId,
      cityBId,
      status: 'building',
      capacity: 1,
      createdRound: currentRound,
    };

    this.connections.set(connection.id, connection);

    const nationA = this.nationManager.getNation(cityA.ownerId);
    const nationName = nationA?.name ?? cityA.ownerId;
    this.log?.(
      `${nationName} started preparing trade connection ${cityA.name} ↔ ${cityB.name}.`,
      cityA.ownerId,
    );

    return { ...connection };
  }

  activateTradeConnection(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (!conn || conn.status === 'active') return;

    const updated: TradeConnection = { ...conn, status: 'active' };
    this.connections.set(connectionId, updated);

    const cityA = this.cityManager.getCity(conn.cityAId);
    const cityB = this.cityManager.getCity(conn.cityBId);
    const nationA = this.nationManager.getNation(conn.nationAId);
    const nationName = nationA?.name ?? conn.nationAId;
    const cityAName = cityA?.name ?? conn.cityAId;
    const cityBName = cityB?.name ?? conn.cityBId;

    this.log?.(
      `${nationName} activated trade connection ${cityAName} ↔ ${cityBName}.`,
      conn.nationAId,
    );
  }

  getActiveConnectionsBetweenNations(nationAId: string, nationBId: string): TradeConnection[] {
    return Array.from(this.connections.values()).filter(
      (conn) =>
        conn.status === 'active' &&
        ((conn.nationAId === nationAId && conn.nationBId === nationBId) ||
          (conn.nationAId === nationBId && conn.nationBId === nationAId)),
    ).map((conn) => ({ ...conn }));
  }

  getConnection(connectionId: string): TradeConnection | undefined {
    const conn = this.connections.get(connectionId);
    return conn ? { ...conn } : undefined;
  }

  cancelConnection(connectionId: string): void {
    this.connections.delete(connectionId);
  }

  /** Total active connection capacity between two nations (used for deal slot availability). */
  getActiveDealCapacityBetweenNations(nationAId: string, nationBId: string): number {
    let total = 0;
    for (const conn of this.connections.values()) {
      if (conn.status !== 'active') continue;
      if (
        (conn.nationAId === nationAId && conn.nationBId === nationBId) ||
        (conn.nationAId === nationBId && conn.nationBId === nationAId)
      ) {
        total += conn.capacity;
      }
    }
    return total;
  }

  /** Cancel all connections (active and building) between two nations. Returns the cancelled connections for logging. */
  cancelConnectionsBetweenNations(nationAId: string, nationBId: string): TradeConnection[] {
    const cancelled: TradeConnection[] = [];
    for (const [id, conn] of Array.from(this.connections.entries())) {
      if (
        (conn.nationAId === nationAId && conn.nationBId === nationBId) ||
        (conn.nationAId === nationBId && conn.nationBId === nationAId)
      ) {
        cancelled.push({ ...conn });
        this.connections.delete(id);
      }
    }
    return cancelled;
  }

  getAllConnections(): TradeConnection[] {
    return Array.from(this.connections.values()).map((conn) => ({ ...conn }));
  }

  restoreConnections(connections: readonly TradeConnection[]): void {
    this.connections.clear();
    let highestNumber = 0;
    for (const conn of connections) {
      this.connections.set(conn.id, { ...conn });
      const match = /^trade_connection_(\d+)$/.exec(conn.id);
      if (match) highestNumber = Math.max(highestNumber, Number(match[1]));
    }
    this.nextConnectionNumber = highestNumber + 1;
  }

  /** Remove all connections involving a nation — call when a nation is eliminated. */
  removeConnectionsForNation(nationId: string): void {
    for (const [id, conn] of Array.from(this.connections.entries())) {
      if (conn.nationAId === nationId || conn.nationBId === nationId) {
        this.connections.delete(id);
      }
    }
  }
}
