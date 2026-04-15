import type { BuildingType } from './Building';

/**
 * Per-stad-lagring av byggnader. Ren data utan Phaser-beroenden.
 */
export class CityBuildings {
  readonly cityId: string;
  private readonly buildings = new Set<string>();

  constructor(cityId: string) {
    this.cityId = cityId;
  }

  add(buildingType: BuildingType): void {
    this.buildings.add(buildingType.id);
  }

  has(buildingId: string): boolean {
    return this.buildings.has(buildingId);
  }

  getAll(): string[] {
    return Array.from(this.buildings);
  }
}
