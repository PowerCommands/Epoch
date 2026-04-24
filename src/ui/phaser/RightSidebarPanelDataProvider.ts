import { ALL_BUILDINGS, getBuildingById } from '../../data/buildings';
import { getImprovementById } from '../../data/improvements';
import { getLeaderById, getLeaderByNationId } from '../../data/leaders';
import { getNaturalResourceById } from '../../data/naturalResources';
import { ALL_UNIT_TYPES } from '../../data/units';
import { CITY_BASE_DEFENSE, CITY_BASE_HEALTH } from '../../data/cities';
import type { City } from '../../entities/City';
import type { Unit } from '../../entities/Unit';
import { calculateCityEconomy } from '../../systems/CityEconomy';
import type { CityManager } from '../../systems/CityManager';
import type { CityTerritorySystem } from '../../systems/CityTerritorySystem';
import type { DiplomacyManager } from '../../systems/DiplomacyManager';
import type { DiscoverySystem } from '../../systems/DiscoverySystem';
import type { EventLogSystem } from '../../systems/EventLogSystem';
import type { HappinessSystem } from '../../systems/HappinessSystem';
import type { IGridSystem } from '../../systems/grid/IGridSystem';
import type { NationManager } from '../../systems/NationManager';
import type { ProductionSystem } from '../../systems/ProductionSystem';
import type { ResearchSystem } from '../../systems/ResearchSystem';
import type { BuildImprovementPreview } from '../../systems/BuilderSystem';
import type { CultureSystem } from '../../systems/culture/CultureSystem';
import type { Producible } from '../../types/producible';
import { TileType, type MapData, type Tile } from '../../types/map';
import { EMPTY_MODIFIERS } from '../../types/modifiers';
import type {
  RightSidebarContent,
  RightSidebarCityDetailsTab,
  RightSidebarDetailsState,
  RightSidebarDetailsView,
  RightSidebarLeaderboardCategory,
  RightSidebarRow,
  RightSidebarSection,
} from './RightSidebarPanelTypes';
import { RafScheduler } from '../../utils/RafScheduler';

type ChangedListener = () => void;
type BuilderHintProvider = (tile: Tile) => BuildImprovementPreview | null;
type BuildingPlacementRequestResult = { ok: boolean; message?: string };
type BuildingPlacementRequestHandler = (city: City, buildingId: string) => BuildingPlacementRequestResult;

interface LeaderboardEntry {
  nationId: string;
  name: string;
  color: number;
  score: number;
  detail: string;
}

export class RightSidebarPanelDataProvider {
  private readonly scheduler = new RafScheduler();
  private readonly listeners: ChangedListener[] = [];
  private diplomacyManager: DiplomacyManager | null = null;
  private discoverySystem: DiscoverySystem | null = null;
  private eventLog: EventLogSystem | null = null;
  private researchSystem: ResearchSystem | null = null;
  private cultureSystem: CultureSystem | null = null;
  private canFoundCity: ((unit: Unit) => boolean) | null = null;
  private foundCity: ((unit: Unit) => void) | null = null;
  private builderHintProvider: BuilderHintProvider | null = null;
  private buildingPlacementRequestHandler: BuildingPlacementRequestHandler | null = null;
  private current: RightSidebarDetailsState = {
    view: null,
    tile: null,
    city: null,
    unit: null,
    nationId: null,
    leaderId: null,
  };

  constructor(
    private readonly productionSystem: ProductionSystem,
    private readonly cityManager: CityManager,
    private readonly unitManager: { getUnit(id: string): Unit | undefined; getUnitAt(x: number, y: number): Unit | null; getUnitsByOwner(ownerId: string): Unit[]; getTransportForUnit(unit: Unit): Unit | undefined; getCargoForTransport(unit: Unit): Unit | undefined },
    private readonly nationManager: NationManager,
    private readonly mapData: MapData,
    private readonly humanNationId: string | undefined,
    private readonly cityTerritorySystem: CityTerritorySystem,
    private readonly gridSystem: IGridSystem,
    private readonly happinessSystem: HappinessSystem,
  ) {}

  onChanged(listener: ChangedListener): void {
    this.listeners.push(listener);
  }

  setDiplomacyManager(dm: DiplomacyManager): void {
    this.diplomacyManager = dm;
  }

