import { mkdir, writeFile } from 'node:fs/promises';
import { get } from 'node:https';
import { dirname, resolve } from 'node:path';

type TileType = 'ocean' | 'plains' | 'forest' | 'mountain' | 'coast';

interface OutputTile {
  x: number;
  y: number;
  type: TileType;
}

interface OutputMap {
  width: number;
  height: number;
  tiles: OutputTile[];
}

type Position = [number, number];
type Ring = Position[];
type PolygonCoordinates = Ring[];
type MultiPolygonCoordinates = PolygonCoordinates[];

type GeoJsonGeometry =
  | { type: 'Polygon'; coordinates: PolygonCoordinates }
  | { type: 'MultiPolygon'; coordinates: MultiPolygonCoordinates };

interface GeoJsonFeature {
  type: 'Feature';
  geometry: GeoJsonGeometry | null;
}

interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

interface Bounds {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

interface PreparedPolygon {
  outer: Ring;
  holes: Ring[];
  bounds: Bounds;
}

interface Region {
  name: string;
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

const LAND_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson';

const WIDTH = 200;
const HEIGHT = 120;
const EXPECTED_TILE_COUNT = WIDTH * HEIGHT;

const MAP_BOUNDS: Bounds = {
  minLon: -12,
  maxLon: 42,
  minLat: 30,
  maxLat: 72,
};

const MOUNTAIN_REGIONS: Region[] = [
  { name: 'Alps', minLon: 6, maxLon: 15, minLat: 44, maxLat: 48 },
  { name: 'Pyrenees', minLon: -2, maxLon: 3, minLat: 42, maxLat: 44 },
  { name: 'Carpathians', minLon: 17, maxLon: 27, minLat: 47, maxLat: 50 },
  { name: 'Scandinavian', minLon: 14, maxLon: 28, minLat: 60, maxLat: 70 },
  { name: 'Anatolian', minLon: 28, maxLon: 40, minLat: 37, maxLat: 42 },
  { name: 'Scottish Highlands', minLon: -6, maxLon: -2, minLat: 56, maxLat: 59 },
];

const FOREST_REGIONS: Region[] = [
  { name: 'Scandinavia', minLon: 5, maxLon: 30, minLat: 56, maxLat: 68 },
  { name: 'Central EU', minLon: 8, maxLon: 18, minLat: 47, maxLat: 54 },
  { name: 'Poland/Baltic', minLon: 16, maxLon: 24, minLat: 51, maxLat: 56 },
  { name: 'Black Forest', minLon: 7, maxLon: 9, minLat: 47, maxLat: 49 },
];

async function main(): Promise<void> {
  console.log(`Fetching land GeoJSON: ${LAND_URL}`);
  const geoJson = await fetchGeoJson(LAND_URL);
  const polygons = preparePolygons(geoJson);

  console.log(`Prepared ${polygons.length} land polygons.`);

  const rows = buildBaseRows(polygons);
  markCoasts(rows);
  addForests(rows);

  const tiles = flattenRows(rows);
  validateTileCount(tiles);

  const output: OutputMap = {
    width: WIDTH,
    height: HEIGHT,
    tiles,
  };

  const outputPath = resolve(process.cwd(), 'public/europeMap.json');
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  logCounts(tiles);
  console.log(`Wrote ${outputPath}`);
}

async function fetchGeoJson(url: string): Promise<GeoJsonFeatureCollection> {
  try {
    const body = await fetchText(url);
    return JSON.parse(body) as GeoJsonFeatureCollection;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch GeoJSON from ${url}: ${message}`);
  }
}

async function fetchText(url: string): Promise<string> {
  if (typeof fetch === 'function') {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return response.text();
  }

  return fetchTextWithHttps(url);
}

function fetchTextWithHttps(url: string): Promise<string> {
  return new Promise((resolveText, reject) => {
    get(url, (response) => {
      const statusCode = response.statusCode ?? 0;

      if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
        fetchTextWithHttps(response.headers.location).then(resolveText, reject);
        return;
      }

      if (statusCode < 200 || statusCode >= 300) {
        reject(new Error(`HTTP ${statusCode}`));
        response.resume();
        return;
      }

      response.setEncoding('utf8');

      let data = '';
      response.on('data', (chunk: string) => {
        data += chunk;
      });
      response.on('end', () => resolveText(data));
    }).on('error', reject);
  });
}

function preparePolygons(geoJson: GeoJsonFeatureCollection): PreparedPolygon[] {
  const polygons: PreparedPolygon[] = [];

  for (const feature of geoJson.features) {
    if (!feature.geometry) continue;

    if (feature.geometry.type === 'Polygon') {
      const polygon = preparePolygon(feature.geometry.coordinates);
      if (polygon) polygons.push(polygon);
      continue;
    }

    for (const coordinates of feature.geometry.coordinates) {
      const polygon = preparePolygon(coordinates);
      if (polygon) polygons.push(polygon);
    }
  }

  return polygons.filter((polygon) => boundsOverlap(polygon.bounds, MAP_BOUNDS));
}

function preparePolygon(coordinates: PolygonCoordinates): PreparedPolygon | null {
  const [outer, ...holes] = coordinates;
  if (!outer || outer.length < 3) return null;

  return {
    outer,
    holes,
    bounds: getRingBounds(outer),
  };
}

function buildBaseRows(polygons: PreparedPolygon[]): TileType[][] {
  const rows: TileType[][] = [];

  for (let y = 0; y < HEIGHT; y += 1) {
    if (y % 10 === 0) {
      console.log(`Processing row ${y + 1}/${HEIGHT}...`);
    }

    const row: TileType[] = [];

    for (let x = 0; x < WIDTH; x += 1) {
      const { lon, lat } = tileCenterToLonLat(x, y);
      const isLand = isPointOnLand(lon, lat, polygons);
      row.push(isLand ? getLandTileType(lon, lat) : 'ocean');
    }

    rows.push(row);
  }

  return rows;
}

function markCoasts(rows: TileType[][]): void {
  const original = rows.map((row) => [...row]);

  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if (original[y][x] === 'ocean') continue;

      if (hasOceanNeighbor(original, x, y)) {
        rows[y][x] = 'coast';
      }
    }
  }
}

function addForests(rows: TileType[][]): void {
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if (rows[y][x] !== 'plains') continue;

      const { lon, lat } = tileCenterToLonLat(x, y);
      if (isForestTile(lon, lat, x, y)) {
        rows[y][x] = 'forest';
      }
    }
  }
}

function flattenRows(rows: TileType[][]): OutputTile[] {
  const tiles: OutputTile[] = [];

  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      tiles.push({ x, y, type: rows[y][x] });
    }
  }

  return tiles;
}

function validateTileCount(tiles: OutputTile[]): void {
  if (tiles.length !== EXPECTED_TILE_COUNT) {
    throw new Error(`Invalid tile count: expected ${EXPECTED_TILE_COUNT}, got ${tiles.length}`);
  }
}

function logCounts(tiles: OutputTile[]): void {
  const counts: Record<TileType, number> = {
    ocean: 0,
    plains: 0,
    coast: 0,
    forest: 0,
    mountain: 0,
  };

  for (const tile of tiles) {
    counts[tile.type] += 1;
  }

  console.log(
    `Final counts: ocean ${counts.ocean}, plains ${counts.plains}, coast ${counts.coast}, forest ${counts.forest}, mountain ${counts.mountain} tiles`,
  );
}

function tileCenterToLonLat(x: number, y: number): { lon: number; lat: number } {
  const lonRange = MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon;
  const latRange = MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat;

  return {
    lon: MAP_BOUNDS.minLon + ((x + 0.5) / WIDTH) * lonRange,
    lat: MAP_BOUNDS.maxLat - ((y + 0.5) / HEIGHT) * latRange,
  };
}

function isPointOnLand(lon: number, lat: number, polygons: PreparedPolygon[]): boolean {
  for (const polygon of polygons) {
    if (!pointInBounds(lon, lat, polygon.bounds)) continue;
    if (!pointInRing(lon, lat, polygon.outer)) continue;

    const insideHole = polygon.holes.some((hole) => pointInRing(lon, lat, hole));
    if (!insideHole) return true;
  }

  return false;
}

function pointInRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [lonI, latI] = ring[i];
    const [lonJ, latJ] = ring[j];
    const crossesRay = latI > lat !== latJ > lat;

    if (!crossesRay) continue;

    const intersectionLon = ((lonJ - lonI) * (lat - latI)) / (latJ - latI) + lonI;
    if (lon < intersectionLon) {
      inside = !inside;
    }
  }

  return inside;
}

function getLandTileType(lon: number, lat: number): TileType {
  if (isInAnyRegion(lon, lat, MOUNTAIN_REGIONS)) {
    return 'mountain';
  }

  return 'plains';
}

function isForestTile(lon: number, lat: number, x: number, y: number): boolean {
  const region = FOREST_REGIONS.find((forestRegion) => isInRegion(lon, lat, forestRegion));
  if (!region) return false;

  const threshold = region.name === 'Black Forest' ? 70 : region.name === 'Scandinavia' ? 55 : 45;
  return deterministicPercent(x, y) < threshold;
}

function deterministicPercent(x: number, y: number): number {
  const hash = Math.imul(x + 17, 73_856_093) ^ Math.imul(y + 31, 19_349_663);
  return Math.abs(hash) % 100;
}

function hasOceanNeighbor(rows: TileType[][], x: number, y: number): boolean {
  const neighbors = [
    [x, y - 1],
    [x + 1, y],
    [x, y + 1],
    [x - 1, y],
  ];

  return neighbors.some(([nx, ny]) => {
    if (nx < 0 || nx >= WIDTH || ny < 0 || ny >= HEIGHT) return false;
    return rows[ny][nx] === 'ocean';
  });
}

function getRingBounds(ring: Ring): Bounds {
  let minLon = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  for (const [lon, lat] of ring) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  return { minLon, maxLon, minLat, maxLat };
}

function boundsOverlap(a: Bounds, b: Bounds): boolean {
  return a.minLon <= b.maxLon && a.maxLon >= b.minLon && a.minLat <= b.maxLat && a.maxLat >= b.minLat;
}

function pointInBounds(lon: number, lat: number, bounds: Bounds): boolean {
  return lon >= bounds.minLon && lon <= bounds.maxLon && lat >= bounds.minLat && lat <= bounds.maxLat;
}

function isInAnyRegion(lon: number, lat: number, regions: Region[]): boolean {
  return regions.some((region) => isInRegion(lon, lat, region));
}

function isInRegion(lon: number, lat: number, region: Region): boolean {
  return lon >= region.minLon && lon <= region.maxLon && lat >= region.minLat && lat <= region.maxLat;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
