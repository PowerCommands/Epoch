import { getCultureNodeById } from './cultureTree';
import { getTechnologyById, type Era } from './technologies';

export interface EraTimelineEntry {
  era: Era;
  startYear: number;
  endYear: number;
}

export const ERA_TIMELINE: readonly EraTimelineEntry[] = [
  { era: 'ancient', startYear: -4000, endYear: -1000 },
  { era: 'classical', startYear: -1000, endYear: 500 },
  { era: 'medieval', startYear: 500, endYear: 1400 },
  { era: 'renaissance', startYear: 1400, endYear: 1700 },
  { era: 'industrial', startYear: 1700, endYear: 1900 },
  { era: 'modern', startYear: 1900, endYear: 1945 },
  { era: 'atomic', startYear: 1945, endYear: 1990 },
  { era: 'information', startYear: 1990, endYear: 2200 },
  { era: 'future', startYear: 2200, endYear: 2400 },
];

const ERA_ORDER: readonly Era[] = ERA_TIMELINE.map((entry) => entry.era);

export function getEraTimelineEntry(era: Era): EraTimelineEntry | undefined {
  return ERA_TIMELINE.find((entry) => entry.era === era);
}

export function getEraIndex(era: Era): number {
  return ERA_ORDER.indexOf(era);
}

export function getExpectedYearForEra(era: Era): number {
  const entry = getEraTimelineEntry(era);
  if (!entry) return -2500;
  return Math.round((entry.startYear + entry.endYear) / 2);
}

export interface EraEstimateInputs {
  researchedTechIds: readonly string[];
  unlockedCultureIds: readonly string[];
}

export function getEstimatedEraFromProgress(progress: EraEstimateInputs): Era {
  let highestIndex = 0;

  for (const techId of progress.researchedTechIds) {
    const tech = getTechnologyById(techId);
    if (!tech) continue;
    const index = getEraIndex(tech.era);
    if (index > highestIndex) highestIndex = index;
  }

  for (const cultureId of progress.unlockedCultureIds) {
    const node = getCultureNodeById(cultureId);
    if (!node) continue;
    const index = getEraIndex(node.era);
    if (index > highestIndex) highestIndex = index;
  }

  return ERA_ORDER[highestIndex];
}