  setResearchSystem(researchSystem: ResearchSystem): void {
    this.researchSystem = researchSystem;
  }

  setCultureSystem(cultureSystem: CultureSystem): void {
    this.cultureSystem = cultureSystem;
  }

  setDiscoverySystem(ds: DiscoverySystem): void {
    this.discoverySystem = ds;
  }

  setEventLog(log: EventLogSystem): void {
    this.eventLog = log;
    log.onChanged(() => this.notifyChanged());
  }

  setBuilderHintProvider(provider: BuilderHintProvider): void {
    this.builderHintProvider = provider;
  }

  setBuildingPlacementRequestHandler(handler: BuildingPlacementRequestHandler): void {
    this.buildingPlacementRequestHandler = handler;
  }

  setFoundCityHandler(canFoundCity: (unit: Unit) => boolean, foundCity: (unit: Unit) => void): void {
    this.canFoundCity = canFoundCity;
    this.foundCity = foundCity;
  }

  getCurrentCity(): City | null {
    return this.current.city;
  }

  getView(): RightSidebarDetailsView {
    return this.current.view;
  }

  getCurrentCityId(): string | null {
    return this.current.view === 'city' ? this.current.city?.id ?? null : null;
  }

  isShowingCity(cityId?: string): boolean {
    return cityId !== undefined && this.current.view === 'city' && this.current.city?.id === cityId;
  }

  isShowingUnit(unit: Unit): boolean {
    return this.current.view === 'unit' && this.current.unit?.id === unit.id;
  }

  showTile(tile: Tile): void {
    console.debug('[RightSidebarPanelDataProvider] selected target', { kind: 'tile', x: tile.x, y: tile.y });
    this.current = { view: 'tile', tile, city: null, unit: null, nationId: null, leaderId: null };
    this.notifyChanged();
  }

  showCity(city: City): void {
    console.debug('[RightSidebarPanelDataProvider] selected target', { kind: 'city', id: city.id, name: city.name });
    this.current = { view: 'city', tile: null, city, unit: null, nationId: null, leaderId: null };
    this.notifyChanged();
  }

  showUnit(unit: Unit): void {
    console.debug('[RightSidebarPanelDataProvider] selected target', { kind: 'unit', id: unit.id, name: unit.name });
    this.current = { view: 'unit', tile: null, city: null, unit, nationId: null, leaderId: null };
    this.notifyChanged();
  }

  showNation(nationId: string): void {
    this.current = { view: 'nation', tile: null, city: null, unit: null, nationId, leaderId: null };
    this.notifyChanged();
  }

  showLeader(leaderIdOrNationId: string): void {
    const leader = getLeaderById(leaderIdOrNationId) ?? getLeaderByNationId(leaderIdOrNationId);
    this.current = {
      view: 'leader',
      tile: null,
      city: null,
      unit: null,
      nationId: leader?.nationId ?? leaderIdOrNationId,
      leaderId: leader?.id ?? leaderIdOrNationId,
    };
    this.notifyChanged();
  }

  clear(): void {
    console.debug('[RightSidebarPanelDataProvider] selected target', { kind: 'none' });
    this.current = { view: null, tile: null, city: null, unit: null, nationId: null, leaderId: null };
    this.notifyChanged();
  }

  refreshCurrent(): void {
    if (this.current.view === 'unit' && this.current.unit && !this.unitManager.getUnit(this.current.unit.id)) {
      this.clear();
      return;
    }
    this.notifyChanged();
  }

  refreshNationView(): void {
    if (this.current.view === 'nation') this.notifyChanged();
  }

  refreshProductionQueue(cityId: string): void {
    if (this.current.city?.id === cityId) this.notifyChanged();
  }

  requestRefresh(): void {
    this.scheduler.schedule('refreshCurrent', () => this.refreshCurrent());
  }

  shutdown(): void {
    this.scheduler.cancel();
  }

