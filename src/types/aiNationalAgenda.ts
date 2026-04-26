export type AINationalAgendaId =
  | 'balanced'
  | 'growth'
  | 'culture'
  | 'economic'
  | 'military_power'
  | 'expansionist'
  | 'naval_power'
  | 'isolationist';

export interface AINationalAgenda {
  readonly id: AINationalAgendaId;
  readonly name: string;
  readonly description: string;
  readonly strategyBias: Partial<Record<string, number>>;
}
