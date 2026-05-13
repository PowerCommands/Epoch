export interface Corporation {
  readonly corporationId: string;
  readonly founderNationId: string;
  readonly cityId?: string;
  readonly foundedTurn: number;
}
