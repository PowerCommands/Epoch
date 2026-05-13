import { getNaturalResourceById } from '../data/naturalResources';
import type {
  HappinessState,
  LuxuryResourceEntry,
  NationHappiness,
} from '../entities/NationHappiness';

export function formatPercent(modifier: number): string {
  const pct = Math.round((modifier - 1) * 100);
  return pct < 0 ? `${pct}%` : `+${pct}%`;
}

export function formatSignedNumber(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

export function formatHappinessStateLabel(state: HappinessState): string {
  switch (state) {
    case 'golden_age': return 'Golden Age';
    case 'prosperous': return 'Prosperous';
    case 'happy': return 'Happy';
    case 'stable': return 'Stable';
    case 'unhappy': return 'Unhappy';
    case 'very_unhappy': return 'Very Unhappy';
    case 'unrest': return 'Unrest';
    case 'crisis': return 'Crisis';
  }
}

export function happinessStateColor(state: HappinessState): string {
  switch (state) {
    case 'golden_age':
    case 'prosperous':
    case 'happy':
      return '#7fbf6a';
    case 'stable':
      return '#f4f1e7';
    case 'unhappy':
    case 'very_unhappy':
    case 'unrest':
    case 'crisis':
      return '#d96a6a';
  }
}

export function buildHappinessTooltip(happiness: Readonly<NationHappiness>): string {
  const lines: string[] = [];
  lines.push(`Happiness: ${formatSignedNumber(happiness.netHappiness)} — ${formatHappinessStateLabel(happiness.state)}`);
  lines.push('');
  lines.push('Sources:');
  lines.push(`Base: ${formatSignedNumber(happiness.happinessFromBase)}`);
  lines.push(`Buildings: ${formatSignedNumber(happiness.happinessFromBuildings)}`);
  lines.push(`Wonders: ${formatSignedNumber(happiness.happinessFromWonders)}`);
  lines.push(`Corporations: ${formatSignedNumber(happiness.happinessFromCorporations)}`);
  lines.push(`Luxury resources: ${formatSignedNumber(happiness.happinessFromLuxuryResources)}`);
  for (const label of luxuryResourceLabels(happiness.availableLuxuryResourceQuantities)) {
    lines.push(`  • ${label}`);
  }
  lines.push('');
  lines.push('Unhappiness:');
  lines.push(`Cities: -${happiness.unhappinessFromCities}`);
  lines.push(`Population: -${happiness.unhappinessFromPopulation}`);
  lines.push('');
  lines.push('Effects:');
  lines.push(`Growth: ${formatPercent(happiness.growthModifier)}`);
  lines.push(`Production: ${formatPercent(happiness.productionModifier)}`);
  lines.push(`Culture: ${formatPercent(happiness.cultureModifier)}`);
  lines.push(`Gold: ${formatPercent(happiness.goldModifier)}`);
  return lines.join('\n');
}

export function luxuryResourceNames(ids: readonly string[]): string[] {
  return ids.map((id) => getNaturalResourceById(id)?.name ?? id);
}

export function luxuryResourceLabels(
  entries: ReadonlyArray<LuxuryResourceEntry>,
): string[] {
  return entries.map((entry) => {
    const name = getNaturalResourceById(entry.resourceId)?.name ?? entry.resourceId;
    return entry.quantity > 1 ? `${name} x${entry.quantity}` : name;
  });
}
