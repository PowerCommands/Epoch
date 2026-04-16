import { ALL_BUILDINGS, getBuildingById } from '../data/buildings';
import { CITY_BASE_DEFENSE, CITY_BASE_HEALTH } from '../data/cities';
import { ALL_UNIT_TYPES } from '../data/units';
import type { City } from '../entities/City';
import type { Unit } from '../entities/Unit';
import { CityManager } from '../systems/CityManager';
import { NationManager } from '../systems/NationManager';
import { ProductionSystem } from '../systems/ProductionSystem';
import { UnitManager } from '../systems/UnitManager';
import { TileType, type MapData, type Tile } from '../types/map';
import type { Producible } from '../types/producible';

type ViewType = 'tile' | 'city' | 'unit' | 'nation' | null;

export class RightPanel {
  private readonly root: HTMLElement;
  private readonly productionSystem: ProductionSystem;
  private readonly cityManager: CityManager;
  private readonly unitManager: UnitManager;
  private readonly nationManager: NationManager;
  private readonly mapData: MapData;
  private readonly humanNationId: string | undefined;
  private currentCity: City | null = null;
  private currentUnit: Unit | null = null;
  private currentNationId: string | null = null;
  private currentView: ViewType = null;
  private canFoundCity: ((unit: Unit) => boolean) | null = null;
  private foundCity: ((unit: Unit) => void) | null = null;

  constructor(
    productionSystem: ProductionSystem,
    cityManager: CityManager,
    unitManager: UnitManager,
    nationManager: NationManager,
    mapData: MapData,
    humanNationId?: string,
  ) {
    const root = document.getElementById('panel-right');
    if (!root) throw new Error('Missing #panel-right');

    this.root = root;
    this.productionSystem = productionSystem;
    this.cityManager = cityManager;
    this.unitManager = unitManager;
    this.nationManager = nationManager;
    this.mapData = mapData;
    this.humanNationId = humanNationId;

    this.clear();
  }

  getCurrentCity(): City | null {
    return this.currentCity;
  }

  setFoundCityHandler(canFoundCity: (unit: Unit) => boolean, foundCity: (unit: Unit) => void): void {
    this.canFoundCity = canFoundCity;
    this.foundCity = foundCity;
  }

  getView(): ViewType {
    return this.currentView;
  }