  getDetailsContent(cityTab: RightSidebarCityDetailsTab = 'city'): RightSidebarContent {
    let content: RightSidebarContent;
    switch (this.current.view) {
      case 'tile':
        content = this.current.tile ? this.getTileContent(this.current.tile) : this.getEmptyDetailsContent();
        break;
      case 'city':
        content = this.current.city ? this.getCityContent(this.current.city, cityTab) : this.getEmptyDetailsContent();
        break;
      case 'unit':
        content = this.current.unit ? this.getUnitContent(this.current.unit) : this.getEmptyDetailsContent();
        break;
      case 'nation':
        content = this.current.nationId ? this.getNationContent(this.current.nationId) : this.getEmptyDetailsContent();
        break;
      case 'leader':
        content = this.current.leaderId ? this.getLeaderContent(this.current.leaderId) : this.getEmptyDetailsContent();
        break;
      case null:
        content = this.getEmptyDetailsContent();
        break;
    }
    console.debug('[RightSidebarPanelDataProvider] provider result', {
      view: this.current.view,
      sections: content.sections.length,
      rows: content.sections.reduce((sum, section) => sum + section.rows.length, 0),
    });
    return content;
  }

  getLeaderboardContent(category: RightSidebarLeaderboardCategory): RightSidebarContent {
    const section = this.getLeaderboardSectionByCategory(category);
    return {
      title: 'Leaderboard',
      sections: [section],
    };
  }

  getLogContent(): RightSidebarContent {
    const entries = this.eventLog?.getVisibleEntries() ?? [];
    return {
      title: 'Log',
      sections: [{
        title: 'Recent Events',
        rows: entries.length === 0
          ? [textRow('No events yet.', true)]
          : entries.slice().reverse().map((entry) => textRow(`T${entry.round}: ${entry.text}`)),
      }],
    };
  }

  private getEmptyDetailsContent(): RightSidebarContent {
    return {
      title: 'Details',
      sections: [{ title: 'Details', rows: [textRow('No selection', true)] }],
    };
  }

  private getTileContent(tile: Tile): RightSidebarContent {
    const owner = tile.ownerId ? this.nationManager.getNation(tile.ownerId) : undefined;
    const improvement = tile.improvementId ? getImprovementById(tile.improvementId) : undefined;
    const resource = tile.resourceId ? getNaturalResourceById(tile.resourceId) : undefined;
    const builderHint = this.builderHintProvider?.(tile) ?? null;
    const rows: RightSidebarRow[] = [
      textRow(tile.type, false, true),
      textRow(`Owner: ${owner?.name ?? 'Unclaimed'}`, false, false, owner?.color),
      textRow(`Resource: ${resource?.name ?? 'None'}`),
      textRow(`Improvement: ${improvement?.name ?? 'None'}`),
    ];
    if (resource) rows.push(textRow(`Resource bonus: ${formatYieldBonus(resource.yieldBonus)}`));
    if (improvement) rows.push(textRow(`Bonus: ${formatYieldBonus(improvement.yieldBonus)}`));
    if (builderHint) {
      rows.push(textRow(
        builderHint.canBuild && builderHint.improvement
          ? `Worker can construct ${builderHint.improvement.name} here`
          : `Worker cannot improve this tile${builderHint.reason ? `: ${builderHint.reason}` : ''}`,
        true,
      ));
    }
    return { title: 'Details', sections: [{ title: 'Tile', rows }] };
  }

