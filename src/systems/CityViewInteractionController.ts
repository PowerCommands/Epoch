import type { City } from '../entities/City';
import type { MapData } from '../types/map';
import type { CityTerritorySystem } from './CityTerritorySystem';

export interface CityViewInteractionState {
  dragActive: boolean;
  validDropCoords: Array<{ x: number; y: number }>;
  hoveredCoord?: { x: number; y: number };
  dropTargetCoord?: { x: number; y: number };
}

export class CityViewInteractionController {
  private state: CityViewInteractionState = {
    dragActive: false,
    validDropCoords: [],
  };

  constructor(private readonly cityTerritorySystem: CityTerritorySystem) {}

  beginDrag(
    city: City,
    coord: { x: number; y: number } | null,
    mapData: MapData,
  ): boolean {
    if (!coord || !city.nextExpansionTileCoord) return false;
    if (city.nextExpansionTileCoord.x !== coord.x || city.nextExpansionTileCoord.y !== coord.y) return false;

    this.state = {
      dragActive: true,
      validDropCoords: this.cityTerritorySystem.getClaimableTiles(city, mapData),
      hoveredCoord: coord,
      dropTargetCoord: coord,
    };
    return true;
  }

  updateHover(city: City, coord: { x: number; y: number } | null, mapData: MapData): void {
    const hoveredCoord = coord ?? undefined;
    if (!this.state.dragActive) {
      this.state = {
        ...this.state,
        hoveredCoord,
      };
      return;
    }

    const validDropCoords = this.cityTerritorySystem.getClaimableTiles(city, mapData);
    const validSet = new Set(validDropCoords.map((entry) => `${entry.x},${entry.y}`));
    this.state = {
      dragActive: true,
      validDropCoords,
      hoveredCoord,
      dropTargetCoord: coord && validSet.has(`${coord.x},${coord.y}`) ? coord : undefined,
    };
  }

  handleDrop(city: City, coord: { x: number; y: number } | null, mapData: MapData): boolean {
    if (!this.state.dragActive) return false;

    const dropCoord = coord ?? this.state.dropTargetCoord ?? null;
    const changed = dropCoord
      ? this.cityTerritorySystem.setNextExpansionTile(city, dropCoord, mapData)
      : false;
    this.clear();
    return changed;
  }

  clear(): void {
    this.state = {
      dragActive: false,
      validDropCoords: [],
    };
  }

  isDragging(): boolean {
    return this.state.dragActive;
  }

  getHoveredCoord(): { x: number; y: number } | undefined {
    return this.state.hoveredCoord;
  }

  getRenderState(): CityViewInteractionState {
    return {
      dragActive: this.state.dragActive,
      validDropCoords: this.state.validDropCoords.map((coord) => ({ ...coord })),
      hoveredCoord: this.state.hoveredCoord ? { ...this.state.hoveredCoord } : undefined,
      dropTargetCoord: this.state.dropTargetCoord ? { ...this.state.dropTargetCoord } : undefined,
    };
  }
}
