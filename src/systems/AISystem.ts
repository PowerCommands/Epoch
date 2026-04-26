import type { Unit } from '../entities/Unit';
import type { City } from '../entities/City';
import type { UnitType } from '../entities/UnitType';
import type { MapData, Tile } from '../types/map';
import type { GridCoord } from '../types/grid';
import type { Producible } from '../types/producible';
import { TileType } from '../types/map';
import { ALL_UNIT_TYPES, WARRIOR, ARCHER, SETTLER } from '../data/units';
import { GRANARY, WORKSHOP, MARKET } from '../data/buildings';
import { UnitManager } from './UnitManager';
import { CityManager } from './CityManager';
import { NationManager } from './NationManager';
import { TurnManager } from './TurnManager';
import { getTileMovementCost, MovementSystem } from './MovementSystem';
import { CombatSystem } from './CombatSystem';
import { ProductionSystem } from './ProductionSystem';
import { canCityProduceUnit } from './ProductionRules';
import { FoundCitySystem } from './FoundCitySystem';
import { PathfindingSystem } from './PathfindingSystem';
import { calculateCityEconomy } from './CityEconomy';
import { getAIStrategyById } from '../data/aiStrategies';
import type { AIStrategy } from '../types/aiStrategy';
import type { IGridSystem } from './grid/IGridSystem';
import { EMPTY_MODIFIERS } from '../types/modifiers';
import type { ResearchSystem } from './ResearchSystem';
import type { DiplomacyManager } from './DiplomacyManager';
import type { HappinessSystem } from './HappinessSystem';
import { AIStrategySelector, type AIStrategyContext } from './ai/AIStrategySelector';
import {
  pickBestAIProductionCandidate,
  type AIProductionCandidate,
} from './ai/AIProductionScoring';
import { scoreCombatTarget, type AICombatContext } from './ai/AICombatScoring';
import {
  pickBestMovementCandidate,
  type AIMovementCandidate,
} from './ai/AIMovementScoring';
import { CITY_BASE_HEALTH } from '../data/cities';

// Friendly-support radius is not yet exposed via AIStrategy; preserved here
// so baseline behavior matches the pre-refactor profile.
const FRIENDLY_SUPPORT_DISTANCE = 2;
const NEAR_OWN_CITY_DISTANCE = 3;

// Structural type guard — Unit/City are imported as types, so `instanceof`
// is unavailable. `unitType` is unique to Unit.
function isUnit(target: Unit | City): target is Unit {
  return (target as Unit).unitType !== undefined;
}
const MILITARY_OPTIONS = ALL_UNIT_TYPES.filter((unitType) => (
  unitType.baseStrength > 0
));

// Base scores reflect how acute the underlying need is. Strategy weights then
// reshape the final ordering, but the raw signal always comes from city state.
const SCORE_ACUTE_DEFENDER = 100;
const SCORE_SETTLER = 80;
const SCORE_MILITARY = 70;
const SCORE_FOOD_BUILDING = 65;
const SCORE_PRODUCTION_BUILDING = 60;
const SCORE_GOLD_BUILDING = 55;
const SCORE_FALLBACK = 25;
const LOW_GOLD_PER_TURN = 0;

/**
 * AISystem kör grundläggande AI för icke-mänskliga nationer.
 *
 * Prioritetsordning per tur:
 * 0. Settlers — found the first city immediately, then expand toward spaced sites
 * 1. Strid — attackera angränsande fiender (skip 0-strength units)
 * 2. Rörelse — gå mot närmaste fiendestad
 * 3. Produktion — respektera 2-warrior cap, settler-villkor
 */
export class AISystem {
  private readonly unitManager: UnitManager;
  private readonly cityManager: CityManager;
  private readonly nationManager: NationManager;
  private readonly turnManager: TurnManager;
  private readonly movementSystem: MovementSystem;
  private readonly pathfindingSystem: PathfindingSystem;
  private readonly combatSystem: CombatSystem;
  private readonly productionSystem: ProductionSystem;
  private readonly foundCitySystem: FoundCitySystem;
  private readonly mapData: MapData;
  private readonly strategySelector = new AIStrategySelector();