  private getCityContent(city: City, tab: RightSidebarCityDetailsTab): RightSidebarContent {
    const nation = this.nationManager.getNation(city.ownerId);
    const resources = this.cityManager.getResources(city.id);
    const garrison = this.unitManager.getUnitAt(city.tileX, city.tileY);
    const buildings = this.cityManager.getBuildings(city.id).getAll();
    const economy = calculateCityEconomy(
      city,
      this.mapData,
      this.cityManager.getBuildings(city.id),
      this.gridSystem,
      EMPTY_MODIFIERS,
    );
    const isHuman = city.ownerId === this.humanNationId;
    const growthModifier = this.happinessSystem.getGrowthModifier(city.ownerId);
    const effectiveGrowthPerTurn = economy.netFood > 0 ? Math.floor(economy.netFood * growthModifier) : economy.netFood;
    const turnsUntilGrowth = effectiveGrowthPerTurn > 0
      ? Math.ceil((economy.foodToGrow - city.foodStorage) / effectiveGrowthPerTurn)
      : null;

    switch (tab) {
      case 'city':
        return {
          title: 'Details',
          sections: [{
        title: 'City',
        rows: [
          textRow(city.name, false, true, nation?.color),
          textRow(`Owner: ${nation?.name ?? 'Unknown'}`),
          textRow(`Capital: ${city.isCapital ? 'Yes' : 'No'}`),
          textRow(`Population: ${city.population}`),
          textRow(`Health: ${city.health}/${CITY_BASE_HEALTH}`),
          progressRow('Health', city.health, CITY_BASE_HEALTH),
          textRow(`Tile position: ${city.tileX}, ${city.tileY}`),
          textRow(`Defense: ${CITY_BASE_DEFENSE}`),
          textRow(`Garrison: ${garrison?.name ?? 'none'}`),
        ],
          }],
        };
      case 'growth':
        return {
          title: 'Details',
          sections: [{
        title: 'Growth',
        rows: [
          textRow(`Food stored: ${city.foodStorage} / ${economy.foodToGrow}`),
          textRow(`Food: ${formatSigned(economy.food)}/turn (base ${economy.baseFood} + ${economy.food - economy.baseFood} tiles/buildings)`),
          textRow(`Consumption: -${economy.foodConsumption}/turn (${city.population} pop x 2)`),
          textRow(`Net food: ${formatSigned(effectiveGrowthPerTurn)}/turn`),
          progressRow('Food', city.foodStorage, economy.foodToGrow),
          textRow(`Growth in: ${turnsUntilGrowth !== null ? `${turnsUntilGrowth} turn${turnsUntilGrowth !== 1 ? 's' : ''}` : '-'}`),
          textRow(`Culture stored: ${city.culture}`),
          textRow(`Culture per turn: +${resources.culturePerTurn}/turn`),
          ...this.getCultureClaimRows(city, isHuman),
          ...(growthModifier < 1.0 ? [textRow(`Global happiness growth modifier: x${growthModifier.toFixed(2)}`, true)] : []),
        ],
          }],
        };
      case 'output':
        return {
          title: 'Details',
          sections: [{
        title: 'Output',
        rows: [
          textRow(`Worked tiles: ${economy.workedTileCount} / ${economy.maxWorkableTiles}`),
          textRow(`Food: ${formatSigned(economy.food)}/turn`),
          textRow(`Production: ${resources.production} stored (+${resources.productionPerTurn}/turn)`),
          textRow(`Gold: +${resources.goldPerTurn}/turn`),
          textRow(`Science: +${resources.sciencePerTurn}/turn`),
          textRow(`Culture per turn: +${resources.culturePerTurn}/turn`),
          textRow(`Happiness: +${resources.happinessPerTurn}/turn`),
          textRow(`Buildings: ${buildings.length > 0 ? buildings.map((id) => getBuildingById(id)?.name ?? id).join(', ') : 'none'}`),
        ],
          }],
        };
      case 'production': {
        const sections = [this.getProductionQueueSection(city, isHuman)];
        if (isHuman) sections.push(this.getAddToQueueSection(city));
        return { title: 'Details', sections };
      }
    }
  }

  private getUnitContent(unit: Unit): RightSidebarContent {
    const nation = this.nationManager.getNation(unit.ownerId);
    const rows: RightSidebarRow[] = [
      textRow(`${unit.name} (${unit.unitType.name})`, false, true),
      textRow(`Owner: ${nation?.name ?? 'Unknown'}`, false, false, nation?.color),
      textRow(`HP: ${unit.health}/${unit.unitType.baseHealth}`),
      progressRow('Health', unit.health, unit.unitType.baseHealth),
      textRow(`Strength: ${unit.unitType.baseStrength}`),
      textRow(`Range: ${unit.unitType.range ?? 1}`),
      textRow(`Movement: ${unit.movementPoints}/${unit.maxMovementPoints}`),
    ];
    const transport = this.unitManager.getTransportForUnit(unit);
    if (transport) rows.push(textRow(`Onboard: ${transport.name}`, true));
    const cargo = this.unitManager.getCargoForTransport(unit);
    if (cargo) rows.push(textRow(`Carrying: ${cargo.name}`, true));
    if (unit.unitType.canFound && this.canFoundCity?.(unit)) {
      rows.push(buttonRow('Found City', () => {
        this.foundCity?.(unit);
        this.requestRefresh();
      }, 0x7fbf6a));
    }
    return { title: 'Details', sections: [{ title: 'Unit', rows }] };
  }

