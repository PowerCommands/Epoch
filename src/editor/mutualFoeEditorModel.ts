import { ALL_LEADERS } from '../data/leaders';
import type { MutualFoeAgreement } from '../types/mutualFoe';
import { validateMutualFoeAgreements } from '../systems/MutualFoeAgreementValidation';

export { validateMutualFoeAgreements };
export function mutualFoeLeaderOptions(nations: readonly { id: string; name: string }[]) {
  return ALL_LEADERS.flatMap(leader => {
    const nation = nations.find(n => n.id === leader.nationId);
    return nation ? [{ id: leader.id, nationId: nation.id, label: `${leader.name} — ${nation.name}` }] : [];
  });
}
export function newMutualFoeAgreement(existing: readonly MutualFoeAgreement[]): MutualFoeAgreement {
  let index = 1;
  while (existing.some(a => a.id === `mutual_foe_${index}`)) index++;
  return { id: `mutual_foe_${index}`, name: 'Mutual Foe Agreement', antagonistNationId: '', supportPercent: 20, memberLeaderIds: [] };
}
export function saveMutualFoeAgreement(
  agreements: readonly MutualFoeAgreement[], agreement: MutualFoeAgreement, nations: readonly { id: string }[],
): { agreements: MutualFoeAgreement[]; errors: string[] } {
  const next = agreements.some(a => a.id === agreement.id)
    ? agreements.map(a => a.id === agreement.id ? agreement : a) : [...agreements, agreement];
  return validateMutualFoeAgreements(next, nations);
}
export function removeMutualFoeAgreement(agreements: readonly MutualFoeAgreement[], id: string): MutualFoeAgreement[] {
  return agreements.filter(a => a.id !== id);
}
