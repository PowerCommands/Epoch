import type { IdeologyId } from '../types/ideology';
import { DEFAULT_IDEOLOGY_ID } from './ideologies';

type IdeologyCompatibilityMatrix = Record<IdeologyId, Partial<Record<IdeologyId, number>>>;

const IDEOLOGY_IDS: readonly IdeologyId[] = [
  'liberalism',
  'conservatism',
  'nationalism',
  'globalism',
  'militarism',
  'traditionalism',
  'progressivism',
];
const IDEOLOGY_ID_SET: ReadonlySet<string> = new Set(IDEOLOGY_IDS);

const IDEOLOGY_COMPATIBILITY: IdeologyCompatibilityMatrix = {
  liberalism: {
    liberalism: 30,
    conservatism: -10,
    nationalism: -15,
    globalism: 30,
    militarism: -30,
    traditionalism: -20,
    progressivism: 25,
  },
  conservatism: {
    liberalism: -10,
    conservatism: 30,
    nationalism: 18,
    globalism: -18,
    militarism: 4,
    traditionalism: 26,
    progressivism: -22,
  },
  nationalism: {
    liberalism: -15,
    conservatism: 18,
    nationalism: 30,
    globalism: -32,
    militarism: 12,
    traditionalism: 20,
    progressivism: -12,
  },
  globalism: {
    liberalism: 30,
    conservatism: -18,
    nationalism: -32,
    globalism: 30,
    militarism: -36,
    traditionalism: -24,
    progressivism: 28,
  },
  militarism: {
    liberalism: -30,
    conservatism: 4,
    nationalism: 12,
    globalism: -36,
    militarism: 30,
    traditionalism: 2,
    progressivism: -28,
  },
  traditionalism: {
    liberalism: -20,
    conservatism: 26,
    nationalism: 20,
    globalism: -24,
    militarism: 2,
    traditionalism: 30,
    progressivism: -26,
  },
  progressivism: {
    liberalism: 25,
    conservatism: -22,
    nationalism: -12,
    globalism: 28,
    militarism: -28,
    traditionalism: -26,
    progressivism: 30,
  },
};

export const IDEOLOGY_COMPATIBILITY_MATRIX: Readonly<IdeologyCompatibilityMatrix> = IDEOLOGY_COMPATIBILITY;

export function getIdeologyCompatibility(source: IdeologyId, target: IdeologyId): number {
  return IDEOLOGY_COMPATIBILITY[source][target]
    ?? IDEOLOGY_COMPATIBILITY[target][source]
    ?? 0;
}

export function getIdeologyCompatibilitySafe(
  source: IdeologyId | string | undefined,
  target: IdeologyId | string | undefined,
): number {
  const safeSource = isIdeologyId(source) ? source : DEFAULT_IDEOLOGY_ID;
  const safeTarget = isIdeologyId(target) ? target : DEFAULT_IDEOLOGY_ID;
  return getIdeologyCompatibility(safeSource, safeTarget);
}

export function describeIdeologyCompatibility(score: number): string {
  if (score >= 25) return 'strong alignment';
  if (score >= 10) return 'alignment';
  if (score > -10) return 'neutral';
  if (score > -25) return 'tension';
  return 'strong tension';
}

function isIdeologyId(value: string | undefined): value is IdeologyId {
  return value !== undefined && IDEOLOGY_ID_SET.has(value);
}