  private getNationContent(nationId: string): RightSidebarContent {
    const nation = this.nationManager.getNation(nationId);
    if (!nation) return { title: 'Details', sections: [{ title: 'Nation', rows: [textRow('Nation not found.', true)] }] };
    const isHuman = nationId === this.humanNationId;
    const resources = this.nationManager.getResources(nationId);
    const cities = this.cityManager.getCitiesByOwner(nationId);
    const units = this.unitManager.getUnitsByOwner(nationId);
    const happiness = this.happinessSystem.getNationState(nationId);
    const unitCounts = new Map<string, number>();
    for (const unit of units) unitCounts.set(unit.unitType.name, (unitCounts.get(unit.unitType.name) ?? 0) + 1);

    const sections: RightSidebarSection[] = [
      {
        title: 'Nation',
        rows: [textRow(`${nation.name}${isHuman ? ' (You)' : ''}`, false, true, nation.color)],
      },
      {
        title: 'Economy',
        rows: [
          textRow(`Gold: ${resources.gold} (+${resources.goldPerTurn}/turn)`),
          textRow(`Culture: ${resources.culture} (+${resources.culturePerTurn}/turn)`),
          textRow(`Influence: ${resources.influence} (+${resources.influencePerTurn}/turn)`),
          textRow(`Happiness: ${formatSigned(happiness.netHappiness)}`),
        ],
      },
      {
        title: 'Happiness',
        rows: [
          textRow(`Total Happiness: ${happiness.totalHappiness}`),
          textRow(`Total Unhappiness: ${happiness.totalUnhappiness}`),
          textRow(`Net Happiness: ${formatSigned(happiness.netHappiness)}`),
          textRow(`Base Happiness: ${happiness.breakdown.baseHappiness}`),
          textRow(`Building Happiness: ${happiness.breakdown.buildingHappiness}`),
          textRow(`City Unhappiness: ${happiness.breakdown.cityUnhappiness}`),
          textRow(`Population Unhappiness: ${happiness.breakdown.populationUnhappiness}`),
          textRow(`Growth penalty: x${happiness.growthModifier.toFixed(2)}`),
          textRow(`Production penalty: x${happiness.productionModifier.toFixed(2)}`),
        ],
      },
      this.getCivicsSummarySection(nationId),
      {
        title: `Cities (${cities.length})`,
        rows: cities.length === 0
          ? [textRow('No cities', true)]
          : cities.map((city) => buttonRow(`${city.name}${city.isCapital ? ' ★' : ''}  HP ${city.health}/${CITY_BASE_HEALTH}`, () => {
            window.dispatchEvent(new CustomEvent('focusCity', { detail: { cityId: city.id } }));
          }, nation.color)),
      },
      {
        title: `Military (${units.length} units)`,
        rows: unitCounts.size === 0
          ? [textRow('No units', true)]
          : [...unitCounts.entries()].map(([typeName, count]) => textRow(`${count}x ${typeName}`)),
      },
    ];
    if (!isHuman && this.diplomacyManager && this.humanNationId && this.isNationKnown(nationId)) {
      sections.push(this.getDiplomacySection(nationId));
    }
    return { title: 'Details', sections };
  }

  private getLeaderContent(leaderIdOrNationId: string): RightSidebarContent {
    const leader = getLeaderById(leaderIdOrNationId) ?? getLeaderByNationId(leaderIdOrNationId);
    if (!leader) return { title: 'Details', sections: [{ title: 'Leader', rows: [textRow('Leader not found.', true)] }] };
    const nation = this.nationManager.getNation(leader.nationId);
    const sections: RightSidebarSection[] = [
      {
        title: 'Leader',
        rows: [
          textRow(leader.name, false, true, nation?.color),
          textRow(nation?.name ?? 'Unknown nation', false, false, nation?.color),
          ...(leader.title ? [textRow(leader.title)] : []),
          ...(leader.description ? [textRow(leader.description, true)] : []),
        ],
      },
      this.getLeaderNationSection(leader.nationId),
      this.getLeaderUnitsSection(leader.nationId, leader.nationId === this.humanNationId),
    ];
    if (leader.nationId !== this.humanNationId && this.diplomacyManager && this.humanNationId && this.isNationKnown(leader.nationId)) {
      sections.push(this.getDiplomacySection(leader.nationId));
    }
    return { title: 'Details', sections };
  }

