import { ALL_BUILDINGS, getBuildingById } from '../../data/buildings';
import { getImprovementById } from '../../data/improvements';
import { getLeaderById, getLeaderByNationId } from '../../data/leaders';
import { getNaturalResourceById } from '../../data/naturalResources';
import type { Era } from '../../data/technologies';
import { ALL_UNIT_TYPES } from '../../data/units';
import { ALL_WONDERS } from '../../data/wonders';
import { CITY_BASE_DEFENSE, CITY_BASE_HEALTH } from '../../data/cities';
import type { City } from '../../entities/City';
import type { Nation } from '../../entities/Nation';
import type { Unit } from '../../entities/Unit';
import { calculateCityEconomy } from '../../systems/CityEconomy';
import type { CityManager } from '../../systems/CityManager';
import type { CityTerritorySystem } from '../../systems/CityTerritorySystem';
import type { DiplomacyManager } from '../../systems/DiplomacyManager';
import type { DiscoverySystem } from '../../systems/DiscoverySystem';
import type { EventLogSystem } from '../../systems/EventLogSystem';
import type { EraSystem } from '../../systems/EraSystem';
import type { HappinessSystem } from '../../systems/HappinessSystem';
import { formatPercent, formatHappinessStateLabel, luxuryResourceLabels } from '../happinessFormat';
import type { IGridSystem } from '../../systems/grid/IGridSystem';
import type { NationManager } from '../../systems/NationManager';
import type { AIMilitaryEvaluationSystem } from '../../systems/ai/AIMilitaryEvaluationSystem';
import type { AIMilitaryThreatEvaluationSystem } from '../../systems/ai/AIMilitaryThreatEvaluationSystem';
import type { DiplomaticEvaluationSystem } from '../../systems/diplomacy/DiplomaticEvaluationSystem';
import { canCityProduceUnit, getCityUnitProductionBlockReason } from '../../systems/ProductionRules';
import type { ProductionSystem, QueueEntryView } from '../../systems/ProductionSystem';
import type { ResearchSystem } from '../../systems/ResearchSystem';
import type { BuildImprovementPreview } from '../../systems/BuilderSystem';
import type { CultureSystem } from '../../systems/culture/CultureSystem';
import type { WonderSystem } from '../../systems/WonderSystem';
import type { TradeDealSystem } from '../../systems/TradeDealSystem';
import type { ResourceAccessSystem } from '../../systems/ResourceAccessSystem';
import type { StrategicResourceCapacitySystem } from '../../systems/StrategicResourceCapacitySystem';
import type { TradeDeal } from '../../types/tradeDeal';
import type { Producible } from '../../types/producible';
import type { MapData, Tile } from '../../types/map';
import { EMPTY_MODIFIERS } from '../../types/modifiers';
import { getUnitSpritePath, getWonderSpritePath } from '../../utils/assetPaths';
import type {
  RightSidebarContent,
  RightSidebarCityDetailsTab,
  RightSidebarDetailsState,
  RightSidebarDetailsView,
  RightSidebarLeaderDetailsTab,
  RightSidebarLeaderboardCategory,
  RightSidebarRow,
  RightSidebarSection,
} from './RightSidebarPanelTypes';
import { RafScheduler } from '../../utils/RafScheduler';

type ChangedListener = () => void;
type BuilderHintProvider = (tile: Tile) => BuildImprovementPreview | null;
type BuildingPlacementRequestResult = { ok: boolean; message?: string };
type BuildingPlacementRequestHandler = (city: City, buildingId: string) => BuildingPlacementRequestResult;
type WonderPlacementRequestHandler = (city: City, wonderId: string) => BuildingPlacementRequestResult;
type WonderPlacementAvailabilityProvider = (city: City, wonderId: string) => boolean;
type BuyProductionRequestHandler = (city: City, index: number) => void;