  constructor(
    unitManager: UnitManager,
    cityManager: CityManager,
    nationManager: NationManager,
    turnManager: TurnManager,
    movementSystem: MovementSystem,
    pathfindingSystem: PathfindingSystem,
    combatSystem: CombatSystem,
    productionSystem: ProductionSystem,
    foundCitySystem: FoundCitySystem,
    mapData: MapData,
    private readonly gridSystem: IGridSystem,
    private readonly researchSystem?: ResearchSystem,
    private readonly diplomacyManager?: DiplomacyManager,
    private readonly happinessSystem?: HappinessSystem,
  ) {
    this.unitManager = unitManager;
    this.cityManager = cityManager;
    this.nationManager = nationManager;
    this.turnManager = turnManager;
    this.movementSystem = movementSystem;
    this.pathfindingSystem = pathfindingSystem;
    this.combatSystem = combatSystem;
    this.productionSystem = productionSystem;
    this.foundCitySystem = foundCitySystem;
    this.mapData = mapData;
  }

  isHuman(nationId: string): boolean {
    const nation = this.nationManager.getNation(nationId);
    return nation?.isHuman ?? false;
  }

  runTurn(nationId: string): void {
    this.updateStrategyForNation(nationId);
    this.runSettlers(nationId);
    this.runCombat(nationId);
    this.runMovement(nationId);
    this.runProduction(nationId);
  }

  // ─── Strategy selection ──────────────────────────────────────────────────────

  private updateStrategyForNation(nationId: string): void {
    const nation = this.nationManager.getNation(nationId);
    if (!nation || nation.isHuman) return; // humans never get auto-selected

    const context = this.buildStrategyContext(nationId);
    const nextId = this.strategySelector.selectStrategy(context);
    if (nation.aiStrategyId !== nextId) {
      nation.aiStrategyId = nextId;
    }
  }

  private buildStrategyContext(nationId: string): AIStrategyContext {
    const cityCount = this.cityManager.getCitiesByOwner(nationId).length;
    const unitCount = this.unitManager.getUnitsByOwner(nationId).length;
    const resources = this.nationManager.getResources(nationId);

    // TODO: derive enemyMilitaryNearby from a proper threat scan.
    return {
      nationId,
      cityCount,
      unitCount,
      gold: resources.gold,
      goldPerTurn: resources.goldPerTurn,
      netHappiness: this.happinessSystem?.getNetHappiness(nationId) ?? 0,
      atWar: this.isAtWarWithAnyone(nationId),
      enemyMilitaryNearby: false,
    };
  }

  private isAtWarWithAnyone(nationId: string): boolean {
    if (!this.diplomacyManager) return false;
    for (const other of this.nationManager.getAllNations()) {
      if (other.id === nationId) continue;
      if (this.diplomacyManager.getState(nationId, other.id) === 'WAR') return true;
    }
    return false;
  }

  // ─── Settlers ────────────────────────────────────────────────────────────────

  private runSettlers(nationId: string): void {
    const settlers = this.unitManager.getUnitsByOwner(nationId)
      .filter((u) => u.unitType.canFound);
    const strategy = this.getStrategy(nationId);

    for (const settler of settlers) {
      if (this.unitManager.getUnit(settler.id) === undefined) continue;

      const ownsNoCities = this.cityManager.getCitiesByOwner(nationId).length === 0;
      const isOpeningRound = this.turnManager.getCurrentRound() === 1;

      // Opening-round rule: every AI founds its capital immediately if possible.
      if (isOpeningRound && ownsNoCities && this.foundCitySystem.canFound(settler)) {
        this.foundCitySystem.foundCity(settler);
        continue; // settler consumed
      }

      // Later settlers respect spacing from all existing cities.
      if (this.foundCitySystem.canFound(settler)) {
        const allCities = this.cityManager.getAllCities();
        const minDist = this.minDistanceToCities(settler.tileX, settler.tileY, allCities);
        if (minDist >= strategy.expansion.settlerMinCityDistance) {
          this.foundCitySystem.foundCity(settler);
          continue; // settler consumed
        }
      }

      // Move toward valid founding site
      this.moveSettlerTowardSite(settler, nationId, strategy);
    }
  }

