export interface MapDefinition {
  key: string;
  label: string;
  file: string;
}

export const AVAILABLE_MAPS: MapDefinition[] = [
  { key: 'map_europe', label: 'Europe 1400', file: 'europeScenario.json' },
];
