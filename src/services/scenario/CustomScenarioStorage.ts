import type { ScenarioData } from '../../types/scenario';

export const CUSTOM_SCENARIO_STORAGE_KEY = 'epoch.customScenarios';
export const CUSTOM_SCENARIO_ID_PREFIX = 'custom-';

export type ScenarioDefinition = ScenarioData;

export interface CustomScenarioMetadata {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  sourceScenarioId?: string;
  sourceScenarioName?: string;
}

export interface CustomScenarioEntry {
  metadata: CustomScenarioMetadata;
  scenario: ScenarioDefinition;
}

export interface SaveCustomScenarioOptions {
  id?: string;
  name: string;
  scenario: ScenarioDefinition;
  sourceScenarioId?: string;
  sourceScenarioName?: string;
}

export class CustomScenarioStorage {
  static loadAll(): CustomScenarioEntry[] {
    try {
      const raw = window.localStorage.getItem(CUSTOM_SCENARIO_STORAGE_KEY);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      if (!isRecord(parsed) || !Array.isArray(parsed.entries)) return [];

      return parsed.entries
        .filter(isCustomScenarioEntry)
        .sort((a, b) => b.metadata.updatedAt - a.metadata.updatedAt);
    } catch (err) {
      console.warn('Failed to load custom scenarios.', err);
      return [];
    }
  }

  static getById(id: string): CustomScenarioEntry | null {
    return CustomScenarioStorage.loadAll().find((entry) => entry.metadata.id === id) ?? null;
  }

  static save(options: SaveCustomScenarioOptions): CustomScenarioEntry {
    const entries = CustomScenarioStorage.loadAll();
    const existing = options.id
      ? entries.find((entry) => entry.metadata.id === options.id)
      : undefined;
    const now = Date.now();
    const id = existing?.metadata.id ?? options.id ?? CustomScenarioStorage.generateId();
    const metadata: CustomScenarioMetadata = {
      id,
      name: options.name.trim(),
      createdAt: existing?.metadata.createdAt ?? now,
      updatedAt: now,
      sourceScenarioId: existing?.metadata.sourceScenarioId ?? options.sourceScenarioId,
      sourceScenarioName: existing?.metadata.sourceScenarioName ?? options.sourceScenarioName,
    };
    const saved: CustomScenarioEntry = {
      metadata,
      scenario: cloneScenario(options.scenario),
    };
    const nextEntries = [
      saved,
      ...entries.filter((entry) => entry.metadata.id !== id),
    ];

    window.localStorage.setItem(
      CUSTOM_SCENARIO_STORAGE_KEY,
      JSON.stringify({ version: 1, entries: nextEntries }),
    );

    return saved;
  }

  static delete(id: string): void {
    const entries = CustomScenarioStorage.loadAll().filter((entry) => entry.metadata.id !== id);
    window.localStorage.setItem(
      CUSTOM_SCENARIO_STORAGE_KEY,
      JSON.stringify({ version: 1, entries }),
    );
  }

  static generateId(): string {
    const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    return `${CUSTOM_SCENARIO_ID_PREFIX}${uuid}`;
  }
}

function cloneScenario(scenario: ScenarioDefinition): ScenarioDefinition {
  return JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
}

function isCustomScenarioEntry(value: unknown): value is CustomScenarioEntry {
  if (!isRecord(value) || !isRecord(value.metadata) || !isScenarioData(value.scenario)) return false;
  const metadata = value.metadata;
  return typeof metadata.id === 'string'
    && metadata.id.startsWith(CUSTOM_SCENARIO_ID_PREFIX)
    && typeof metadata.name === 'string'
    && metadata.name.trim().length > 0
    && typeof metadata.createdAt === 'number'
    && typeof metadata.updatedAt === 'number';
}

function isScenarioData(value: unknown): value is ScenarioData {
  if (!isRecord(value) || !isRecord(value.meta) || !isRecord(value.map)) return false;
  return typeof value.meta.name === 'string'
    && typeof value.meta.version === 'number'
    && typeof value.map.width === 'number'
    && typeof value.map.height === 'number'
    && typeof value.map.tileSize === 'number'
    && Array.isArray(value.map.tiles)
    && Array.isArray(value.nations)
    && Array.isArray(value.cities)
    && Array.isArray(value.units);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