  private moveSettlerTowardSite(settler: Unit, nationId: string, strategy: AIStrategy): void {
    const target = this.findFoundingSite(settler, nationId, strategy);
    if (!target) return;

    const path = this.pathfindingSystem.findPath(settler, target.x, target.y, {
      respectMovementPoints: false,
    });
    if (path === null) return;

    this.movementSystem.moveAlongPath(settler, path);

    if (settler.tileX === target.x && settler.tileY === target.y) {
      if (this.foundCitySystem.canFound(settler)) {
        this.foundCitySystem.foundCity(settler);
      }
    }
  }

  private findFoundingSite(
    settler: Unit,
    _nationId: string,
    strategy: AIStrategy,
  ): { x: number; y: number } | null {
    const allCities = this.cityManager.getAllCities();

    let bestTile: { x: number; y: number } | null = null;
    let bestDist = Infinity;

    for (let y = 0; y < this.mapData.height; y++) {
      for (let x = 0; x < this.mapData.width; x++) {
        const tile = this.mapData.tiles[y][x];
        if (tile.type === TileType.Ocean || tile.type === TileType.Coast || tile.type === TileType.Ice) continue;
        if (this.cityManager.getCityAt(x, y) !== undefined) continue;

        const cityDist = this.minDistanceToCities(x, y, allCities);
        if (cityDist < strategy.expansion.settlerMinCityDistance) continue;

        const settlerDist = this.gridSystem.getDistance(
          { x: settler.tileX, y: settler.tileY },
          { x, y },
        );
        if (settlerDist < bestDist) {
          bestDist = settlerDist;
          bestTile = { x, y };
        }
      }
    }

    return bestTile;
  }

  private minDistanceToCities(tileX: number, tileY: number, cities: City[]): number {
    if (cities.length === 0) return Infinity;
    let min = Infinity;
    for (const city of cities) {
      const d = this.gridSystem.getDistance(
        { x: city.tileX, y: city.tileY },
        { x: tileX, y: tileY },
      );
      if (d < min) min = d;
    }
    return min;
  }

  // ─── Combat ──────────────────────────────────────────────────────────────────

  private runCombat(nationId: string): void {
    const units = this.unitManager.getUnitsByOwner(nationId);
    const strategy = this.getStrategy(nationId);

    for (const unit of units) {
      if (unit.movementPoints <= 0) continue;
      if (unit.unitType.baseStrength <= 0) continue; // settlers can't attack
      if (!this.canTakeAggressiveAction(unit, strategy)) continue;
      if (this.unitManager.getUnit(unit.id) === undefined) continue;

      this.tryAttackBestTarget(unit, nationId, strategy);
    }
  }

  // Strategy-based scoring allows AI to prioritize targets differently
  // without changing core combat rules.
  private tryAttackBestTarget(unit: Unit, nationId: string, strategy: AIStrategy): boolean {
    const range = unit.unitType.range ?? 1;
    const tiles = this.gridSystem.getTilesInRange(
      { x: unit.tileX, y: unit.tileY },
      range,
      this.mapData,
      { includeCenter: false },
    );

    const scored: { x: number; y: number; score: number }[] = [];
    for (const tile of tiles) {
      const target = this.findEnemyTargetAt(tile.x, tile.y, nationId);
      if (!target) continue;

      const context = this.buildCombatContext(unit, target, nationId, tile.x, tile.y);
      const score = scoreCombatTarget(context, strategy);
      scored.push({ x: tile.x, y: tile.y, score });
    }

    if (scored.length === 0) return false;

    scored.sort((a, b) => b.score - a.score);
    if (scored[0].score < 0) return false; // not worth attacking this turn

    for (const candidate of scored) {
      if (candidate.score < 0) break;
      if (this.combatSystem.tryAttack(unit, candidate.x, candidate.y)) return true;
    }
    return false;
  }

