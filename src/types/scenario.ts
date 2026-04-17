export interface ScenarioMeta {
  name: string;
  version: number;
}

export interface ScenarioMap {
  width: number;
  height: number;
  tileSize: number;
  tiles: { q: number; r: number; type: string }[];
}

export interface ScenarioNation {
  id: string;
  name: string;
  color: string;
  isHuman: boolean;
  startTerritoryCenter: { q: number; r: number };
}

export interface ScenarioCity {
  id: string;
  name: string;
  nationId: string;
  q: number;
  r: number;
  isCapital: boolean;
}

export interface ScenarioUnit {
  nationId: string;
  unitTypeId: string;
  q: number;
  r: number;
}

export interface ScenarioData {
  meta: ScenarioMeta;
  map: ScenarioMap;
  nations: ScenarioNation[];
  cities: ScenarioCity[];
  units: ScenarioUnit[];
}
