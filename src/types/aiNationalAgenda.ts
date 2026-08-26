export type AINationalAgendaId =
  | 'balanced'
  | 'growth'
  | 'culture'
  | 'economic'
  | 'military_power'
  | 'expansionist'
  | 'naval_power'
  | 'isolationist'
  | 'homeland_defense'
  | 'france_libre'
  | 'new_roman_empire'
  | 'poland_shall_endure';

export interface AINationalAgenda {
  readonly id: AINationalAgendaId;
  readonly name: string;
  readonly description: string;
  readonly strategyBias: Partial<Record<string, number>>;
}