  private findEnemyTargetAt(
    tileX: number,
    tileY: number,
    nationId: string,
  ): Unit | City | undefined {
    const targetUnit = this.unitManager.getUnitAt(tileX, tileY);
    if (targetUnit && targetUnit.ownerId !== nationId) return targetUnit;

    const targetCity = this.cityManager.getCityAt(tileX, tileY);
    if (targetCity && targetCity.ownerId !== nationId) return targetCity;

    return undefined;
  }

  private buildCombatContext(
    attacker: Unit,
    target: Unit | City,
    nationId: string,
    targetX: number,
    targetY: number,
  ): AICombatContext {
    const attackerPosition = { x: attacker.tileX, y: attacker.tileY };
    const targetPosition = { x: targetX, y: targetY };
    const distance = this.gridSystem.getDistance(attackerPosition, targetPosition);
    const isTargetUnit = isUnit(target);
    const isTargetCity = !isTargetUnit;

    const canAttack = this.diplomacyManager
      ? this.diplomacyManager.canAttack(nationId, target.ownerId)
      : true;

    const targetHealthRatio = isTargetUnit
      ? target.health / target.unitType.baseHealth
      : target.health / CITY_BASE_HEALTH;

    return {
      attacker,
      attackerPosition,
      target,
      targetPosition,
      distance,
      canAttack,
      attackerHealthRatio: attacker.health / attacker.unitType.baseHealth,
      targetHealthRatio,
      isTargetCity,
      isTargetUnit,
      isNearOwnCity: this.isNearOwnCity(targetPosition, nationId),
    };
  }

  private isNearOwnCity(position: GridCoord, nationId: string): boolean {
    const ownCities = this.cityManager.getCitiesByOwner(nationId);
    for (const city of ownCities) {
      const dist = this.gridSystem.getDistance(
        { x: city.tileX, y: city.tileY },
        position,
      );
      if (dist <= NEAR_OWN_CITY_DISTANCE) return true;
    }
    return false;
  }

  // ─── Movement ────────────────────────────────────────────────────────────────

  private runMovement(nationId: string): void {
    const units = this.unitManager.getUnitsByOwner(nationId);
    const strategy = this.getStrategy(nationId);

    for (const unit of units) {
      if (unit.movementPoints <= 0) continue;
      if (unit.unitType.isNaval) continue;
      if (unit.unitType.canFound) continue; // settlers handled in runSettlers
      if (!this.canTakeAggressiveAction(unit, strategy)) continue;
      if (this.unitManager.getUnit(unit.id) === undefined) continue;

      this.moveByStrategyScoring(unit, nationId, strategy);
    }
  }

  // Strategy-based movement scoring shapes where AI units want to go,
  // while existing pathfinding and movement rules still decide how they move.
  private moveByStrategyScoring(unit: Unit, nationId: string, strategy: AIStrategy): void {
    const choices = this.collectMovementChoices(unit, nationId, strategy);
    if (choices.length === 0) return; // fallback: hold position

    const candidates = choices.map((choice) => choice.candidate);
    const best = pickBestMovementCandidate(candidates, strategy);
    if (!best) return;

    const chosen = choices.find((c) => c.candidate === best);
    if (!chosen || !chosen.path) return; // holdPosition or unreachable

    this.movementSystem.moveAlongPath(unit, chosen.path);
  }