  private getProductionQueueSection(city: City, isHuman: boolean): RightSidebarSection {
    const queue = this.productionSystem.getQueue(city.id);
    if (queue.length === 0) return { title: 'Production Queue', rows: [textRow('No production queued', true)] };
    const rows: RightSidebarRow[] = [];
    queue.forEach((entry, index) => {
      const name = getProducibleName(entry.item);
      const turnsText = entry.blockedReason ? 'blocked' : `${entry.turnsRemaining} turn${entry.turnsRemaining !== 1 ? 's' : ''}`;
      const label = `${index + 1}. ${name} (${turnsText})${index === 0 ? ' [active]' : ''}`;
      rows.push(isHuman
        ? buttonRow(label, () => {
          this.productionSystem.removeFromQueue(city.id, index);
          this.requestRefresh();
        }, 0xb86767, '🗑️')
        : textRow(label));
      if (index === 0 && !entry.blockedReason) rows.push(progressRow('Progress', entry.progress, entry.cost));
      if (entry.blockedReason) rows.push(textRow(entry.blockedReason, true));
    });
    return { title: 'Production Queue', rows };
  }

  private getAddToQueueSection(city: City): RightSidebarSection {
    const hasCoastalAccess = cityHasCoastalAccess(city, this.mapData, this.gridSystem);
    const reservedBuildingIds = new Set(
      city.ownedTileCoords
        .map((coord) => this.mapData.tiles[coord.y]?.[coord.x]?.buildingConstruction?.buildingId)
        .filter((buildingId): buildingId is string => buildingId !== undefined),
    );
    const rows: RightSidebarRow[] = [];
    for (const unitType of ALL_UNIT_TYPES) {
      if (unitType.isNaval && !hasCoastalAccess) continue;
      if (this.researchSystem && !this.researchSystem.isUnitUnlocked(city.ownerId, unitType.id)) continue;
      const item: Producible = { kind: 'unit', unitType };
      rows.push(buttonRow(`${getProducibleName(item)} (${this.productionSystem.getCost(item)})`, () => {
        this.productionSystem.enqueue(city.id, item);
        this.requestRefresh();
      }, 0x6aa7d8));
    }
    rows.push({ kind: 'separator' });
    for (const buildingType of ALL_BUILDINGS) {
      if (this.cityManager.getBuildings(city.id).has(buildingType.id)) continue;
      if (reservedBuildingIds.has(buildingType.id)) continue;
      if (this.researchSystem && !this.researchSystem.isBuildingUnlocked(city.ownerId, buildingType.id)) continue;
      const item: Producible = { kind: 'building', buildingType };
      rows.push(buttonRow(`${getProducibleName(item)} (${this.productionSystem.getCost(item)})`, () => {
        if (this.buildingPlacementRequestHandler) {
          const result = this.buildingPlacementRequestHandler(city, buildingType.id);
          if (!result.ok && result.message) window.alert(result.message);
          return;
        }
        this.productionSystem.enqueue(city.id, item);
        this.requestRefresh();
      }, 0x7fbf6a));
    }
    return { title: 'Add to Queue', rows };
  }

  private getCultureClaimRows(city: City, isHuman: boolean): RightSidebarRow[] {
    const cost = this.cityTerritorySystem.getClaimCost(city, this.mapData);
    const claimableTiles = this.cityTerritorySystem.getClaimableTiles(city, this.mapData);
    const rows: RightSidebarRow[] = [
      textRow(`Next tile: ${cost} culture`),
      progressRow('Culture', city.culture, cost),
    ];
    if (city.culture >= cost && isHuman && claimableTiles.length > 0) rows.push(textRow('READY: Select a tile', false, false, 0x66d17a));
    if (city.culture >= cost && claimableTiles.length === 0) rows.push(textRow('No claimable tiles available', true));
    return rows;
  }

