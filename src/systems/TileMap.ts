import Phaser from 'phaser';
import { MapData, Tile, TileType } from '../types/map';

/** Map TileType enum to terrain sprite texture key. */
const TILE_TEXTURES: Record<TileType, string> = {
  [TileType.Ocean]:    'terrain_ocean',
  [TileType.Coast]:    'terrain_coast',
  [TileType.Plains]:   'terrain_plains',
  [TileType.Forest]:   'terrain_forest',
  [TileType.Mountain]: 'terrain_mountain',
  [TileType.Ice]:      'terrain_ice',
  [TileType.Jungle]:   'terrain_jungle',
  [TileType.Desert]:   'terrain_desert',
};

const TERRAIN_DEPTH = 0;

/**
 * TileMap ansvarar för att hålla kartdata och rendera den till scenen.
 *
 * Designprincip: Den publika API:n är avsiktligt frikopplad från Phaser-
 * detaljer. Renderingsimplementationen (Graphics vs. rektanglar) är en
 * intern detalj som kan bytas ut, och `generatePlaceholder` är den enda
 * fabriksmetod som behöver ändras när vi byter till GeoJSON-baserad data.
 */
export class TileMap {
  private readonly data: MapData;

  constructor(scene: Phaser.Scene, data: MapData) {
    this.data = data;
    this.render(scene);
  }

  /** Kartans totala pixelstorlek i världskoordinater. */
  getWorldBounds(): { width: number; height: number } {
    return {
      width: this.data.width * this.data.tileSize,
      height: this.data.height * this.data.tileSize,
    };
  }

  /** Tile-storleken i pixlar. Används av bl.a. SelectionManager för highlight-rendering. */
  getTileSize(): number {
    return this.data.tileSize;
  }

  /**
   * Konvertera världskoordinater till den tile som finns på den positionen.
   * Returnerar null om koordinaten ligger utanför kartan.
   */
  worldToTile(worldX: number, worldY: number): Tile | null {
    const tx = Math.floor(worldX / this.data.tileSize);
    const ty = Math.floor(worldY / this.data.tileSize);

    return this.getTileAt(tx, ty);
  }

  /**
   * Hämta tile via gridkoordinater. Returnerar null utanför kartans gränser.
   */
  getTileAt(tileX: number, tileY: number): Tile | null {
    if (tileX < 0 || tileY < 0 || tileX >= this.data.width || tileY >= this.data.height) {
      return null;
    }

    return this.data.tiles[tileY][tileX];
  }

  /**
   * Konvertera tile-gridkoordinater till tilens centerposition i världskoordinater.
   */
  tileToWorld(tileX: number, tileY: number): { x: number; y: number } {
    const half = this.data.tileSize / 2;
    return {
      x: tileX * this.data.tileSize + half,
      y: tileY * this.data.tileSize + half,
    };
  }

  /**
   * Genererar en reproducerbar placeholder-karta.
   *
   * Layout:
   * - Yttersta raden runt om: Ocean
   * - Näst yttersta raden: Coast
   * - Inre tiles: deterministisk blandning av Plains, Forest, Mountain
   *   baserat på ett enkelt hash-mönster (inga externa beroenden, alltid
   *   samma resultat för samma bredd/höjd).
   */
  static generatePlaceholder(width: number, height: number, tileSize: number): MapData {
    const tiles: Tile[][] = [];

    for (let y = 0; y < height; y++) {
      const row: Tile[] = [];
      for (let x = 0; x < width; x++) {
        row.push({ x, y, type: TileMap.pickTileType(x, y, width, height) });
      }
      tiles.push(row);
    }

    return { width, height, tileSize, tiles };
  }

  // ─── Privata hjälpmetoder ──────────────────────────────────────────────────

  private static pickTileType(x: number, y: number, w: number, h: number): TileType {
    const isOuterEdge =
      x === 0 || y === 0 || x === w - 1 || y === h - 1;
    const isCoastEdge =
      x === 1 || y === 1 || x === w - 2 || y === h - 2;

    if (isOuterEdge) return TileType.Ocean;
    if (isCoastEdge) return TileType.Coast;

    // Deterministiskt "organiskt" mönster utan slumpgenerator:
    // multiplicera koordinaterna med oreltade primtal och kombinera dem
    // till ett index i en fix fördelning.
    const hash = (x * 7 + y * 13 + x * y * 3) % 10;
    if (hash < 4) return TileType.Plains;   // 40 %
    if (hash < 7) return TileType.Forest;   // 30 %
    return TileType.Mountain;               // 30 %
  }

  /**
   * Renders the map using one sprite per tile.
   * Sprites are placed at top-left origin and set to lowest depth.
   */
  private render(scene: Phaser.Scene): void {
    const { width, height, tileSize, tiles } = this.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = tiles[y][x];
        const px = x * tileSize;
        const py = y * tileSize;

        const img = scene.add.image(px, py, TILE_TEXTURES[tile.type]);
        img.setOrigin(0, 0);
        img.setDepth(TERRAIN_DEPTH);
      }
    }
  }
}
