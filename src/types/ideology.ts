export type IdeologyId =
  | 'liberalism'
  | 'conservatism'
  | 'nationalism'
  | 'globalism'
  | 'militarism'
  | 'traditionalism'
  | 'progressivism';

export interface IdeologyDefinition {
  readonly id: IdeologyId;
  readonly name: string;
  readonly description: string;
  readonly diplomacyBias: number;
  readonly tradeBias: number;
  readonly warBias: number;
  readonly openBordersBias: number;
  readonly cultureResistance: number;
  readonly expansionBias: number;
}
