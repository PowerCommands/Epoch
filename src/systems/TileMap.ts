import Phaser from 'phaser';
import { MapData, Tile, TileType } from '../types/map';

/** Hex-färger per tile-typ, utan #-prefix (Phaser använder 0x-notation). */
const TILE_COLORS: Record<TileType, number> = {
  [TileType.Ocean]:    0x1e3a5f,
  [TileType.Coast]:    0x4a7ba6,
  [TileType.Plains]:   0x6b8e4e,
  [TileType.Forest]:   0x3d5a2e,
  [TileType.Mountain]: 0x6b6b6b,
};

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
   * Renderar kartan med ett enda Graphics-objekt.
   * Ett Graphics-objekt är mer effektivt än tusentals enskilda rektanglar
   * eftersom det bara kräver ett enda draw-call.
   */
  private render(scene: Phaser.Scene): void {
    const { width, height, tileSize, tiles } = this.data;
    const gfx = scene.add.graphics();

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = tiles[y][x];
        const px = x * tileSize;
        const py = y * tileSize;

        // Fyll tile med rätt färg
        gfx.fillStyle(TILE_COLORS[tile.type], 1);
        gfx.fillRect(px, py, tileSize, tileSize);
      }
    }

    // Rita grid-linjer i ett separat pass så de alltid syns ovanpå fyllningarna
    gfx.lineStyle(1, 0x000000, 0.25);
    for (let y = 0; y <= height; y++) {
      gfx.beginPath();
      gfx.moveTo(0, y * tileSize);
      gfx.lineTo(width * tileSize, y * tileSize);
      gfx.strokePath();
    }
    for (let x = 0; x <= width; x++) {
      gfx.beginPath();
      gfx.moveTo(x * tileSize, 0);
      gfx.lineTo(x * tileSize, height * tileSize);
      gfx.strokePath();
    }
  }
}
