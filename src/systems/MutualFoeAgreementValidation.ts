import { ALL_LEADERS } from '../data/leaders';
import type { MutualFoeAgreement } from '../types/mutualFoe';

/** Shared by the runtime loader and editor; never consults mutable active-leader selections. */
export function validateMutualFoeAgreements(
  input: unknown,
  nations: readonly { id: string }[],
): { agreements: MutualFoeAgreement[]; errors: string[] } {
  const agreements: MutualFoeAgreement[] = [];
  const errors: string[] = [];
  if (input === undefined) return { agreements, errors };
  if (!Array.isArray(input)) return { agreements, errors: ['Mutual Foe Agreements must be a list.'] };
  const nationIds = new Set(nations.map(n => n.id));
  const ids = new Set<string>();
  for (const [index, item] of input.entries()) {
    const problems: string[] = [];
    const a = item as Partial<MutualFoeAgreement> | null;
    if (!a || typeof a !== 'object') { errors.push(`Agreement ${index + 1}: invalid definition.`); continue; }
    if (typeof a.id !== 'string' || !a.id.trim() || a.id !== a.id.trim()) problems.push('a stable non-empty ID is required');
    else if (ids.has(a.id)) problems.push('ID must be unique');
    if (typeof a.id === 'string') ids.add(a.id);
    if (typeof a.name !== 'string' || !a.name.trim()) problems.push('name is required');
    if (typeof a.antagonistNationId !== 'string' || !nationIds.has(a.antagonistNationId)) problems.push('antagonist must be a scenario nation');
    if (typeof a.supportPercent !== 'number' || !Number.isFinite(a.supportPercent) || a.supportPercent < 0 || a.supportPercent > 100) problems.push('support must be between 0 and 100%');
    if (!Array.isArray(a.memberLeaderIds) || a.memberLeaderIds.length < 2) problems.push('at least two member leaders are required');
    else {
      const seenLeaders = new Set<string>();
      const seenNations = new Set<string>();
      for (const id of a.memberLeaderIds) {
        const leader = ALL_LEADERS.find(l => l.id === id);
        if (typeof id !== 'string' || !leader) { problems.push(`unknown leader: ${String(id)}`); continue; }
        if (seenLeaders.has(id)) problems.push('member leaders must be unique');
        if (seenNations.has(leader.nationId)) problems.push('only one leader per member nation is allowed');
        if (!nationIds.has(leader.nationId)) problems.push(`${leader.name}'s nation is not in the scenario`);
        if (leader.nationId === a.antagonistNationId) problems.push('the antagonist cannot be a member');
        seenLeaders.add(id); seenNations.add(leader.nationId);
      }
    }
    if (problems.length) errors.push(`Agreement ${index + 1}: ${problems.join('; ')}.`);
    else agreements.push({ id: a.id!, name: a.name!.trim(), antagonistNationId: a.antagonistNationId!, supportPercent: a.supportPercent!, memberLeaderIds: [...a.memberLeaderIds!] });
  }
  return { agreements, errors };
}
