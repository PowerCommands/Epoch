import { ALL_BUILDINGS, getBuildingById } from '../data/buildings';
import { CITY_BASE_DEFENSE, CITY_BASE_HEALTH } from '../data/cities';
import { getImprovementById } from '../data/improvements';
import type { TileYield } from '../data/terrainYields';
import { getLeaderById, getLeaderByNationId } from '../data/leaders';
import { ALL_UNIT_TYPES } from '../data/units';
import type { City } from '../entities/City';
import type { Unit } from '../entities/Unit';
import { calculateCityEconomy } from '../systems/CityEconomy';
import { CityManager } from '../systems/CityManager';
import { NationManager } from '../systems/NationManager';
import { ProductionSystem } from '../systems/ProductionSystem';
import { UnitManager } from '../systems/UnitManager';
import { TileType, type MapData, type Tile } from '../types/map';
import type { Producible } from '../types/producible';
import type { LeaderDefinition } from '../types/leader';
import type { DiplomacyManager } from '../systems/DiplomacyManager';
import type { DiscoverySystem } from '../systems/DiscoverySystem';
import type { EventLogSystem } from '../systems/EventLogSystem';
import type { IGridSystem } from '../systems/grid/IGridSystem';
import type { BuildImprovementPreview } from '../systems/BuilderSystem';
import type { ResearchSystem } from '../systems/ResearchSystem';
import { getClaimableTiles, getClaimCost } from '../systems/CultureExpansion';
import { RafScheduler } from '../utils/RafScheduler';

type ViewType = 'tile' | 'city' | 'unit' | 'nation' | 'leader' | null;
type BuilderHintProvider = (tile: Tile) => BuildImprovementPreview | null;

export class RightPanel {
  private readonly root: HTMLElement;
  private readonly contentEl: HTMLElement;
  private readonly logEl: HTMLElement;
  private readonly logListEl: HTMLElement;
  private readonly productionSystem: ProductionSystem;
  private readonly cityManager: CityManager;
  private readonly unitManager: UnitManager;
  private readonly nationManager: NationManager;
  private readonly mapData: MapData;
  private readonly humanNationId: string | undefined;
  private diplomacyManager: DiplomacyManager | null = null;
  private discoverySystem: DiscoverySystem | null = null;
  private eventLog: EventLogSystem | null = null;
  private researchSystem: ResearchSystem | null = null;
  private currentTile: Tile | null = null;
  private currentCity: City | null = null;
  private currentUnit: Unit | null = null;
  private currentNationId: string | null = null;
  private currentLeaderId: string | null = null;
  private currentView: ViewType = null;
  private canFoundCity: ((unit: Unit) => boolean) | null = null;
  private foundCity: ((unit: Unit) => void) | null = null;
  private builderHintProvider: BuilderHintProvider | null = null;
  private readonly scheduler = new RafScheduler();

  constructor(
    productionSystem: ProductionSystem,
    cityManager: CityManager,
    unitManager: UnitManager,
    nationManager: NationManager,
    mapData: MapData,
    humanNationId: string | undefined,
    private readonly gridSystem: IGridSystem,
  ) {
    const root = document.getElementById('panel-right');
    if (!root) throw new Error('Missing #panel-right');

    this.root = root;
    this.root.className = 'html-panel';
    this.root.replaceChildren();

    this.contentEl = document.createElement('div');
    this.contentEl.className = 'panel-content';

    this.logEl = document.createElement('div');
    this.logEl.className = 'panel-section event-log';
    const logHeading = document.createElement('div');
    logHeading.className = 'panel-heading';
    logHeading.textContent = 'Event Log';
    this.logListEl = document.createElement('div');
    this.logListEl.className = 'event-log-list';
    this.logEl.append(logHeading, this.logListEl);

    this.root.append(this.contentEl, this.logEl);

    this.productionSystem = productionSystem;
    this.cityManager = cityManager;
    this.unitManager = unitManager;
    this.nationManager = nationManager;
    this.mapData = mapData;
    this.humanNationId = humanNationId;

    this.renderEventLog();
    this.clear();
  }

  getCurrentCity(): City | null {
    return this.currentCity;
  }

  setDiplomacyManager(dm: DiplomacyManager): void {
    this.diplomacyManager = dm;
  }