  private getCivicsSummarySection(nationId: string): RightSidebarSection {
    if (!this.cultureSystem) return { title: 'Civics', rows: [textRow('Culture system unavailable.', true)] };
    const current = this.cultureSystem.getCurrentCultureNode(nationId);
    const progress = this.cultureSystem.getCultureProgress(nationId);
    const unlockedNodes = this.cultureSystem.getUnlockedCultureNodes(nationId);
    return {
      title: 'Civics',
      rows: [
        textRow(`Active Civic: ${current?.name ?? 'None selected'}`),
        textRow(current ? `Progress: ${progress} / ${this.cultureSystem.getEffectiveCost(current.id)}` : `Stored Progress: ${progress}`),
        textRow(`Culture applied each turn: +${this.cultureSystem.getCulturePerTurn(nationId)}`, true),
        textRow(`Completed civics: ${unlockedNodes.length}`, true),
      ],
    };
  }

  private getLeaderNationSection(nationId: string): RightSidebarSection {
    const nation = this.nationManager.getNation(nationId);
    if (!nation) return { title: 'Nation', rows: [textRow('Nation not found.', true)] };
    const resources = this.nationManager.getResources(nationId);
    const cities = this.cityManager.getCitiesByOwner(nationId);
    const units = this.unitManager.getUnitsByOwner(nationId);
    const capital = cities.find((city) => city.isCapital);
    return {
      title: 'Nation',
      rows: [
        textRow(nation.name, false, true, nation.color),
        textRow(`Capital: ${capital?.name ?? 'none'}`),
        textRow(`Gold: ${resources.gold} (+${resources.goldPerTurn}/turn)`),
        textRow(`Cities: ${cities.length}`),
        textRow(`Units: ${units.length}`),
        textRow(`Territory: ${this.nationManager.getTileCount(nationId, this.mapData)} tiles`),
      ],
    };
  }

  private getLeaderUnitsSection(nationId: string, isHuman: boolean): RightSidebarSection {
    const units = this.unitManager.getUnitsByOwner(nationId);
    return {
      title: `Units (${units.length})`,
      rows: units.length === 0
        ? [textRow('No units', true)]
        : units.map((unit) => buttonRow(`${unit.unitType.name}${isHuman && unit.isSleeping ? ' (sleeping)' : ''}  HP ${unit.health}/${unit.unitType.baseHealth}`, () => {
          window.dispatchEvent(new CustomEvent('focusUnit', { detail: { unitId: unit.id } }));
        })),
    };
  }

  private getDiplomacySection(nationId: string): RightSidebarSection {
    const dm = this.diplomacyManager!;
    const humanId = this.humanNationId!;
    const relation = dm.getRelation(humanId, nationId);
    const nation = this.nationManager.getNation(nationId);
    const rows: RightSidebarRow[] = [
      textRow(`Status: ${relation.state === 'WAR' ? 'At War' : 'At Peace'}`),
    ];
    if (relation.state === 'PEACE') rows.push(textRow(`Borders: ${relation.openBorders ? 'Open' : 'Closed'}`));
    rows.push(buttonRow(relation.state === 'PEACE' ? 'Declare War' : 'Propose Peace', () => {
      document.dispatchEvent(new CustomEvent('diplomacyAction', {
        detail: { action: relation.state === 'PEACE' ? 'declareWar' : 'proposePeace', targetNationId: nationId },
      }));
    }, relation.state === 'PEACE' ? 0xb86767 : nation?.color));
    if (relation.state === 'PEACE') {
      rows.push(buttonRow(relation.openBorders ? 'Cancel Open Borders' : 'Open Borders', () => {
        document.dispatchEvent(new CustomEvent('diplomacyAction', {
          detail: { action: 'toggleOpenBorders', targetNationId: nationId },
        }));
      }, nation?.color));
    }
    return { title: 'Diplomacy', rows };
  }

  private getLeaderboardSection(title: string, entries: LeaderboardEntry[]): RightSidebarSection {
    return {
      title,
      rows: entries.length === 0
        ? [textRow('No leaderboard data available.', true)]
        : entries.map((entry, index) => textRow(`${index + 1}. ${entry.name}: ${entry.score} (${entry.detail})`, false, false, entry.color)),
    };
  }

