export interface MapDefinition {
  key: string;
  label: string;
  file: string;
}

export interface MapManifest {
  maps: MapDefinition[];
}

export const MAP_MANIFEST_CACHE_KEY = 'map_manifest';
export const MAP_MANIFEST_URL = 'assets/maps/manifest.json';

export function parseMapManifest(value: unknown): MapManifest {
  if (!isRecord(value) || !Array.isArray(value.maps)) return { maps: [] };

  return {
    maps: value.maps.filter(isMapDefinition),
  };
}

function isMapDefinition(value: unknown): value is MapDefinition {
  if (!isRecord(value)) return false;
  return typeof value.key === 'string'
    && typeof value.label === 'string'
    && typeof value.file === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