  private collectMovementChoices(
    unit: Unit,
    nationId: string,
    strategy: AIStrategy,
  ): { candidate: AIMovementCandidate; path: Tile[] | null }[] {
    const choices: { candidate: AIMovementCandidate; path: Tile[] | null }[] = [];
    const unitPos = { x: unit.tileX, y: unit.tileY };
    const engageDistance = strategy.military.engageDistance;

    // Enemy cities — approach via adjacent tile, gated by engageDistance.
    for (const city of this.cityManager.getAllCities()) {
      if (city.ownerId === nationId) continue;
      const dest = { x: city.tileX, y: city.tileY };
      const distance = this.gridSystem.getDistance(unitPos, dest);
      if (distance > engageDistance) continue;

      const path = this.findApproachPath(unit, dest);
      choices.push({
        candidate: this.buildMovementCandidate(
          dest,
          'enemyCity',
          distance,
          path,
          nationId,
        ),
        path,
      });
    }

    // Enemy units — approach adjacently, also gated by engageDistance.
    for (const enemy of this.unitManager.getAllUnits()) {
      if (enemy.ownerId === nationId) continue;
      const dest = { x: enemy.tileX, y: enemy.tileY };
      const distance = this.gridSystem.getDistance(unitPos, dest);
      if (distance > engageDistance) continue;

      const path = this.findApproachPath(unit, dest);
      choices.push({
        candidate: this.buildMovementCandidate(
          dest,
          'enemyUnit',
          distance,
          path,
          nationId,
        ),
        path,
      });
    }

    // Own cities — useful for defensive strategies and pulling back to safety.
    for (const ownCity of this.cityManager.getCitiesByOwner(nationId)) {
      const dest = { x: ownCity.tileX, y: ownCity.tileY };
      if (dest.x === unitPos.x && dest.y === unitPos.y) continue;
      const distance = this.gridSystem.getDistance(unitPos, dest);

      const path = this.findApproachPath(unit, dest);
      choices.push({
        candidate: this.buildMovementCandidate(
          dest,
          'ownCity',
          distance,
          path,
          nationId,
        ),
        path,
      });
    }

    // Friendly settlers — escort opportunities for combat units.
    if (unit.unitType.baseStrength > 0) {
      for (const friendly of this.unitManager.getUnitsByOwner(nationId)) {
        if (friendly.id === unit.id) continue;
        if (friendly.unitType.canFound !== true) continue;
        const dest = { x: friendly.tileX, y: friendly.tileY };
        const distance = this.gridSystem.getDistance(unitPos, dest);
        if (distance > engageDistance) continue;

        const path = this.findApproachPath(unit, dest);
        choices.push({
          candidate: this.buildMovementCandidate(
            dest,
            'settlerEscort',
            distance,
            path,
            nationId,
          ),
          path,
        });
      }
    }

    // Hold position is always a valid fallback so the unit picks something.
    choices.push({
      candidate: this.buildMovementCandidate(
        unitPos,
        'holdPosition',
        0,
        null,
        nationId,
      ),
      path: null,
    });

    // TODO: add 'frontline' and 'exploration' candidates once front detection
    // and unowned-territory targeting helpers exist.
    return choices;
  }

  private buildMovementCandidate(
    destination: GridCoord,
    kind: AIMovementCandidate['kind'],
    distance: number,
    path: Tile[] | null,
    nationId: string,
  ): AIMovementCandidate {
    const isReachable = kind === 'holdPosition' ? true : path !== null;
    const pathCost = path ? this.getPathCost(path) : 0;

    return {
      destination,
      kind,
      distance,
      pathCost,
      isReachable,
      isNearOwnCity: this.isNearOwnCity(destination, nationId),
      isNearEnemyCity: this.isNearEnemyCity(destination, nationId),
      isNearEnemyUnit: this.isNearEnemyUnit(destination, nationId),
    };
  }

  private findApproachPath(unit: Unit, target: GridCoord): Tile[] | null {
    const targets = [target, ...this.gridSystem.getAdjacentCoords(target)];
    return this.pathfindingSystem.findBestPathToAnyTarget(unit, targets, {
      respectMovementPoints: false,
    });
  }

  private getPathCost(path: Tile[]): number {
    let cost = 0;
    for (let i = 1; i < path.length; i++) {
      cost += getTileMovementCost(path[i]);
    }
    return cost;
  }

  private isNearEnemyCity(position: GridCoord, nationId: string): boolean {
    for (const city of this.cityManager.getAllCities()) {
      if (city.ownerId === nationId) continue;
      const dist = this.gridSystem.getDistance(
        { x: city.tileX, y: city.tileY },
        position,
      );
      if (dist <= NEAR_OWN_CITY_DISTANCE) return true;
    }
    return false;
  }

  private isNearEnemyUnit(position: GridCoord, nationId: string): boolean {
    for (const enemy of this.unitManager.getAllUnits()) {
      if (enemy.ownerId === nationId) continue;
      const dist = this.gridSystem.getDistance(
        { x: enemy.tileX, y: enemy.tileY },
        position,
      );
      if (dist <= NEAR_OWN_CITY_DISTANCE) return true;
    }
    return false;
  }

