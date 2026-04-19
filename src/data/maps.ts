export interface MapDefinition {
  key: string;
  label: string;
  file: string;
}

export const AVAILABLE_MAPS: MapDefinition[] = [
  { key: 'map_europe', label: 'Europe 1400', file: 'assets/maps/europeScenario.json' },
  { key: 'map_simple_grassland_12x12', label: 'Simple grassland 12x12', file: 'assets/maps/simpleGrassland12x12.json' },
];
