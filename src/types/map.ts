export enum TileType {
  Ocean = 'ocean',
  Plains = 'plains',
  Forest = 'forest',
  Mountain = 'mountain',
  Coast = 'coast',
  Ice = 'ice',
  Jungle = 'jungle',
  Desert = 'desert',
  // Visual variants of Plains. Gameplay-identical to Plains for now; added for
  // map variety. Keep their rules mirrored on Plains wherever Plains is handled.
  Beach = 'beach',
  Meadow = 'meadow',
}

export interface TileBuildingConstruction {
  buildingId: string;
  cityId: string;
}

export interface TileWonderConstruction {
  wonderId: string;
  cityId: string;
}

export interface TileImprovementConstruction {
  improvementId: string;
  cityId?: string;
  unitId: string;
  ownerId: string;
  resourceOwnerNationId?: string;
  remainingTurns: number;
  totalTurns: number;
}

export interface Tile {
  x: number; // grid-koordinat (kolumn)
  y: number; // grid-koordinat (rad)
  type: TileType;
  ownerId?: string; // referens till Nation.id; undefined = oclaimat
  resourceOwnerNationId?: string; // resource-only claim; does not make the tile city territory
  resourceId?: string; // optional natural resource; undefined = none
  improvementId?: string; // optional tile improvement; undefined = none
  /** Economic owner of the completed improvement; independent of territorial ownerId. */
  improvementOwnerId?: string;
  improvementConstruction?: TileImprovementConstruction; // in-progress worker improvement
  buildingId?: string; // finished tile building; undefined = none
  buildingBroken?: boolean; // true = the tile's standalone buildingId is broken/ruined (e.g. a razed Barbarian Camp). City buildings track broken state in CityBuildings, not here.
  buildingConstruction?: TileBuildingConstruction; // reserved/under-construction tile building
  wonderId?: string; // finished wonder; undefined = none
  wonderConstruction?: TileWonderConstruction; // reserved/under-construction wonder
  cultureOwnerId?: string; // culturally dominating nation (independent of territory ownerId)
  cultureSourceCityId?: string; // city that originally/most recently culturally claimed this tile
}

export interface MapData {
  width: number;   // antal tiles horisontellt
  height: number;  // antal tiles vertikalt
  tileSize: number; // legacy scenario scale; hex layout treats this as hex diameter
  tiles: Tile[][]; // indexerat [y][x]
}