  private getLeaderboardSectionByCategory(category: RightSidebarLeaderboardCategory): RightSidebarSection {
    switch (category) {
      case 'domination':
        return this.getLeaderboardSection('⚔️ Domination', this.getDominationLeaderboard());
      case 'diplomacy':
        return this.getLeaderboardSection('🕊️ Diplomacy', this.getDiplomacyLeaderboard());
      case 'research':
        return this.getLeaderboardSection('🔬 Research', this.getResearchLeaderboard());
      case 'culture':
        return this.getLeaderboardSection('⭐ Culture', this.getCultureLeaderboard());
    }
  }

  private getDominationLeaderboard(): LeaderboardEntry[] {
    const capitals = this.cityManager.getAllCities().filter((city) => city.isCapital);
    return this.sortLeaderboard(this.nationManager.getAllNations().map((nation) => {
      const score = capitals.filter((city) => city.ownerId === nation.id).length;
      return { nationId: nation.id, name: nation.name, color: nation.color, score, detail: `${score}/${capitals.length} capitals` };
    }));
  }

  private getResearchLeaderboard(): LeaderboardEntry[] {
    return this.sortLeaderboard(this.nationManager.getAllNations().map((nation) => {
      const researched = this.researchSystem?.getResearchedTechnologies(nation.id).length ?? 0;
      const current = this.researchSystem?.getCurrentResearch(nation.id);
      const progress = current && this.researchSystem
        ? Math.round((this.researchSystem.getResearchProgress(nation.id) / Math.max(1, this.researchSystem.getEffectiveCost(current.id))) * 100)
        : 0;
      return { nationId: nation.id, name: nation.name, color: nation.color, score: researched * 100 + progress, detail: `${researched} techs${current ? `, ${progress}% ${current.name}` : ''}` };
    }));
  }

  private getCultureLeaderboard(): LeaderboardEntry[] {
    return this.sortLeaderboard(this.nationManager.getAllNations().map((nation) => {
      const unlocked = this.cultureSystem?.getUnlockedCultureNodes(nation.id).length ?? 0;
      const current = this.cultureSystem?.getCurrentCultureNode(nation.id);
      const progress = current && this.cultureSystem
        ? Math.round((this.cultureSystem.getCultureProgress(nation.id) / Math.max(1, this.cultureSystem.getEffectiveCost(current.id))) * 100)
        : 0;
      return { nationId: nation.id, name: nation.name, color: nation.color, score: unlocked * 100 + progress, detail: `${unlocked} civics${current ? `, ${progress}% ${current.name}` : ''}` };
    }));
  }

  private getDiplomacyLeaderboard(): LeaderboardEntry[] {
    return this.sortLeaderboard(this.nationManager.getAllNations().map((nation) => ({
      nationId: nation.id,
      name: nation.name,
      color: nation.color,
      score: 0,
      detail: 'Not implemented',
    })));
  }

  private sortLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
    return entries.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  }

  private isNationKnown(nationId: string): boolean {
    if (!this.discoverySystem || !this.humanNationId) return true;
    return this.discoverySystem.hasMet(this.humanNationId, nationId);
  }

  private notifyChanged(): void {
    for (const listener of this.listeners) listener();
  }
}

function textRow(text: string, muted = false, large = false, color?: number): RightSidebarRow {
  return { kind: 'text', text, muted, large, color };
}

function buttonRow(text: string, onClick: () => void, accentColor?: number, trailingIcon?: string): RightSidebarRow {
  return { kind: 'button', text, onClick, accentColor, trailingIcon };
}

function progressRow(label: string, current: number, max: number): RightSidebarRow {
  return { kind: 'progress', label, current, max };
}

function getProducibleName(item: Producible): string {
  return item.kind === 'unit' ? item.unitType.name : item.buildingType.name;
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

function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function formatYieldBonus(yieldBonus: {
  food: number;
  production: number;
  gold: number;
  science?: number;
  culture?: number;
  happiness?: number;
}): string {
  const parts = [
    { label: 'Food', value: yieldBonus.food },
    { label: 'Production', value: yieldBonus.production },
    { label: 'Gold', value: yieldBonus.gold },
    { label: 'Science', value: yieldBonus.science ?? 0 },
    { label: 'Culture', value: yieldBonus.culture ?? 0 },
    { label: 'Happiness', value: yieldBonus.happiness ?? 0 },
  ]
    .filter((part) => part.value !== 0)
    .map((part) => `${formatSigned(part.value)} ${part.label}`);
  return parts.length > 0 ? parts.join(', ') : '+0';
}
