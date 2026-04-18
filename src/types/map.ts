export enum TileType {
  Ocean = 'ocean',
  Plains = 'plains',
  Forest = 'forest',
  Mountain = 'mountain',
  Coast = 'coast',
  Ice = 'ice',
  Jungle = 'jungle',
  Desert = 'desert',
}

export interface Tile {
  x: number; // grid-koordinat (kolumn)
  y: number; // grid-koordinat (rad)
  type: TileType;
  ownerId?: string; // referens till Nation.id; undefined = oclaimat
  improvementId?: string; // optional tile improvement; undefined = none
}

export interface MapData {
  width: number;   // antal tiles horisontellt
  height: number;  // antal tiles vertikalt
  tileSize: number; // legacy scenario scale; hex layout treats this as hex diameter
  tiles: Tile[][]; // indexerat [y][x]
}