const CITY_SPRITE_PATH = 'assets/sprites/city_default.png';

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
  private diplomaticEvaluationSystem: DiplomaticEvaluationSystem | null = null;
  private militaryEvaluationSystem: AIMilitaryEvaluationSystem | null = null;
  private threatEvaluationSystem: AIMilitaryThreatEvaluationSystem | null = null;
  private discoverySystem: DiscoverySystem | null = null;
  private eventLog: EventLogSystem | null = null;
  private researchSystem: ResearchSystem | null = null;
  private cultureSystem: CultureSystem | null = null;
  private wonderSystem: WonderSystem | null = null;
  private tradeDealSystem: TradeDealSystem | null = null;
  private resourceAccessSystem: ResourceAccessSystem | null = null;
  private eraSystem: EraSystem | null = null;
  private readonly tradeMessages = new Map<string, string>();
  private canFoundCity: ((unit: Unit) => boolean) | null = null;
  private foundCity: ((unit: Unit) => void) | null = null;
  private builderHintProvider: BuilderHintProvider | null = null;
  private buildingPlacementRequestHandler: BuildingPlacementRequestHandler | null = null;
  private wonderPlacementRequestHandler: WonderPlacementRequestHandler | null = null;
  private wonderPlacementAvailabilityProvider: WonderPlacementAvailabilityProvider | null = null;
  private buyProductionRequestHandler: BuyProductionRequestHandler | null = null;
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
    private readonly strategicResourceCapacitySystem?: StrategicResourceCapacitySystem,
  ) {}

  onChanged(listener: ChangedListener): void {
    this.listeners.push(listener);
  }

  setDiplomacyManager(dm: DiplomacyManager): void {
    this.diplomacyManager = dm;
  }

  setDiplomaticEvaluationSystem(system: DiplomaticEvaluationSystem): void {
    this.diplomaticEvaluationSystem = system;
  }

  setMilitaryEvaluationSystem(system: AIMilitaryEvaluationSystem): void {
    this.militaryEvaluationSystem = system;
  }

  setThreatEvaluationSystem(system: AIMilitaryThreatEvaluationSystem): void {
    this.threatEvaluationSystem = system;
  }

  setResearchSystem(researchSystem: ResearchSystem): void {
    this.researchSystem = researchSystem;
  }

  setCultureSystem(cultureSystem: CultureSystem): void {
    this.cultureSystem = cultureSystem;
  }

  setWonderSystem(wonderSystem: WonderSystem): void {
    this.wonderSystem = wonderSystem;
  }

  setTradeDealSystem(tradeDealSystem: TradeDealSystem): void {
    this.tradeDealSystem = tradeDealSystem;
  }

  setResourceAccessSystem(resourceAccessSystem: ResourceAccessSystem): void {
    this.resourceAccessSystem = resourceAccessSystem;
  }

  setEraSystem(eraSystem: EraSystem): void {
    this.eraSystem = eraSystem;
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

  setWonderPlacementRequestHandler(handler: WonderPlacementRequestHandler): void {
    this.wonderPlacementRequestHandler = handler;
  }

  setWonderPlacementAvailabilityProvider(provider: WonderPlacementAvailabilityProvider): void {
    this.wonderPlacementAvailabilityProvider = provider;
  }

  setBuyProductionRequestHandler(handler: BuyProductionRequestHandler): void {
    this.buyProductionRequestHandler = handler;
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

  getCurrentLeaderId(): string | null {
    return this.current.view === 'leader' ? this.current.leaderId : null;
  }

  getCurrentLeaderNationId(): string | null {
    return this.current.view === 'leader' ? this.current.nationId : null;
  }

  getVisibleLeaderDiplomacyNations(): Nation[] {
    return this.nationManager.getAllNations()
      .filter((nation) => this.isVisibleInLeaderDiagnostics(nation.id))
      .sort((a, b) => a.name.localeCompare(b.name));
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

  getDetailsContent(
    cityTab: RightSidebarCityDetailsTab = 'city',
    leaderTab: RightSidebarLeaderDetailsTab = 'details',
  ): RightSidebarContent {
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
        content = this.current.nationId
          ? this.getNationContent(this.current.nationId)
          : this.getEmptyDetailsContent();
        break;
      case 'leader':
        content = this.current.leaderId
          ? this.getLeaderContent(this.current.leaderId, leaderTab)
          : this.getEmptyDetailsContent();
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
    const improvementConstruction = tile.improvementConstruction;
    const constructingImprovement = improvementConstruction
      ? getImprovementById(improvementConstruction.improvementId)
      : undefined;
    const resource = tile.resourceId ? getNaturalResourceById(tile.resourceId) : undefined;
    const builderHint = this.builderHintProvider?.(tile) ?? null;
    const rows: RightSidebarRow[] = [
      textRow(tile.type, false, true),
      textRow(`Owner: ${owner?.name ?? 'Unclaimed'}`, false, false, owner?.color),
      textRow(`Resource: ${resource?.name ?? 'None'}`),
      textRow(`Improvement: ${improvement?.name ?? 'None'}`),
    ];
    if (improvementConstruction) {
      rows.push(textRow(
        `${constructingImprovement?.name ?? 'Improvement'} under construction: ${improvementConstruction.remainingTurns} turns remaining`,
        true,
      ));
    }
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
    }
  }

  private getUnitContent(unit: Unit): RightSidebarContent {
    const nation = this.nationManager.getNation(unit.ownerId);
    const unitConstruction = this.getImprovementConstructionForUnit(unit.id);
    const constructingImprovement = unitConstruction
      ? getImprovementById(unitConstruction.construction.improvementId)
      : undefined;
    const rows: RightSidebarRow[] = [
      textRow(`${unit.name} (${unit.unitType.name})`, false, true),
      textRow(`Owner: ${nation?.name ?? 'Unknown'}`, false, false, nation?.color),
      textRow(`HP: ${unit.health}/${unit.unitType.baseHealth}`),
      progressRow('Health', unit.health, unit.unitType.baseHealth),
      textRow(`Strength: ${unit.unitType.baseStrength}`),
      textRow(`Range: ${unit.unitType.range ?? 1}`),
      textRow(`Movement: ${unit.movementPoints}/${unit.maxMovementPoints}`),
    ];
    if (unit.improvementCharges !== undefined) {
      rows.push(textRow(`Improvements left: ${unit.improvementCharges}`));
    }
    if (unitConstruction) {
      rows.push(textRow(
        `Building ${constructingImprovement?.name ?? 'improvement'}: ${unitConstruction.construction.remainingTurns} turns remaining`,
        true,
      ));
    }
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
    const era = this.eraSystem?.getNationEra(nationId);
    const unitCounts = new Map<string, number>();
    for (const unit of units) unitCounts.set(unit.unitType.name, (unitCounts.get(unit.unitType.name) ?? 0) + 1);

    const sections: RightSidebarSection[] = [
      {
        title: 'Nation',
        rows: [
          textRow(`${nation.name}${isHuman ? ' (You)' : ''}`, false, true, nation.color),
          ...(era ? [textRow(`Era: ${formatEraLabel(era)}`)] : []),
        ],
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
          textRow(`Happiness: ${formatSigned(happiness.netHappiness)} — ${formatHappinessStateLabel(happiness.state)}`, false, true),
          textRow('Sources:', true),
          textRow(`Base: ${formatSigned(happiness.happinessFromBase)}`),
          textRow(`Buildings: ${formatSigned(happiness.happinessFromBuildings)}`),
          textRow(`Wonders: ${formatSigned(happiness.happinessFromWonders)}`),
          textRow(`Luxury resources: ${formatSigned(happiness.happinessFromLuxuryResources)}`),
          ...luxuryResourceLabels(happiness.availableLuxuryResourceQuantities).map((label) => textRow(`  • ${label}`, true)),
          textRow('Unhappiness:', true),
          textRow(`Cities: -${happiness.unhappinessFromCities}`),
          textRow(`Population: -${happiness.unhappinessFromPopulation}`),
          textRow('Effects:', true),
          textRow(`Growth: ${formatPercent(happiness.growthModifier)}`),
          textRow(`Production: ${formatPercent(happiness.productionModifier)}`),
          textRow(`Culture: ${formatPercent(happiness.cultureModifier)}`),
          textRow(`Gold: ${formatPercent(happiness.goldModifier)}`),
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

  private getLeaderContent(
    leaderIdOrNationId: string,
    tab: RightSidebarLeaderDetailsTab,
  ): RightSidebarContent {
    const leader = getLeaderById(leaderIdOrNationId) ?? getLeaderByNationId(leaderIdOrNationId);
    if (!leader) return { title: 'Details', sections: [{ title: 'Leader', rows: [textRow('Leader not found.', true)] }] };

    switch (tab) {
      case 'details':
        return this.getLeaderDetailsContent(leader);
      case 'units':
        return this.getLeaderUnitsContent(leader);
      case 'cities':
        return this.getLeaderCitiesContent(leader);
      case 'diplomacy':
        return this.getLeaderDiplomacyContent(leader);
      case 'trade':
        return this.getLeaderTradeContent(leader);
      case 'deals':
        return this.getLeaderDealsContent(leader);
    }
  }

  private getLeaderDetailsContent(leader: { name: string; nationId: string; title?: string; description?: string }): RightSidebarContent {
    const nation = this.nationManager.getNation(leader.nationId);
    return {
      title: 'Leader Details',
      sections: [
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
        this.getLeaderTerritorySection(leader.nationId),
      ],
    };
  }

  private getLeaderUnitsContent(leader: { nationId: string }): RightSidebarContent {
    return {
      title: 'Leader Details',
      sections: [this.getLeaderUnitsSection(leader.nationId, leader.nationId === this.humanNationId)],
    };
  }

  private getLeaderCitiesContent(leader: { nationId: string }): RightSidebarContent {
    return {
      title: 'Leader Details',
      sections: [this.getLeaderCitiesSection(leader.nationId)],
    };
  }

  private getLeaderDiplomacyContent(leader: { nationId: string }): RightSidebarContent {
    if (leader.nationId === this.humanNationId) {
      return { title: 'Leader Details', sections: [{ title: 'Diplomacy', rows: [textRow('Select another nation to manage diplomacy.', true)] }] };
    }
    if (!this.diplomacyManager || !this.humanNationId || !this.isNationKnown(leader.nationId)) {
      return { title: 'Leader Details', sections: [{ title: 'Diplomacy', rows: [textRow('You have not met this nation.', true)] }] };
    }
    return { title: 'Leader Details', sections: [this.getDiplomacySection(leader.nationId)] };
  }

  private getLeaderTradeContent(leader: { nationId: string }): RightSidebarContent {
    const rows: RightSidebarRow[] = [];
    if (leader.nationId === this.humanNationId) {
      rows.push(textRow('Select another nation to trade with.', true));
      return { title: 'Leader Details', sections: [{ title: 'Trade', rows }] };
    }
    if (!this.diplomacyManager || !this.humanNationId || !this.isNationKnown(leader.nationId)) {
      rows.push(textRow('You have not met this nation.', true));
      return { title: 'Leader Details', sections: [{ title: 'Trade', rows }] };
    }
    if (this.diplomacyManager.getState(this.humanNationId, leader.nationId) === 'WAR') {
      rows.push(textRow('Unavailable during war.', true));
      return { title: 'Leader Details', sections: [{ title: 'Trade', rows }] };
    }
    if (!this.diplomacyManager.hasTradeRelations(this.humanNationId, leader.nationId)) {
      rows.push(textRow('Trade requires active Trade Relations.', true));
      return { title: 'Leader Details', sections: [{ title: 'Trade', rows }] };
    }
    rows.push(...this.getTradeTabRows(leader.nationId));
    return { title: 'Leader Details', sections: [{ title: 'Trade', rows }] };
  }

  private getLeaderDealsContent(leader: { nationId: string }): RightSidebarContent {
    const rows: RightSidebarRow[] = [];
    if (!this.tradeDealSystem || !this.humanNationId) {
      rows.push(textRow('Trade system unavailable.', true));
      return { title: 'Leader Details', sections: [{ title: 'Deals', rows }] };
    }
    const deals = leader.nationId === this.humanNationId
      ? this.tradeDealSystem.getDealsForNation(this.humanNationId)
      : this.tradeDealSystem.getDealsBetween(this.humanNationId, leader.nationId);
    if (deals.length === 0) {
      rows.push(textRow('No active deals.', true));
      return { title: 'Leader Details', sections: [{ title: 'Deals', rows }] };
    }
    for (const deal of deals) rows.push(textRow(this.formatDealRow(deal)));
    return { title: 'Leader Details', sections: [{ title: 'Deals', rows }] };
  }

  private getProductionQueueSection(city: City, isHuman: boolean): RightSidebarSection {
    const queue = this.getVisibleProductionQueue(city.id);
    if (queue.length === 0) return { title: 'Production Queue', rows: [textRow('No production queued', true)] };
    const rows: RightSidebarRow[] = [];
    const availableGold = isHuman ? this.nationManager.getResources(city.ownerId).gold : 0;
    queue.forEach(({ entry, index }, visibleIndex) => {
      const name = getProducibleName(entry.item);
      const spritePath = getProducibleSpritePath(entry.item);
      const turnsText = entry.blockedReason ? 'blocked' : `${entry.turnsRemaining} turn${entry.turnsRemaining !== 1 ? 's' : ''}`;
      const label = `${visibleIndex + 1}. ${name} (${turnsText})${index === 0 ? ' [active]' : ''}`;
      rows.push(isHuman
        ? buttonRow(label, () => {
          this.productionSystem.removeFromQueue(city.id, index);
          this.requestRefresh();
        }, 0xb86767, '🗑️', spritePath)
        : textRow(label, false, false, undefined, spritePath));
      if (isHuman) {
        const buyCost = this.productionSystem.getBuyCost(city.id, index);
        if (buyCost !== null) {
          const canBuy = availableGold >= buyCost;
          const buyLabel = canBuy
            ? `💰 Buy for ${buyCost} gold`
            : `💰 Need ${buyCost - availableGold} more gold`;
          rows.push({
            kind: 'button',
            text: buyLabel,
            disabled: !canBuy,
            accentColor: 0xe0c060,
            onClick: () => {
              if (!canBuy) return;
              this.buyProductionRequestHandler?.(city, index);
            },
          });
        }
      }
      if (index === 0 && !entry.blockedReason) rows.push(progressRow('Progress', entry.progress, entry.cost));
      if (entry.blockedReason) rows.push(textRow(entry.blockedReason, true));
    });
    return { title: 'Production Queue', rows };
  }

  private getVisibleProductionQueue(cityId: string): Array<{ entry: QueueEntryView; index: number }> {
    return this.productionSystem.getQueue(cityId)
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => !this.isCompletedWonderQueueEntry(entry));
  }

  private isCompletedWonderQueueEntry(entry: QueueEntryView): boolean {
    return entry.item.kind === 'wonder'
      && this.wonderSystem?.isWonderBuilt(entry.item.wonderType.id) === true;
  }

  private getAddToQueueSection(city: City): RightSidebarSection {
    const reservedBuildingIds = new Set(
      city.ownedTileCoords
        .map((coord) => this.mapData.tiles[coord.y]?.[coord.x]?.buildingConstruction?.buildingId)
        .filter((buildingId): buildingId is string => buildingId !== undefined),
    );
    const rows: RightSidebarRow[] = [];
    for (const unitType of ALL_UNIT_TYPES) {
      if (this.researchSystem && !this.researchSystem.isUnitUnlocked(city.ownerId, unitType.id)) continue;
      const disabledReason = getCityUnitProductionBlockReason(
        city,
        unitType,
        this.mapData,
        this.gridSystem,
        { strategicResourceCapacitySystem: this.strategicResourceCapacitySystem },
      );
      if (disabledReason && !unitType.requiredResource) continue;
      const item: Producible = { kind: 'unit', unitType };
      rows.push({
        kind: 'button',
        text: disabledReason
          ? `${getProducibleName(item)} (${this.productionSystem.getCost(item)}) - ${disabledReason}`
          : `${getProducibleName(item)} (${this.productionSystem.getCost(item)})`,
        disabled: disabledReason !== undefined,
        accentColor: 0x6aa7d8,
        spritePath: getProducibleSpritePath(item),
        onClick: () => {
          if (!canCityProduceUnit(
            city,
            unitType,
            this.mapData,
            this.gridSystem,
            { strategicResourceCapacitySystem: this.strategicResourceCapacitySystem },
          )) return;
        this.productionSystem.enqueue(city.id, item);
        this.requestRefresh();
        },
      });
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

  private getWonderSection(city: City): RightSidebarSection {
    const rows: RightSidebarRow[] = [];
    const research = this.researchSystem;
    const wonderSystem = this.wonderSystem;
    const isQueuedHere = (wonderId: string): boolean => this.productionSystem.getQueue(city.id)
      .some((entry) => entry.item.kind === 'wonder' && entry.item.wonderType.id === wonderId);

    const wonderTypes = wonderSystem?.getAvailableWonders(ALL_WONDERS) ?? ALL_WONDERS;
    for (const wonderType of wonderTypes) {
      const techUnlocked = research ? research.isWonderUnlocked(city.ownerId, wonderType.id) : true;
      if (!techUnlocked) continue;

      const item: Producible = { kind: 'wonder', wonderType };
      const cost = this.productionSystem.getCost(item);
      const queuedHere = isQueuedHere(wonderType.id);
      const cityCanBuild = wonderSystem ? wonderSystem.canCityBuildWonder(city, wonderType, { researchSystem: research ?? undefined }) : true;
      const hasValidPlacement = this.wonderPlacementAvailabilityProvider
        ? this.wonderPlacementAvailabilityProvider(city, wonderType.id)
        : true;

      let disabled = false;
      let reason: string | undefined;
      if (queuedHere) { disabled = true; reason = 'Already in this queue'; }
      else if (!cityCanBuild) { disabled = true; reason = 'This city cannot build it'; }
      else if (!hasValidPlacement) { disabled = true; reason = 'No valid placement tile'; }

      const baseLabel = `${wonderType.name} (${cost})`;
      const label = reason ? `${baseLabel} — ${reason}` : `${baseLabel} — ${wonderType.description}`;
      rows.push({
        kind: 'button',
        text: label,
        disabled,
        accentColor: 0xd9b84a,
        spritePath: getProducibleSpritePath(item),
        onClick: () => {
          if (disabled) return;
          if (this.wonderPlacementRequestHandler) {
            const result = this.wonderPlacementRequestHandler(city, wonderType.id);
            if (!result.ok && result.message) window.alert(result.message);
            return;
          }
          this.productionSystem.enqueue(city.id, item);
          this.requestRefresh();
        },
      });
    }

    if (rows.length === 0) {
      rows.push(textRow('No wonders available — research a prerequisite tech.', true));
    }
    return { title: 'World Wonders', rows };
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
    const capital = cities.find((city) => city.isCapital);
    const era = this.eraSystem?.getNationEra(nationId);
    return {
      title: 'Nation',
      rows: [
        textRow(nation.name, false, true, nation.color),
        ...(era ? [textRow(`Era: ${formatEraLabel(era)}`)] : []),
        textRow(`Capital: ${capital?.name ?? 'none'}`),
        textRow(`Gold: ${resources.gold} (+${resources.goldPerTurn}/turn)`),
        textRow(`Cities: ${cities.length}`),
      ],
    };
  }

  private getLeaderTerritorySection(nationId: string): RightSidebarSection {
    const happiness = this.happinessSystem.getNationState(nationId);
    const value = this.happinessSystem.getHappinessForNation(nationId);
    return {
      title: 'Territory',
      rows: [
        textRow(`Territory: ${this.nationManager.getTileCount(nationId, this.mapData)} tiles`),
        textRow(`😀 ${formatSigned(value)} (${formatHappinessStateLabel(happiness.state)})`),
      ],
    };
  }

  private getLeaderUnitsSection(nationId: string, isHuman: boolean): RightSidebarSection {
    const units = this.unitManager.getUnitsByOwner(nationId);
    return {
      title: `Units (${units.length})`,
      rows: this.renderUnitList(units, isHuman),
    };
  }

  private renderUnitList(units: Unit[], isHuman: boolean): RightSidebarRow[] {
    if (units.length === 0) return [textRow('No units', true)];
    return units.map((unit) => {
      const movement = `MP ${unit.movementPoints}/${unit.maxMovementPoints}`;
      const sleeping = isHuman && unit.isSleeping ? ' (sleeping)' : '';
      return buttonRow(
        `${unit.unitType.name}${sleeping}  HP ${unit.health}/${unit.unitType.baseHealth}  ${movement}`,
        () => {
          window.dispatchEvent(new CustomEvent('focusUnit', { detail: { unitId: unit.id } }));
        },
        undefined,
        undefined,
        getUnitSpritePath(unit.unitType.id),
      );
    });
  }

  private getLeaderCitiesSection(nationId: string): RightSidebarSection {
    const cities = this.cityManager.getCitiesByOwner(nationId);
    return {
      title: `Cities (${cities.length})`,
      rows: this.renderCityList(cities),
    };
  }

  private renderCityList(cities: City[]): RightSidebarRow[] {
    if (cities.length === 0) return [textRow('No cities', true)];
    return cities.map((city) => {
      const activeProduction = this.getVisibleProductionQueue(city.id)[0]?.entry.item;
      const productionLabel = activeProduction ? getProducibleName(activeProduction) : 'None';
      return buttonRow(
        `${city.name}${city.isCapital ? ' ★' : ''}  Pop ${city.population}  HP ${city.health}/${CITY_BASE_HEALTH}  Production: ${productionLabel}`,
        () => {
          window.dispatchEvent(new CustomEvent('leaderCityFocusRequested', { detail: { cityId: city.id } }));
        },
        undefined,
        undefined,
        CITY_SPRITE_PATH,
      );
    });
  }

  private getDiplomacySection(nationId: string): RightSidebarSection {
    const dm = this.diplomacyManager!;
    const humanId = this.humanNationId!;
    const relation = dm.getRelation(humanId, nationId);
    const nation = this.nationManager.getNation(nationId);
    const validationContext = {
      haveMet: (a: string, b: string): boolean => this.discoverySystem?.hasMet(a, b) ?? true,
      hasTechnology: (targetNationId: string, techId: string): boolean =>
        this.researchSystem?.isResearched(targetNationId, techId) ?? false,
    };
    // Open borders are now directional: this row reflects whether the human
    // has granted the other nation passage. The toggle below flips that grant.
    const humanGrantsBorders = dm.isOpenBorderGrantedFrom(humanId, nationId);
    const hasHumanEmbassy = dm.hasEmbassy(humanId, nationId);
    const hasTheirEmbassy = dm.hasEmbassy(nationId, humanId);
    const hasTradeRelations = dm.hasTradeRelations(humanId, nationId);
    const embassyValidation = dm.canEstablishEmbassy(humanId, nationId, validationContext);
    const tradeValidation = dm.canEstablishTradeRelations(humanId, nationId, validationContext);
    const openBordersUnavailableReason = relation.state === 'WAR' ? 'Unavailable during war.' : undefined;
    const rows: RightSidebarRow[] = [];

    rows.push(textRow(`Status: ${relation.state}`));
    rows.push(textRow(`Open Borders: ${humanGrantsBorders ? 'Open' : 'Closed'}`));
    rows.push(disabledReasonButtonRow(
      humanGrantsBorders ? 'Cancel Open Borders' : 'Open Borders',
      openBordersUnavailableReason,
      () => {
        document.dispatchEvent(new CustomEvent('diplomacyAction', {
          detail: { action: 'toggleOpenBorders', targetNationId: nationId },
        }));
      },
      nation?.color,
    ));
    if (openBordersUnavailableReason) rows.push(textRow(openBordersUnavailableReason, true));
    rows.push(textRow(`Your Embassy: ${hasHumanEmbassy ? 'Established' : 'Not established'}`));
    rows.push(textRow(`Their Embassy: ${hasTheirEmbassy ? 'Established' : 'Not established'}`));
    rows.push(disabledReasonButtonRow(
      hasHumanEmbassy ? 'Embassy Established' : 'Establish Embassy',
      hasHumanEmbassy ? 'Embassy already established.' : embassyValidation.reason,
      () => {
        document.dispatchEvent(new CustomEvent('diplomacyAction', {
          detail: { action: 'establishEmbassy', targetNationId: nationId },
        }));
      },
      nation?.color,
    ));
    if (!hasHumanEmbassy && embassyValidation.reason) rows.push(textRow(embassyValidation.reason, true));
    rows.push(textRow(`Trade Relations: ${hasTradeRelations ? 'Active' : 'Inactive'}`));
    rows.push(disabledReasonButtonRow(
      hasTradeRelations ? 'Cancel Trade Relations' : 'Establish Trade Relations',
      hasTradeRelations ? undefined : tradeValidation.reason,
      () => {
        document.dispatchEvent(new CustomEvent('diplomacyAction', {
          detail: {
            action: hasTradeRelations ? 'cancelTradeRelations' : 'establishTradeRelations',
            targetNationId: nationId,
          },
        }));
      },
      hasTradeRelations ? 0xb86767 : nation?.color,
    ));
    if (!hasTradeRelations && tradeValidation.reason) rows.push(textRow(tradeValidation.reason, true));
    rows.push(buttonRow(relation.state === 'PEACE' ? 'Declare War' : 'Propose Peace', () => {
      document.dispatchEvent(new CustomEvent('diplomacyAction', {
        detail: { action: relation.state === 'PEACE' ? 'declareWar' : 'proposePeace', targetNationId: nationId },
      }));
    }, relation.state === 'PEACE' ? 0xb86767 : nation?.color));
    return { title: 'Diplomacy', rows };
  }

  private getTradeTabRows(otherNationId: string): RightSidebarRow[] {
    const rows: RightSidebarRow[] = [];
    if (!this.tradeDealSystem || !this.resourceAccessSystem || !this.humanNationId) {
      rows.push(textRow('Trade system unavailable.', true));
      return rows;
    }
    const playerId = this.humanNationId;
    const otherNation = this.nationManager.getNation(otherNationId);
    const otherOwned = this.resourceAccessSystem.getOwnedResources(otherNationId);
    const playerOwned = this.resourceAccessSystem.getOwnedResources(playerId);
    const existingDeals = this.tradeDealSystem.getDealsBetween(playerId, otherNationId);
    const importedFromSeller = new Set(
      existingDeals
        .filter((deal) => deal.sellerNationId === otherNationId && deal.buyerNationId === playerId)
        .map((deal) => deal.resourceId),
    );

    rows.push(textRow(`${otherNation?.name ?? otherNationId} can sell to you`, false, true));
    if (otherOwned.length === 0) {
      rows.push(textRow('No resources to sell.', true));
    } else {
      for (const resourceId of otherOwned) {
        rows.push(textRow(this.formatResourceName(resourceId)));
        const alreadyImporting = importedFromSeller.has(resourceId);
        rows.push({
          kind: 'button',
          text: alreadyImporting ? 'Already importing' : 'Buy (10 turns) — 5 gold/turn',
          accentColor: otherNation?.color,
          disabled: alreadyImporting,
          onClick: () => this.createTradeDealRequest(otherNationId, resourceId, 10, 5),
        });
        rows.push({
          kind: 'button',
          text: alreadyImporting ? 'Already importing' : 'Buy (20 turns) — 4 gold/turn',
          accentColor: otherNation?.color,
          disabled: alreadyImporting,
          onClick: () => this.createTradeDealRequest(otherNationId, resourceId, 20, 4),
        });
      }
    }

    rows.push({ kind: 'separator' });
    rows.push(textRow('You can sell to them', false, true));
    if (playerOwned.length === 0) {
      rows.push(textRow('You have no resources to offer.', true));
    } else {
      for (const resourceId of playerOwned) {
        rows.push(textRow(this.formatResourceName(resourceId)));
      }
    }

    const message = this.tradeMessages.get(otherNationId);
    if (message) {
      rows.push(textRow(message, true));
    }
    return rows;
  }

  private createTradeDealRequest(
    sellerNationId: string,
    resourceId: string,
    turns: number,
    goldPerTurn: number,
  ): void {
    if (!this.tradeDealSystem || !this.humanNationId) return;
    const result = this.tradeDealSystem.createDeal({
      sellerNationId,
      buyerNationId: this.humanNationId,
      resourceId,
      turns,
      goldPerTurn,
    });
    if (result.ok) {
      this.tradeMessages.delete(sellerNationId);
      return;
    }
    this.tradeMessages.set(sellerNationId, result.reason ?? 'Trade deal failed.');
    this.requestRefresh();
  }

  private formatResourceName(resourceId: string): string {
    return getNaturalResourceById(resourceId)?.name ?? resourceId;
  }

  private formatDealRow(deal: TradeDeal): string {
    const resourceName = this.formatResourceName(deal.resourceId);
    const sellerSide = deal.sellerNationId === this.humanNationId
      ? 'You'
      : this.nationManager.getNation(deal.sellerNationId)?.name ?? deal.sellerNationId;
    const buyerSide = deal.buyerNationId === this.humanNationId
      ? 'You'
      : this.nationManager.getNation(deal.buyerNationId)?.name ?? deal.buyerNationId;
    const turnsWord = deal.remainingTurns === 1 ? 'turn' : 'turns';
    return `${resourceName}: ${sellerSide} → ${buyerSide} | ${deal.goldPerTurn} gold/turn | ${deal.remainingTurns} ${turnsWord} left`;
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

  private isVisibleInLeaderDiagnostics(nationId: string): boolean {
    if (nationId === this.humanNationId) return true;
    return this.isNationKnown(nationId);
  }

  private notifyChanged(): void {
    for (const listener of this.listeners) listener();
  }

  private getImprovementConstructionForUnit(unitId: string): { tile: Tile; construction: NonNullable<Tile['improvementConstruction']> } | null {
    for (const row of this.mapData.tiles) {
      for (const tile of row) {
        const construction = tile.improvementConstruction;
        if (construction?.unitId === unitId) {
          return { tile, construction };
        }
      }
    }
    return null;
  }
}

function textRow(text: string, muted = false, large = false, color?: number, spritePath?: string): RightSidebarRow {
  return { kind: 'text', text, muted, large, color, spritePath };
}

function formatEraLabel(era: Era): string {
  return era.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function buttonRow(text: string, onClick: () => void, accentColor?: number, trailingIcon?: string, spritePath?: string): RightSidebarRow {
  return { kind: 'button', text, onClick, accentColor, trailingIcon, spritePath };
}

function disabledReasonButtonRow(
  text: string,
  disabledReason: string | undefined,
  onClick: () => void,
  accentColor?: number,
): RightSidebarRow {
  return {
    kind: 'button',
    text,
    disabled: disabledReason !== undefined,
    accentColor,
    onClick,
  };
}

function progressRow(label: string, current: number, max: number): RightSidebarRow {
  return { kind: 'progress', label, current, max };
}

function getProducibleName(item: Producible): string {
  switch (item.kind) {
    case 'unit':
      return item.unitType.name;
    case 'building':
      return item.buildingType.name;
    case 'wonder':
      return item.wonderType.name;
  }
}

function getProducibleSpritePath(item: Producible): string | undefined {
  switch (item.kind) {
    case 'unit':
      return getUnitSpritePath(item.unitType.id);
    case 'wonder':
      return getWonderSpritePath(item.wonderType.id);
    case 'building':
      return undefined;
  }
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
