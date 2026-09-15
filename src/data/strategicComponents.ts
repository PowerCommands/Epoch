/** Strategic components are national inventory, never independent map units. */
export interface StrategicComponentDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly productionCost: number;
  readonly requiredTechId: string;
  readonly requiredResource: { readonly resourceId: string; readonly amount: number };
}

export const NUCLEAR_WARHEAD: StrategicComponentDefinition = {
  id: 'nuclear_warhead',
  name: 'Nuclear Warhead',
  description: 'Produce one Nuclear Warhead for the national stockpile. Mount it on a conventional ICBM at a Missile Launch Pad to give it Nuclear Missile destructive power.',
  productionCost: 1800,
  requiredTechId: 'nuclear_fission',
  requiredResource: { resourceId: 'uranium', amount: 1 },
};

export const STRATEGIC_COMPONENTS: readonly StrategicComponentDefinition[] = [NUCLEAR_WARHEAD];

export function getStrategicComponentById(id: string): StrategicComponentDefinition | undefined {
  return STRATEGIC_COMPONENTS.find(component => component.id === id);
}

export function normalizeNuclearWarheads(quantity: number | undefined): number {
  return Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity!)) : 0;
}