  private getStrategy(nationId: string): AIStrategy {
    const nation = this.nationManager.getNation(nationId);
    return getAIStrategyById(nation?.aiStrategyId);
  }

  private canTakeAggressiveAction(unit: Unit, strategy: AIStrategy): boolean {
    const healthRatio = unit.health / unit.unitType.baseHealth;
    if (healthRatio < strategy.military.minAttackHealthRatio) return false;
    if (this.hasFriendlySupport(unit, FRIENDLY_SUPPORT_DISTANCE)) return true;
    return healthRatio >= Math.min(1, strategy.military.minAttackHealthRatio + 0.15);
  }

  private hasFriendlySupport(unit: Unit, distance: number): boolean {
    return this.unitManager.getUnitsByOwner(unit.ownerId)
      .some((other) => {
        if (other.id === unit.id) return false;
        if (other.unitType.baseStrength <= 0) return false;
        if (other.unitType.isNaval) return false;
        const dist = this.gridSystem.getDistance(
          { x: other.tileX, y: other.tileY },
          { x: unit.tileX, y: unit.tileY },
        );
        return dist <= distance;
      });
  }

  // ─── Production ──────────────────────────────────────────────────────────────

  private runProduction(nationId: string): void {
    const cities = this.cityManager.getCitiesByOwner(nationId);
    const strategy = this.getStrategy(nationId);
    let plannedMilitaryCount = this.countMilitary(nationId);
    let plannedSettlerCount = this.countSettlers(nationId);

    for (const city of cities) {
      if (this.productionSystem.getProduction(city.id)) continue;

      const choice = this.chooseCityProduction(
        city,
        nationId,
        plannedMilitaryCount,
        plannedSettlerCount,
        strategy,
      );
      if (!choice) continue;

      this.productionSystem.setProduction(city.id, choice);
      if (choice.kind === 'unit') {
        if (choice.unitType.baseStrength > 0) plannedMilitaryCount++;
        if (choice.unitType.canFound === true) plannedSettlerCount++;
      }
    }
  }

  private countMilitary(nationId: string): number {
    return this.unitManager.getUnitsByOwner(nationId)
      .filter((u) => u.unitType.baseStrength > 0)
      .length;
  }

  private countSettlers(nationId: string): number {
    const existing = this.unitManager.getUnitsByOwner(nationId)
      .filter((u) => u.unitType.canFound === true)
      .length;
    let queued = 0;
    for (const city of this.cityManager.getCitiesByOwner(nationId)) {
      const current = this.productionSystem.getProduction(city.id);
      if (
        current?.item.kind === 'unit' &&
        current.item.unitType.canFound === true
      ) {
        queued++;
      }
    }
    return existing + queued;
  }

