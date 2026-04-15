import { ALL_BUILDINGS, getBuildingById } from '../data/buildings';
import { CITY_BASE_DEFENSE, CITY_BASE_HEALTH } from '../data/cities';
import { ALL_UNIT_TYPES } from '../data/units';
import type { City } from '../entities/City';
import type { Unit } from '../entities/Unit';
import { CityManager } from '../systems/CityManager';
import { NationManager } from '../systems/NationManager';
import { ProductionSystem } from '../systems/ProductionSystem';
import { UnitManager } from '../systems/UnitManager';
import type { Tile } from '../types/map';
import type { Producible } from '../types/producible';

export class RightPanel {
  private readonly root: HTMLElement;
  private readonly productionSystem: ProductionSystem;
  private readonly cityManager: CityManager;
  private readonly unitManager: UnitManager;
  private readonly nationManager: NationManager;
  private readonly humanNationId: string | undefined;
  private currentCity: City | null = null;
  private currentUnit: Unit | null = null;
  private canFoundCity: ((unit: Unit) => boolean) | null = null;
  private foundCity: ((unit: Unit) => void) | null = null;

  constructor(
    productionSystem: ProductionSystem,
    cityManager: CityManager,
    unitManager: UnitManager,
    nationManager: NationManager,
    humanNationId?: string,
  ) {
    const root = document.getElementById('panel-right');
    if (!root) throw new Error('Missing #panel-right');

    this.root = root;
    this.productionSystem = productionSystem;
    this.cityManager = cityManager;
    this.unitManager = unitManager;
    this.nationManager = nationManager;
    this.humanNationId = humanNationId;

    this.clear();
  }

  setFoundCityHandler(canFoundCity: (unit: Unit) => boolean, foundCity: (unit: Unit) => void): void {
    this.canFoundCity = canFoundCity;
    this.foundCity = foundCity;
  }

  refreshCurrent(): void {
    if (this.currentCity) {
      this.showCity(this.currentCity);
      return;
    }

    if (this.currentUnit) {
      if (!this.unitManager.getUnit(this.currentUnit.id)) {
        this.clear();
        return;
      }

      this.showUnit(this.currentUnit);
    }
  }

  showTile(tile: Tile): void {
    this.currentCity = null;
    this.currentUnit = null;
    this.reset();

    const owner = tile.ownerId ? this.nationManager.getNation(tile.ownerId) : undefined;
    const section = this.createSection('Tile');
    section.append(
      this.createDiv('panel-large', tile.type),
      this.createDiv('', `Owner: ${owner?.name ?? 'Unclaimed'}`),
    );
    this.root.append(section);
  }

  showCity(city: City): void {
    this.currentCity = city;
    this.currentUnit = null;
    this.reset();

    const nation = this.nationManager.getNation(city.ownerId);
    const nationColor = nation?.color ?? 0xffffff;
    const resources = this.cityManager.getResources(city.id);
    const garrison = this.unitManager.getUnitAt(city.tileX, city.tileY);
    const buildings = this.cityManager.getBuildings(city.id).getAll();

    const section = this.createSection('City');
    section.append(
      this.createDiv('panel-large', city.name, nationColor),
      this.createDiv('', `Owner: ${nation?.name ?? 'Unknown'}`),
      this.createDiv('', `HP: ${city.health}/${CITY_BASE_HEALTH}`),
      createHpBar(city.health, CITY_BASE_HEALTH),
      this.createDiv('', `Defense: ${CITY_BASE_DEFENSE}`),
      this.createDiv('', `Garrison: ${garrison?.name ?? 'none'}`),
      this.createDiv('', `Food: ${resources.food} (+${resources.foodPerTurn}/turn)`),
      this.createDiv('', `Production: ${resources.production} (+${resources.productionPerTurn}/turn)`),
      this.createDiv('', `Buildings: ${buildings.length > 0 ? buildings.map((id) => getBuildingById(id)?.name ?? id).join(', ') : 'none'}`),
    );

    this.root.append(section, this.renderProduction(city, nationColor));
  }