  refreshCurrent(): void {
    if (this.currentView === 'nation' && this.currentNationId) {
      this.showNation(this.currentNationId);
      return;
    }

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

  refreshNationView(): void {
    if (this.currentView === 'nation' && this.currentNationId) {
      this.showNation(this.currentNationId);
    }
  }

  /** Re-render only the production queue section for the given city. */
  refreshProductionQueue(cityId: string): void {
    if (!this.currentCity || this.currentCity.id !== cityId) return;
    const container = document.getElementById('production-container');
    if (!container) return;

    const nation = this.nationManager.getNation(this.currentCity.ownerId);
    const nationColor = nation?.color ?? 0xffffff;
    const isHuman = this.currentCity.ownerId === this.humanNationId;

    container.replaceChildren();
    container.append(
      this.renderQueueSection(this.currentCity, isHuman),
    );
    if (isHuman) {
      container.append(this.renderAddToQueue(this.currentCity, nationColor));
    }
  }

  showTile(tile: Tile): void {
    this.currentCity = null;
    this.currentUnit = null;
    this.currentNationId = null;
    this.currentView = 'tile';
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
    this.currentNationId = null;
    this.currentView = 'city';
    this.reset();

    const nation = this.nationManager.getNation(city.ownerId);
    const nationColor = nation?.color ?? 0xffffff;
    const resources = this.cityManager.getResources(city.id);
    const garrison = this.unitManager.getUnitAt(city.tileX, city.tileY);
    const buildings = this.cityManager.getBuildings(city.id).getAll();
    const isHuman = city.ownerId === this.humanNationId;

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

    // Production container — holds queue + add-to-queue, refreshable independently
    const prodContainer = document.createElement('div');
    prodContainer.id = 'production-container';
    prodContainer.append(this.renderQueueSection(city, isHuman));
    if (isHuman) {
      prodContainer.append(this.renderAddToQueue(city, nationColor));
    }

    this.root.append(section, prodContainer);
  }

  showUnit(unit: Unit): void {
    this.currentCity = null;
    this.currentUnit = unit;
    this.currentNationId = null;
    this.currentView = 'unit';
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

    const transport = this.unitManager.getTransportForUnit(unit);
    if (transport !== undefined) {
      section.append(this.createDiv('panel-muted', `Onboard: ${transport.name}`));
    }

    const cargo = this.unitManager.getCargoForTransport(unit);
    if (cargo !== undefined) {
      section.append(this.createDiv('panel-muted', `Carrying: ${cargo.name}`));
    }

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

  // TODO: filter based on fog of war discovery when implemented
  showNation(nationId: string): void {
    this.currentCity = null;
    this.currentUnit = null;
    this.currentNationId = nationId;
    this.currentView = 'nation';
    this.reset();

    const nation = this.nationManager.getNation(nationId);
    if (!nation) return;

    const isHuman = nationId === this.humanNationId;
    const resources = this.nationManager.getResources(nationId);
    const cities = this.cityManager.getCitiesByOwner(nationId);
    const units = this.unitManager.getUnitsByOwner(nationId);

    // Header
    const header = this.createSection('Nation');
    const nameRow = this.createDiv('panel-row');
    const dot = this.createDiv('panel-dot');
    dot.style.background = toCssColor(nation.color);
    const nameText = document.createElement('strong');
    nameText.textContent = nation.name + (isHuman ? ' (You)' : '');
    nameText.style.color = toCssColor(nation.color);
    nameRow.append(dot, nameText);
    header.append(nameRow);
    this.root.append(header);

    // Economy
    const econ = this.createSection('Economy');
    econ.append(
      this.createDiv('', `Gold: ${resources.gold}  (+${resources.goldPerTurn}/turn)`),
    );
    this.root.append(econ);

    // Cities
    const citySection = this.createSection(`Cities (${cities.length})`);
    if (cities.length === 0) {
      citySection.append(this.createDiv('panel-muted', 'No cities'));
    } else {
      for (const city of cities) {
        const row = document.createElement('div');
        row.className = 'nation-city-row';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'panel-city-button';
        btn.textContent = city.name + (city.isCapital ? ' \u2605' : '');
        btn.addEventListener('click', () => {
          window.dispatchEvent(new CustomEvent('focusCity', { detail: { cityId: city.id } }));
        });

        const hp = this.createDiv('panel-muted', `HP ${city.health}/${CITY_BASE_HEALTH}`);
        hp.style.fontSize = '11px';

        row.append(btn, hp);
        citySection.append(row);
      }
    }
    this.root.append(citySection);

    // Military
    const unitCounts = new Map<string, number>();
    for (const unit of units) {
      const typeName = unit.unitType.name;
      unitCounts.set(typeName, (unitCounts.get(typeName) ?? 0) + 1);
    }

    const milSection = this.createSection(`Military (${units.length} units)`);
    if (unitCounts.size === 0) {
      milSection.append(this.createDiv('panel-muted', 'No units'));
    } else {
      for (const [typeName, count] of unitCounts) {
        milSection.append(this.createDiv('', `${count}\u00d7 ${typeName}`));
      }
    }
    this.root.append(milSection);
  }

  clear(): void {
    this.currentCity = null;
    this.currentUnit = null;
    this.currentNationId = null;
    this.currentView = null;
    this.reset();
    this.root.append(this.createDiv('panel-muted', 'Select a tile, city, unit, or nation.'));
  }

  // ─── Production Queue ────────────────────────────────────────────────────

  private renderQueueSection(city: City, isHuman: boolean): HTMLElement {
    const section = this.createSection('Production Queue');
    const queue = this.productionSystem.getQueue(city.id);

    if (queue.length === 0) {
      section.append(this.createDiv('panel-muted', 'Queue empty'));
      return section;
    }

    for (let i = 0; i < queue.length; i++) {
      const entry = queue[i];
      const row = document.createElement('div');
      row.className = `queue-row${i === 0 ? ' queue-active' : ''}`;

      const label = document.createElement('span');
      const name = this.getProducibleName(entry.item);
      const turnsText = entry.blockedReason ? 'blocked' : `${entry.turnsRemaining} turn${entry.turnsRemaining !== 1 ? 's' : ''}`;
      label.innerHTML = `${i + 1}. <strong>${name}</strong> <span class="panel-muted">(${turnsText})</span>`;

      row.append(label);

      if (i === 0 && !entry.blockedReason) {
        const progressBar = document.createElement('div');
        progressBar.className = 'queue-progress';
        const fill = document.createElement('div');
        fill.className = 'queue-progress-fill';
        fill.style.width = `${Math.min(100, (entry.progress / entry.cost) * 100)}%`;
        progressBar.append(fill);
        row.append(progressBar);
      }

      if (entry.blockedReason) {
        const blocked = this.createDiv('panel-muted', entry.blockedReason);
        blocked.style.color = '#cc6666';
        blocked.style.fontSize = '11px';
        row.append(blocked);
      }

      if (isHuman) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'queue-remove-btn';
        removeBtn.textContent = '\u00d7';
        removeBtn.title = 'Remove from queue';
        removeBtn.addEventListener('click', () => {
          this.productionSystem.removeFromQueue(city.id, i);
          this.refreshProductionQueue(city.id);
        });
        row.append(removeBtn);
      }

      section.append(row);
    }

    return section;
  }

  private renderAddToQueue(city: City, nationColor: number): HTMLElement {
    const section = this.createSection('Add to Queue');
    const hasCoastalAccess = cityHasCoastalAccess(city, this.mapData);

    for (const unitType of ALL_UNIT_TYPES) {
      if (unitType.isNaval && !hasCoastalAccess) continue;
      section.append(this.createAddRow({ kind: 'unit', unitType }, city, nationColor));
    }

    const separator = document.createElement('hr');
    separator.className = 'panel-separator';
    section.append(separator);

    for (const buildingType of ALL_BUILDINGS) {
      if (this.cityManager.getBuildings(city.id).has(buildingType.id)) continue;
      section.append(this.createAddRow({ kind: 'building', buildingType }, city, nationColor));
    }

    return section;
  }

  private createAddRow(item: Producible, city: City, _nationColor: number): HTMLElement {
    const row = document.createElement('div');
    row.className = 'add-queue-row';

    const label = document.createElement('span');
    label.innerHTML = `${this.getProducibleName(item)} <span class="panel-muted">(${this.getProducibleCost(item)})</span>`;

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'queue-add-btn';
    addBtn.textContent = 'Add';
    addBtn.addEventListener('click', () => {
      this.productionSystem.enqueue(city.id, item);
      this.refreshProductionQueue(city.id);
    });

    row.append(label, addBtn);
    return row;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

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

function cityHasCoastalAccess(city: City, mapData: MapData): boolean {
  const positions = [
    { x: city.tileX, y: city.tileY },
    { x: city.tileX, y: city.tileY - 1 },
    { x: city.tileX + 1, y: city.tileY },
    { x: city.tileX, y: city.tileY + 1 },
    { x: city.tileX - 1, y: city.tileY },
  ];

  return positions.some(({ x, y }) => {
    const tile = mapData.tiles[y]?.[x];
    return tile?.type === TileType.Coast || tile?.type === TileType.Ocean;
  });
}

function toCssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
