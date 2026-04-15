export interface ScenarioMeta {
  name: string;
  version: number;
}

export interface ScenarioMap {
  width: number;
  height: number;
  tileSize: number;
  tiles: { x: number; y: number; type: string }[];
}

export interface ScenarioNation {
  id: string;
  name: string;
  color: string;
  isHuman: boolean;
  startTerritoryCenter: { x: number; y: number };
}

export interface ScenarioCity {
  id: string;
  name: string;
  nationId: string;
  tileX: number;
  tileY: number;
  isCapital: boolean;
}

export interface ScenarioUnit {
  nationId: string;
  unitTypeId: string;
  tileX: number;
  tileY: number;
}

export interface ScenarioData {
  meta: ScenarioMeta;
  map: ScenarioMap;
  nations: ScenarioNation[];
  cities: ScenarioCity[];
  units: ScenarioUnit[];
}