  showUnit(unit: Unit): void {
    this.currentCity = null;
    this.currentUnit = unit;
    this.reset();

    const nation = this.nationManager.getNation(unit.ownerId);
    const section = this.createSection('Unit');
    section.append(
      this.createDiv('panel-large', `${unit.name} (${unit.unitType.name})`),
      this.createNationRow(nation?.name ?? 'Unknown', nation?.color ?? 0xffffff),
      this.createDiv('', `HP: ${unit.health}/${unit.unitType.baseHealth}`),
      createHpBar(unit.health, unit.unitType.baseHealth),
      this.createDiv('', `Strength: ${unit.unitType.baseStrength}`),
      this.createDiv('', `Range: ${unit.unitType.range ?? 1}`),
      this.createDiv('', `Movement: ${unit.movementPoints}/${unit.maxMovementPoints}`),
    );

    if (unit.unitType.canFound && this.canFoundCity?.(unit)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'found-city-button';
      button.textContent = 'Found City';
      button.addEventListener('click', () => this.foundCity?.(unit));
      section.append(button);
    }

    this.root.append(section);
  }

  clear(): void {
    this.currentCity = null;
    this.currentUnit = null;
    this.reset();
    this.root.append(this.createDiv('panel-muted', 'Select a tile, city, or unit to see details.'));
  }

  private renderProduction(city: City, nationColor: number): HTMLElement {
    const section = this.createSection('Production');
    const production = this.productionSystem.getProduction(city.id);

    if (city.ownerId !== this.humanNationId) {
      section.append(this.createDiv('', `Producing: ${production ? this.getProducibleName(production.item) : 'none'}`));
      return section;
    }

    for (const unitType of ALL_UNIT_TYPES) {
      section.append(this.createProductionRow(
        { kind: 'unit', unitType },
        city,
        production?.item,
        nationColor,
      ));
    }

    for (const buildingType of ALL_BUILDINGS) {
      if (this.cityManager.getBuildings(city.id).has(buildingType.id)) continue;
      section.append(this.createProductionRow(
        { kind: 'building', buildingType },
        city,
        production?.item,
        nationColor,
      ));
    }

    return section;
  }

  private createProductionRow(
    item: Producible,
    city: City,
    current: Producible | undefined,
    nationColor: number,
  ): HTMLElement {
    const isActive = current !== undefined && this.sameProducible(item, current);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `production-row${isActive ? ' active' : ''}`;
    button.style.borderLeftColor = isActive ? toCssColor(nationColor) : 'transparent';
    button.innerHTML = `<strong>${this.getProducibleName(item)}</strong><br><span class="panel-muted">Cost: ${this.getProducibleCost(item)}</span>`;
    button.addEventListener('click', () => {
      this.productionSystem.setProduction(city.id, item);
      this.showCity(city);
    });
    return button;
  }

  private sameProducible(a: Producible, b: Producible): boolean {
    if (a.kind !== b.kind) return false;
    if (a.kind === 'unit' && b.kind === 'unit') {
      return a.unitType.id === b.unitType.id;
    }

    if (a.kind === 'building' && b.kind === 'building') {
      return a.buildingType.id === b.buildingType.id;
    }

    return false;
  }

  private getProducibleName(item: Producible): string {
    return item.kind === 'unit' ? item.unitType.name : item.buildingType.name;
  }

  private getProducibleCost(item: Producible): number {
    return item.kind === 'unit' ? item.unitType.productionCost : item.buildingType.productionCost;
  }

  private reset(): void {
    this.root.replaceChildren();
    this.root.className = 'html-panel';
  }

  private createSection(title: string): HTMLElement {
    const section = this.createDiv('panel-section');
    section.append(this.createDiv('panel-heading', title));
    return section;
  }

  private createNationRow(name: string, color: number): HTMLElement {
    const row = this.createDiv('panel-row');
    const dot = this.createDiv('panel-dot');
    dot.style.background = toCssColor(color);
    const text = document.createElement('span');
    text.textContent = name;
    row.append(dot, text);
    return row;
  }

  private createDiv(className: string, text?: string, color?: number): HTMLDivElement {
    const div = document.createElement('div');
    div.className = className;
    if (text !== undefined) div.textContent = text;
    if (color !== undefined) div.style.color = toCssColor(color);
    return div;
  }
}

function createHpBar(current: number, max: number): HTMLElement {
  const outer = document.createElement('div');
  outer.className = 'hp-bar';

  const inner = document.createElement('div');
  inner.className = 'hp-fill';
  const percent = Math.max(0, Math.min(100, (current / max) * 100));
  inner.style.width = `${percent}%`;
  inner.style.background = percent < 25 ? '#a44' : percent < 50 ? '#ca4' : '#4a9';

  outer.append(inner);
  return outer;
}

function toCssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
