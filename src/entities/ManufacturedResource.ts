export interface ManufacturedResourceDefinition {
  readonly id: string;
  readonly name: string;
  readonly category: 'manufactured';
  readonly iconKey?: string;
  readonly tradeGoldPerTurn?: number;
}