  private chooseCityProduction(
    city: City,
    nationId: string,
    plannedMilitaryCount: number,
    plannedSettlerCount: number,
    strategy: AIStrategy,
  ): Producible | undefined {
    const buildings = this.cityManager.getBuildings(city.id);
    const economy = calculateCityEconomy(
      city,
      this.mapData,
      buildings,
      this.gridSystem,
      EMPTY_MODIFIERS,
    );
    const canBuildMilitary = plannedMilitaryCount < strategy.military.maxUnits;
    const cityCount = this.cityManager.getCitiesByOwner(nationId).length;
    const wantsMoreCities = cityCount < strategy.expansion.desiredCityCount;
    const canProduceSettler =
      this.canBuildUnit(nationId, SETTLER.id) &&
      canCityProduceUnit(city, SETTLER, this.mapData, this.gridSystem);
    const goldPerTurn = this.nationManager.getResources(nationId).goldPerTurn;

    // Build candidates from preferred to fallback so ties resolve sensibly.
    const candidates: AIProductionCandidate[] = [];

    if (canBuildMilitary && this.needsDefender(city, nationId)) {
      candidates.push({
        item: { kind: 'unit', unitType: this.pickMilitaryUnitForCity(city, nationId) },
        baseScore: SCORE_ACUTE_DEFENDER,
        category: 'military',
      });
    }

    if (wantsMoreCities && plannedSettlerCount === 0 && canProduceSettler) {
      candidates.push({
        item: { kind: 'unit', unitType: SETTLER },
        baseScore: SCORE_SETTLER,
        category: 'settler',
      });
    }

    if (canBuildMilitary) {
      candidates.push({
        item: { kind: 'unit', unitType: this.pickMilitaryUnitForCity(city, nationId) },
        baseScore: SCORE_MILITARY,
        category: 'military',
      });
    }

    if (
      economy.netFood <= strategy.production.lowNetFoodThreshold &&
      !buildings.has(GRANARY.id) &&
      this.canBuildBuilding(nationId, GRANARY.id)
    ) {
      candidates.push({
        item: { kind: 'building', buildingType: GRANARY },
        baseScore: SCORE_FOOD_BUILDING,
        category: 'foodBuilding',
      });
    }

    if (
      economy.production <= strategy.production.lowProductionThreshold &&
      !buildings.has(WORKSHOP.id) &&
      this.canBuildBuilding(nationId, WORKSHOP.id)
    ) {
      candidates.push({
        item: { kind: 'building', buildingType: WORKSHOP },
        baseScore: SCORE_PRODUCTION_BUILDING,
        category: 'productionBuilding',
      });
    }

    if (
      goldPerTurn <= LOW_GOLD_PER_TURN &&
      !buildings.has(MARKET.id) &&
      this.canBuildBuilding(nationId, MARKET.id)
    ) {
      candidates.push({
        item: { kind: 'building', buildingType: MARKET },
        baseScore: SCORE_GOLD_BUILDING,
        category: 'goldBuilding',
      });
    }

    // Fallback so the city always has something to do when room is left.
    if (canBuildMilitary) {
      candidates.push({
        item: { kind: 'unit', unitType: this.pickMilitaryUnitForCity(city, nationId) },
        baseScore: SCORE_FALLBACK,
        category: 'military',
      });
    }

    return pickBestAIProductionCandidate(candidates, strategy)?.item;
  }

  private pickMilitaryUnitForCity(city: City, nationId: string): UnitType {
    const available = MILITARY_OPTIONS.filter((u) => (
      this.canBuildUnit(nationId, u.id) &&
      canCityProduceUnit(city, u, this.mapData, this.gridSystem)
    ));
    const archer = available.find((u) => u.id === ARCHER.id);
    if (archer && !this.hasFriendlyRangedUnitNearby(city, nationId)) return archer;
    return available.find((u) => u.id === WARRIOR.id) ?? WARRIOR;
  }

  private canBuildUnit(nationId: string, unitId: string): boolean {
    return this.researchSystem?.isUnitUnlocked(nationId, unitId) ?? true;
  }

  private canBuildBuilding(nationId: string, buildingId: string): boolean {
    return this.researchSystem?.isBuildingUnlocked(nationId, buildingId) ?? true;
  }

  private needsDefender(city: City, nationId: string): boolean {
    const tilesToCheck = [
      { x: city.tileX, y: city.tileY },
      ...this.gridSystem.getAdjacentCoords({ x: city.tileX, y: city.tileY }),
    ];

    for (const pos of tilesToCheck) {
      const unit = this.unitManager.getUnitAt(pos.x, pos.y);
      if (unit && unit.ownerId === nationId && unit.unitType.baseStrength > 0) return false;
    }

    return true;
  }

  private hasFriendlyRangedUnitNearby(city: City, nationId: string): boolean {
    const tilesToCheck = [
      { x: city.tileX, y: city.tileY },
      ...this.gridSystem.getAdjacentCoords({ x: city.tileX, y: city.tileY }),
    ];

    for (const pos of tilesToCheck) {
      const unit = this.unitManager.getUnitAt(pos.x, pos.y);
      if (
        unit &&
        unit.ownerId === nationId &&
        unit.unitType.baseStrength > 0 &&
        !unit.unitType.isNaval &&
        (unit.unitType.range ?? 1) > 1
      ) {
        return true;
      }
    }

    return false;
  }
}
