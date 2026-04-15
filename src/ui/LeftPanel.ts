import { CITY_BASE_HEALTH } from '../data/cities';
import type { City } from '../entities/City';
import { CityManager } from '../systems/CityManager';
import { NationManager } from '../systems/NationManager';
import { ProductionSystem } from '../systems/ProductionSystem';
import { TurnManager } from '../systems/TurnManager';
import { UnitManager } from '../systems/UnitManager';
import type { Producible } from '../types/producible';

export class LeftPanel {
  private readonly root: HTMLElement;
  private readonly nationManager: NationManager;
  private readonly cityManager: CityManager;
  private readonly unitManager: UnitManager;
  private readonly turnManager: TurnManager;
  private readonly productionSystem: ProductionSystem;
  private readonly humanNationId: string | undefined;

  constructor(
    nationManager: NationManager,
    cityManager: CityManager,
    unitManager: UnitManager,
    turnManager: TurnManager,
    productionSystem: ProductionSystem,
    humanNationId?: string,
  ) {
    const root = document.getElementById('panel-left');
    if (!root) throw new Error('Missing #panel-left');

    this.root = root;
    this.nationManager = nationManager;
    this.cityManager = cityManager;
    this.unitManager = unitManager;
    this.turnManager = turnManager;
    this.productionSystem = productionSystem;
    this.humanNationId = humanNationId;

    this.refresh();
  }

  refresh(): void {
    this.root.replaceChildren();
    this.root.className = 'html-panel';

    this.root.append(
      this.renderTurnInfo(),
      this.renderPlayerSummary(),
      this.renderCityList(),
      this.createSeparator(),
      this.renderScoreboard(),
    );
  }

  private renderTurnInfo(): HTMLElement {
    const section = this.createSection('Turn');
    const currentNation = this.turnManager.getCurrentNation();

    section.append(
      this.createDiv('panel-large', `Round ${this.turnManager.getCurrentRound()}`),
      this.createDiv('', `${currentNation.name}'s Turn`, currentNation.color),
    );

    return section;
  }

  private renderPlayerSummary(): HTMLElement {
    if (!this.humanNationId) return document.createElement('div');
    const nation = this.nationManager.getNation(this.humanNationId);
    if (!nation) return document.createElement('div');
    const section = this.createSection(nation.name);

    const resources = this.nationManager.getResources(this.humanNationId);
    const cities = this.cityManager.getCitiesByOwner(this.humanNationId);
    const units = this.unitManager.getUnitsByOwner(this.humanNationId);

    section.append(
      this.createNationNameRow(nation.name, nation.color),
      this.createDiv('', `Gold: ${resources.gold} (+${resources.goldPerTurn}/turn)`),
      this.createDiv('', `Cities: ${cities.length}`),
      this.createDiv('', `Units: ${units.length}`),
    );

    return section;
  }

  private renderCityList(): HTMLElement {
    if (!this.humanNationId) return document.createElement('div');
    const nation = this.nationManager.getNation(this.humanNationId);
    const section = this.createSection(`${nation?.name ?? 'Player'}'s Cities`);
    const cities = this.cityManager.getCitiesByOwner(this.humanNationId);

    if (cities.length === 0) {
      section.append(this.createDiv('panel-muted', 'No cities'));
      return section;
    }

    for (const city of cities) {
      section.append(this.renderCityEntry(city));
    }

    return section;
  }

  private renderCityEntry(city: City): HTMLElement {
    const wrapper = this.createDiv('');
    wrapper.style.marginBottom = '10px';

    const button = document.createElement('button');
    button.className = 'panel-city-button';
    button.type = 'button';
    button.textContent = city.name;
    button.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('focusCity', { detail: { cityId: city.id } }));
    });

    wrapper.append(
      button,
      createHpBar(city.health, CITY_BASE_HEALTH),
      this.createDiv('panel-muted', this.getProductionText(city)),
    );

    return wrapper;
  }

  private renderScoreboard(): HTMLElement {
    const section = this.createSection('Nations');

    for (const nation of this.nationManager.getAllNations()) {
      const cityCount = this.cityManager.getCitiesByOwner(nation.id).length;
      const unitCount = this.unitManager.getUnitsByOwner(nation.id).length;
      const row = this.createDiv(`panel-row${cityCount === 0 ? ' score-dead' : ''}`);
      const dot = this.createDot(nation.color);
      const text = document.createElement('span');
      text.textContent = `${nation.name} | Cities ${cityCount} | Units ${unitCount}`;
      row.append(dot, text);
      section.append(row);
    }

    return section;
  }

  private getProductionText(city: City): string {
    const production = this.productionSystem.getProduction(city.id);
    if (!production) return 'Producing: none';

    return `Producing: ${this.getProducibleName(production.item)} (${production.accumulated}/${this.getProducibleCost(production.item)})`;
  }

  private getProducibleName(item: Producible): string {
    return item.kind === 'unit' ? item.unitType.name : item.buildingType.name;
  }

  private getProducibleCost(item: Producible): number {
    return item.kind === 'unit' ? item.unitType.productionCost : item.buildingType.productionCost;
  }

  private createSection(title: string): HTMLElement {
    const section = this.createDiv('panel-section');
    section.append(this.createDiv('panel-heading', title));
    return section;
  }

  private createNationNameRow(name: string, color: number): HTMLElement {
    const row = this.createDiv('panel-row');
    const label = document.createElement('strong');
    label.textContent = name;
    row.append(this.createDot(color), label);
    return row;
  }

  private createDot(color: number): HTMLElement {
    const dot = this.createDiv('panel-dot');
    dot.style.background = toCssColor(color);
    return dot;
  }

  private createSeparator(): HTMLElement {
    const separator = document.createElement('hr');
    separator.className = 'panel-separator';
    return separator;
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