  setResearchSystem(researchSystem: ResearchSystem): void {
    this.researchSystem = researchSystem;
  }

  setDiscoverySystem(ds: DiscoverySystem): void {
    this.discoverySystem = ds;
  }

  setEventLog(log: EventLogSystem): void {
    this.eventLog = log;
    log.onChanged(() => this.renderEventLog());
    this.renderEventLog();
  }

  setBuilderHintProvider(provider: BuilderHintProvider): void {
    this.builderHintProvider = provider;
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

    if (this.currentView === 'leader' && this.currentLeaderId) {
      this.showLeader(this.currentLeaderId);
      return;
    }

    if (this.currentView === 'tile' && this.currentTile) {
      this.showTile(this.currentTile);
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

  /** Coalesce repeated event-driven refreshes into one per animation frame. */
  requestRefresh(): void {
    this.scheduler.schedule('refreshCurrent', () => this.refreshCurrent());
  }

  isShowingCity(cityId?: string): boolean {
    if (!cityId) return false;
    return this.currentView === 'city' && this.currentCity?.id === cityId;
  }

  isShowingUnit(unit: Unit): boolean {
    return this.currentView === 'unit' && this.currentUnit?.id === unit.id;
  }

  shutdown(): void {
    this.scheduler.cancel();
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
    this.currentTile = tile;
    this.currentCity = null;
    this.currentUnit = null;
    this.currentNationId = null;
    this.currentLeaderId = null;
    this.currentView = 'tile';
    this.reset();

    const owner = tile.ownerId ? this.nationManager.getNation(tile.ownerId) : undefined;
    const improvement = tile.improvementId ? getImprovementById(tile.improvementId) : undefined;
    const builderHint = this.builderHintProvider?.(tile) ?? null;
    const section = this.createSection('Tile');
    section.append(
      this.createDiv('panel-large', tile.type),
      this.createDiv('', `Owner: ${owner?.name ?? 'Unclaimed'}`),
      this.createDiv('', `Improvement: ${improvement?.name ?? 'None'}`),
    );
    if (improvement) {
      section.append(this.createDiv('', `Bonus: ${formatYieldBonus(improvement.yieldBonus)}`));
    }
    if (builderHint) {
      const text = builderHint.canBuild && builderHint.improvement
        ? `Worker can construct ${builderHint.improvement.name} here`
        : `Worker cannot improve this tile${builderHint.reason ? `: ${builderHint.reason}` : ''}`;
      section.append(this.createDiv('panel-muted', text));
    }
    this.contentEl.append(section);
  }

  showCity(city: City): void {
    this.currentTile = null;
    this.currentCity = city;
    this.currentUnit = null;
    this.currentNationId = null;
    this.currentLeaderId = null;
    this.currentView = 'city';
    this.reset();

    const nation = this.nationManager.getNation(city.ownerId);
    const nationColor = nation?.color ?? 0xffffff;
    const resources = this.cityManager.getResources(city.id);
    const garrison = this.unitManager.getUnitAt(city.tileX, city.tileY);
    const buildings = this.cityManager.getBuildings(city.id).getAll();
    const economy = calculateCityEconomy(
      city,
      this.mapData,
      this.cityManager.getBuildings(city.id),
      this.gridSystem,
    );
    const isHuman = city.ownerId === this.humanNationId;

    const turnsUntilGrowth = economy.netFood > 0
      ? Math.ceil((economy.foodToGrow - city.foodStorage) / economy.netFood)
      : null;
    const growthText = turnsUntilGrowth !== null ? `${turnsUntilGrowth} turn${turnsUntilGrowth !== 1 ? 's' : ''}` : '\u2014';

    const section = this.createSection('City');
    section.append(
      this.createDiv('panel-large', city.name, nationColor),
      this.createDiv('', `Owner: ${nation?.name ?? 'Unknown'}`),
      this.createDiv('', `HP: ${city.health}/${CITY_BASE_HEALTH}`),
      createHpBar(city.health, CITY_BASE_HEALTH),
      this.createDiv('', `Defense: ${CITY_BASE_DEFENSE}`),
      this.createDiv('', `Garrison: ${garrison?.name ?? 'none'}`),
    );

    // Growth section
    const growthSection = this.createSection('Growth');
    growthSection.append(
      this.createDiv('', `Population: ${city.population}`),
      this.createDiv('', `Worked tiles: ${economy.workedTileCount} / ${economy.maxWorkableTiles}`),
      this.createDiv('', `Food: ${formatSigned(economy.food)}/turn (base ${economy.baseFood} + ${economy.food - economy.baseFood} tiles/buildings)`),
      this.createDiv('', `Consumption: -${economy.foodConsumption}/turn (${city.population} pop \u00d7 2)`),
      this.createDiv('', `Net food: ${formatSigned(economy.netFood)}/turn`),
      this.createDiv('', `Food storage: ${city.foodStorage} / ${economy.foodToGrow}`),
      createHpBar(city.foodStorage, economy.foodToGrow),
      this.createDiv('', `Growth in: ${growthText}`),
    );
    if (economy.workedTiles.some((worked) => worked.tile.improvementId !== undefined)) {
      growthSection.append(this.createDiv('panel-muted', 'Worked tile yields include improvements.'));
    }

    // Output section
    const outputSection = this.createSection('Output');
    outputSection.append(
      this.createDiv('', `Production: ${resources.production} stored (+${resources.productionPerTurn}/turn)`),
      this.createDiv('', `Gold: +${resources.goldPerTurn}/turn`),
      this.createDiv('', `Science: +${resources.sciencePerTurn}/turn`),
      this.createDiv('', `Culture: ${city.culture}`),
      this.renderCultureClaimInfo(city, isHuman),
      this.createDiv('', `Culture per turn: +${resources.culturePerTurn}/turn`),
      this.createDiv('', `Happiness: +${resources.happinessPerTurn}/turn`),
      this.createDiv('', `Buildings: ${buildings.length > 0 ? buildings.map((id) => getBuildingById(id)?.name ?? id).join(', ') : 'none'}`),
    );

    // Production container — holds queue + add-to-queue, refreshable independently
    const prodContainer = document.createElement('div');
    prodContainer.id = 'production-container';
    prodContainer.append(this.renderQueueSection(city, isHuman));
    if (isHuman) {
      prodContainer.append(this.renderAddToQueue(city, nationColor));
    }

    this.contentEl.append(section, growthSection, outputSection, prodContainer);
  }

  showUnit(unit: Unit): void {
    this.currentTile = null;
    this.currentCity = null;
    this.currentUnit = unit;
    this.currentNationId = null;
    this.currentLeaderId = null;
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

    this.contentEl.append(section);
  }

  // TODO: filter based on fog of war discovery when implemented
  showNation(nationId: string): void {
    this.currentTile = null;
    this.currentCity = null;
    this.currentUnit = null;
    this.currentNationId = nationId;
    this.currentLeaderId = null;
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
    this.contentEl.append(header);

    // Economy
    const econ = this.createSection('Economy');
    econ.append(
      this.createDiv('', `Gold: ${resources.gold}  (+${resources.goldPerTurn}/turn)`),
    );
    this.contentEl.append(econ);

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
    this.contentEl.append(citySection);

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
    this.contentEl.append(milSection);

    // Diplomacy button (only for foreign nations that we have met)
    if (!isHuman && this.diplomacyManager && this.humanNationId && this.isNationKnown(nationId)) {
      this.contentEl.append(this.renderDiplomacySection(nationId));
    }
  }

  showLeader(leaderIdOrNationId: string): void {
    this.currentTile = null;
    this.currentCity = null;
    this.currentUnit = null;
    this.currentNationId = null;
    this.currentView = 'leader';
    this.reset();

    const leader = getLeaderById(leaderIdOrNationId) ?? getLeaderByNationId(leaderIdOrNationId);
    if (!leader) {
      this.currentLeaderId = null;
      this.contentEl.append(this.createDiv('panel-muted', 'Leader not found.'));
      return;
    }

    this.currentLeaderId = leader.id;
    const nation = this.nationManager.getNation(leader.nationId);
    const section = this.createSection('Leader');
    const portrait = this.createLeaderPortrait(leader);
    const name = this.createDiv('panel-large', leader.name, nation?.color);
    section.append(
      portrait,
      name,
      this.createNationRow(nation?.name ?? 'Unknown nation', nation?.color ?? 0xffffff),
    );
    if (leader.title) section.append(this.createDiv('', leader.title));
    if (leader.description) section.append(this.createDiv('panel-muted', leader.description));

    this.contentEl.append(section);

    if (nation) {
      this.contentEl.append(this.renderLeaderNationSection(leader.nationId));
      const isHuman = leader.nationId === this.humanNationId;
      if (!isHuman && this.diplomacyManager && this.humanNationId && this.isNationKnown(leader.nationId)) {
        this.contentEl.append(this.renderDiplomacySection(leader.nationId));
      }
    }
  }

  clear(): void {
    this.currentTile = null;
    this.currentCity = null;
    this.currentUnit = null;
    this.currentNationId = null;
    this.currentLeaderId = null;
    this.currentView = null;
    this.reset();
    this.contentEl.append(this.createDiv('panel-muted', 'Select a tile, city, unit, or nation.'));
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
    const hasCoastalAccess = cityHasCoastalAccess(city, this.mapData, this.gridSystem);
    const researchSystem = this.researchSystem;

    for (const unitType of ALL_UNIT_TYPES) {
      if (unitType.isNaval && !hasCoastalAccess) continue;
      if (researchSystem && !researchSystem.isUnitUnlocked(city.ownerId, unitType.id)) continue;
      section.append(this.createAddRow({ kind: 'unit', unitType }, city, nationColor));
    }

    const separator = document.createElement('hr');
    separator.className = 'panel-separator';
    section.append(separator);

    for (const buildingType of ALL_BUILDINGS) {
      if (this.cityManager.getBuildings(city.id).has(buildingType.id)) continue;
      if (researchSystem && !researchSystem.isBuildingUnlocked(city.ownerId, buildingType.id)) continue;
      section.append(this.createAddRow({ kind: 'building', buildingType }, city, nationColor));
    }

    return section;
  }

  private createAddRow(item: Producible, city: City, _nationColor: number): HTMLElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'queue-add-btn';
    button.innerHTML = `${this.getProducibleName(item)} <span class="panel-muted">(${this.getProducibleCost(item)})</span>`;
    button.addEventListener('click', () => {
      this.productionSystem.enqueue(city.id, item);
      this.refreshProductionQueue(city.id);
    });
    return button;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private getProducibleName(item: Producible): string {
    return item.kind === 'unit' ? item.unitType.name : item.buildingType.name;
  }

  private getProducibleCost(item: Producible): number {
    return item.kind === 'unit' ? item.unitType.productionCost : item.buildingType.productionCost;
  }

  private reset(): void {
    this.contentEl.replaceChildren();
  }

  private isNationKnown(nationId: string): boolean {
    if (!this.discoverySystem || !this.humanNationId) return true;
    return this.discoverySystem.hasMet(this.humanNationId, nationId);
  }

  private renderEventLog(): void {
    this.logListEl.replaceChildren();
    if (!this.eventLog) return;
    const entries = this.eventLog.getVisibleEntries();
    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'panel-muted event-log-empty';
      empty.textContent = 'No events yet.';
      this.logListEl.append(empty);
      return;
    }
    for (const entry of entries) {
      const row = document.createElement('div');
      row.className = 'event-log-row';
      const turn = document.createElement('span');
      turn.className = 'event-log-turn';
      turn.textContent = `T${entry.round}`;
      const text = document.createElement('span');
      text.className = 'event-log-text';
      text.textContent = entry.text;
      row.append(turn, text);
      this.logListEl.append(row);
    }
    this.logListEl.scrollTop = this.logListEl.scrollHeight;
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

  private createLeaderPortrait(leader: LeaderDefinition): HTMLElement {
    const fallback = this.createDiv('leader-detail-fallback', '?');
    const img = document.createElement('img');
    img.className = 'leader-detail-portrait';
    img.src = leader.image;
    img.alt = leader.name;
    img.addEventListener('error', () => {
      img.replaceWith(fallback);
    }, { once: true });
    return img;
  }

  private renderLeaderNationSection(nationId: string): HTMLElement {
    const nation = this.nationManager.getNation(nationId);
    const section = this.createSection('Nation');
    if (!nation) {
      section.append(this.createDiv('panel-muted', 'Nation not found.'));
      return section;
    }

    const isHuman = nationId === this.humanNationId;
    const resources = this.nationManager.getResources(nationId);
    const cities = this.cityManager.getCitiesByOwner(nationId);
    const units = this.unitManager.getUnitsByOwner(nationId);
    const capital = cities.find((city) => city.isCapital);
    const territoryTiles = this.nationManager.getTileCount(nationId, this.mapData);

    const header = this.createDiv('panel-row');
    const dot = this.createDiv('panel-dot');
    dot.style.background = toCssColor(nation.color);
    const name = document.createElement('strong');
    name.textContent = nation.name + (isHuman ? ' (You)' : '');
    name.style.color = toCssColor(nation.color);
    header.append(dot, name);

    section.append(
      header,
      this.createDiv('', `Capital: ${capital?.name ?? 'none'}`),
      this.createDiv('', `Gold: ${resources.gold} (+${resources.goldPerTurn}/turn)`),
      this.createDiv('', `Cities: ${cities.length}`),
      this.createDiv('', `Units: ${units.length}`),
      this.createDiv('', `Territory: ${territoryTiles} tiles`),
    );

    return section;
  }

  private renderDiplomacySection(nationId: string): HTMLElement {
    const section = this.createSection('Diplomacy');
    const dm = this.diplomacyManager!;
    const humanId = this.humanNationId!;
    const state = dm.getState(humanId, nationId);
    const nation = this.nationManager.getNation(nationId);
    const nationColor = nation?.color ?? 0xffffff;

    const statusDiv = this.createDiv('', `Status: ${state === 'WAR' ? 'At War' : 'At Peace'}`);
    statusDiv.style.marginBottom = '8px';
    section.append(statusDiv);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style.cssText = `
      padding: 6px 16px; font-size: 13px; cursor: pointer;
      border-radius: 4px; width: 100%;
    `;

    if (state === 'PEACE') {
      btn.textContent = 'Declare War';
      btn.style.background = '#8b2020';
      btn.style.color = '#fff';
      btn.style.border = '1px solid #c44';
      btn.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('diplomacyAction', {
          detail: { action: 'declareWar', targetNationId: nationId },
        }));
      });
    } else {
      btn.textContent = 'Propose Peace';
      btn.style.background = 'transparent';
      btn.style.color = toCssColor(nationColor);
      btn.style.border = `1px solid ${toCssColor(nationColor)}`;
      btn.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('diplomacyAction', {
          detail: { action: 'proposePeace', targetNationId: nationId },
        }));
      });
    }

    section.append(btn);
    return section;
  }

  private renderCultureClaimInfo(city: City, isHuman: boolean): HTMLElement {
    const tiles = this.mapData.tiles.flat();
    const cost = getClaimCost(city, tiles);
    const claimableTiles = getClaimableTiles(city, tiles);
    const isReady = city.culture >= cost;
    const container = this.createDiv('');

    const label = this.createDiv('', `Next tile: ${cost} culture`);
    container.append(label);

    const progress = this.createDiv('panel-muted', `${city.culture} / ${cost}`);
    container.append(progress);

    const bar = createHpBar(city.culture, cost);
    container.append(bar);

    if (isHuman && isReady && claimableTiles.length > 0) {
      const ready = this.createDiv('', 'READY: Select a tile');
      ready.style.color = '#66d17a';
      container.append(ready);
    } else if (isReady && claimableTiles.length === 0) {
      container.append(this.createDiv('panel-muted', 'No claimable tiles available'));
    }

    return container;
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

function cityHasCoastalAccess(city: City, mapData: MapData, gridSystem: IGridSystem): boolean {
  const positions = [
    { x: city.tileX, y: city.tileY },
    ...gridSystem.getAdjacentCoords({ x: city.tileX, y: city.tileY }),
  ];

  return positions.some(({ x, y }) => {
    const tile = mapData.tiles[y]?.[x];
    return tile?.type === TileType.Coast || tile?.type === TileType.Ocean;
  });
}

function toCssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function formatYieldBonus(yieldBonus: TileYield): string {
  const parts = [
    { label: 'Food', value: yieldBonus.food },
    { label: 'Production', value: yieldBonus.production },
    { label: 'Gold', value: yieldBonus.gold },
  ]
    .filter((part) => part.value !== 0)
    .map((part) => `${formatSigned(part.value)} ${part.label}`);

  return parts.length > 0 ? parts.join(', ') : '+0';
}
