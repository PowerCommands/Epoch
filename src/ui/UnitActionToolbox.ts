import type { Unit } from '../entities/Unit';
import { hasCargoCapacity } from '../data/units';
import type { BuilderSystem, BuildImprovementPreview } from '../systems/BuilderSystem';
import type { UnitUpgradePreview, UnitUpgradeSystem } from '../systems/UnitUpgradeSystem';

export type UnitActionMode = 'move' | 'found' | 'attack' | 'ranged' | 'build' | 'upgrade' | 'sleep' | 'dismiss' | 'explore' | 'destroyImprovement' | 'destroyBuilding' | 'repair' | 'intel' | 'debark';

/** Recon unit types eligible for Auto Explore (Scout, Scout Boat, and future recon). */
function isReconUnit(unit: Unit): boolean {
  return unit.unitType.category === 'recon' || unit.unitType.category === 'naval_recon';
}

export interface UnitActionDefinition {
  mode: UnitActionMode;
  label: string;
  isAvailable(unit: Unit): boolean;
  isToggledOn?(unit: Unit): boolean;
}

export interface UnitActionViewState {
  mode: UnitActionMode;
  label: string;
  isAvailable: boolean;
  isActive: boolean;
  tooltip?: string;
}

export const ACTIONS: readonly UnitActionDefinition[] = [
  {
    mode: 'move',
    label: 'Move',
    isAvailable: () => true,
  },
  {
    mode: 'explore',
    label: 'Auto Explore',
    // Scout / Scout Boat only. Available even at 0 movement: automation starts
    // and the unit explores on its next turn.
    isAvailable: (unit) => isReconUnit(unit),
    isToggledOn: (unit) => unit.automation === 'explore',
  },
  {
    mode: 'found',
    label: 'Found',
    isAvailable: (unit) => unit.unitType.canFound === true,
  },
  {
    mode: 'attack',
    label: 'Attack',
    isAvailable: (unit) => unit.unitType.baseStrength > 0,
  },
  {
    mode: 'ranged',
    label: 'Ranged',
    isAvailable: (unit) => (unit.unitType.rangedStrength ?? 0) > 0 && (unit.unitType.range ?? 1) >= 2,
  },
  {
    mode: 'build',
    label: 'Improve',
    isAvailable: (unit) => unit.unitType.canBuildImprovements === true,
    isToggledOn: (unit) => unit.isBuildingImprovement(),
  },
  {
    mode: 'intel',
    label: 'Intel',
    // Capability gate only (Spy / Agent); the "is on a foreign city center" check
    // is applied via the intel availability provider, so the button is hidden
    // unless the unit is infiltrating a foreign city.
    isAvailable: (unit) => unit.unitType.canGatherIntel === true,
  },
  {
    mode: 'debark',
    label: 'Debark',
    isAvailable: (unit) => unit.unitType.isNaval === true && hasCargoCapacity(unit.unitType),
  },
  {
    mode: 'repair',
    label: 'Repair',
    // Capability gate only (Worker / Work Boat); the "is there a broken own
    // target here" check is applied via the repair availability provider, so the
    // button is hidden unless the unit stands on a repairable structure.
    isAvailable: (unit) => unit.unitType.canBuildImprovements === true,
  },
  {
    mode: 'upgrade',
    label: 'Upgrade',
    isAvailable: (unit) => unit.unitType.upgradeToUnitId !== undefined,
  },
  {
    mode: 'destroyImprovement',
    label: 'Raze Improvement',
    // Capability gate only; the actual "is there an enemy improvement here"
    // check is applied via the sabotage availability provider, so the button is
    // hidden unless the unit is standing on a valid target.
    isAvailable: (unit) => unit.unitType.canDestroyImprovement === true,
  },
  {
    mode: 'destroyBuilding',
    label: 'Raze Building',
    isAvailable: (unit) => unit.unitType.canDestroyBuilding === true,
  },
  {
    mode: 'sleep',
    label: 'Sleep',
    isAvailable: () => true,
    isToggledOn: (unit) => unit.isSleeping,
  },
  {
    mode: 'dismiss',
    label: 'Dismiss',
    isAvailable: () => true,
  },
];

type ModeChangedListener = (mode: UnitActionMode) => void;
type ChangedListener = () => void;
type BuildAvailabilityProvider = Pick<BuilderSystem, 'getCurrentTileBuildPreview'>;
type DismissAvailabilityProvider = {
  getCargoForTransport(unit: Unit): Unit | undefined;
};
type UpgradeAvailabilityProvider = Pick<UnitUpgradeSystem, 'getUpgradePreview'>;
type SabotageAvailabilityProvider = {
  canDestroyImprovement(unit: Unit): boolean;
  canDestroyBuilding(unit: Unit): boolean;
};
type RepairAvailabilityProvider = {
  canRepair(unit: Unit): boolean;
};
type IntelAvailabilityProvider = {
  canGatherIntel(unit: Unit): boolean;
};
export interface DebarkPreview {
  canDebark: boolean;
  reason?: string;
}
type DebarkAvailabilityProvider = {
  getDebarkPreview(unit: Unit): DebarkPreview;
};

export const HUD_ACTION_ORDER: readonly UnitActionMode[] = ['move', 'explore', 'attack', 'ranged', 'upgrade', 'sleep', 'build', 'repair', 'intel', 'debark', 'found', 'destroyImprovement', 'destroyBuilding', 'dismiss'];

// LEGACY: this class still owns shared action state/mode rules, but its HTML
// rendering path is no longer mounted in active gameplay. Phaser HUD is the
// authoritative interaction layer.
export class UnitActionToolbox {
  private selectedUnit: Unit | null = null;
  private mode: UnitActionMode = 'move';
  private root: HTMLElement | null = null;
  private buildAvailabilityProvider: BuildAvailabilityProvider | null = null;
  private dismissAvailabilityProvider: DismissAvailabilityProvider | null = null;
  private upgradeAvailabilityProvider: UpgradeAvailabilityProvider | null = null;
  private sabotageAvailabilityProvider: SabotageAvailabilityProvider | null = null;
  private repairAvailabilityProvider: RepairAvailabilityProvider | null = null;
  private intelAvailabilityProvider: IntelAvailabilityProvider | null = null;
  private debarkAvailabilityProvider: DebarkAvailabilityProvider | null = null;
  private readonly modeChangedListeners: ModeChangedListener[] = [];
  private readonly changedListeners: ChangedListener[] = [];

  constructor(private readonly humanNationId: string | undefined) {}

  setBuildAvailabilityProvider(provider: BuildAvailabilityProvider): void {
    this.buildAvailabilityProvider = provider;
    this.refresh();
  }

  setDismissAvailabilityProvider(provider: DismissAvailabilityProvider): void {
    this.dismissAvailabilityProvider = provider;
    this.refresh();
  }

  setUpgradeAvailabilityProvider(provider: UpgradeAvailabilityProvider): void {
    this.upgradeAvailabilityProvider = provider;
    this.refresh();
  }

  setSabotageAvailabilityProvider(provider: SabotageAvailabilityProvider): void {
    this.sabotageAvailabilityProvider = provider;
    this.refresh();
  }

  setRepairAvailabilityProvider(provider: RepairAvailabilityProvider): void {
    this.repairAvailabilityProvider = provider;
    this.refresh();
  }

  setIntelAvailabilityProvider(provider: IntelAvailabilityProvider): void {
    this.intelAvailabilityProvider = provider;
    this.refresh();
  }

  setDebarkAvailabilityProvider(provider: DebarkAvailabilityProvider): void {
    this.debarkAvailabilityProvider = provider;
    this.refresh();
  }

  getMode(): UnitActionMode {
    return this.mode;
  }

  setMode(mode: UnitActionMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.notifyModeChanged();
    this.refresh();
  }

  /** Trigger an action mode even if already set; used for single-shot actions. */
  triggerMode(mode: UnitActionMode): void {
    this.mode = mode;
    this.notifyModeChanged();
    this.refresh();
  }

  resetMode(): void {
    if (this.mode === 'move') {
      this.refresh();
      return;
    }
    this.mode = 'move';
    this.notifyModeChanged();
    this.refresh();
  }

  setSelectedUnit(unit: Unit | null): void {
    const nextUnit = unit?.ownerId === this.humanNationId ? unit : null;
    const selectedChanged = this.selectedUnit?.id !== nextUnit?.id;
    this.selectedUnit = nextUnit;
    if (selectedChanged && this.mode !== 'move') {
      this.mode = 'move';
      this.notifyModeChanged();
    }
    this.refresh();
  }

  /** Activate an action as if the user clicked its toolbox button. */
  tryActivate(mode: UnitActionMode): void {
    const unit = this.selectedUnit;
    if (!unit) return;
    const action = ACTIONS.find((a) => a.mode === mode);
    if (!action || !this.isActionAvailable(action, unit)) return;
    // Any explicit non-explore action cancels auto-exploration immediately;
    // selecting the unit alone (no action) does not reach here.
    if (mode !== 'explore') unit.automation = undefined;
    if (
      mode === 'sleep' || mode === 'dismiss' || mode === 'upgrade' || mode === 'explore'
      || mode === 'destroyImprovement' || mode === 'destroyBuilding' || mode === 'repair'
      || mode === 'intel' || mode === 'debark'
    ) {
      this.triggerMode(mode);
      return;
    }
    this.setMode(this.mode === mode ? 'move' : mode);
  }

  onModeChanged(listener: ModeChangedListener): void {
    this.modeChangedListeners.push(listener);
  }

  onChanged(listener: ChangedListener): void {
    this.changedListeners.push(listener);
  }

  /**
   * Returns the actions the HUD should render for the currently selected human
   * unit (empty when no unit is selected). Unavailable actions are hidden, with
   * one deliberate exception: the build/improve action stays visible but
   * disabled for units that *can* build improvements yet not on the current tile
   * (e.g. forest needing a tech). That way the player sees the button greyed out
   * with a tooltip explaining why, instead of it silently disappearing.
   */
  getHudActions(): UnitActionViewState[] {
    const unit = this.selectedUnit;
    if (!unit) return [];

    // Insurgent forces (Rebels, Partisans) are semi-autonomous: the player may
    // only relocate (Move) or Dismiss them. Combat and everything else is
    // AI-driven, so all other actions are hidden.
    const insurgent = unit.unitType.isInsurgentForce === true;

    const states: UnitActionViewState[] = [];
    for (const mode of HUD_ACTION_ORDER) {
      if (insurgent && mode !== 'move' && mode !== 'dismiss') continue;
      const action = ACTIONS.find((candidate) => candidate.mode === mode);
      if (!action) continue;

      const preview = action.mode === 'build' ? this.getBuildPreview(unit) : undefined;
      const upgradePreview = action.mode === 'upgrade' ? this.getUpgradePreview(unit) : undefined;
      const debarkPreview = action.mode === 'debark' ? this.getDebarkPreview(unit) : undefined;
      const isAvailable = this.isActionAvailable(action, unit, preview, upgradePreview, debarkPreview);

      // Keep the build action on screen (greyed out) for capable builders so the
      // tooltip can explain why it can't build here; hide every other unavailable action.
      const keepDisabled = (action.mode === 'build' || action.mode === 'debark') && action.isAvailable(unit);
      if (!isAvailable && !keepDisabled) continue;

      const isActive = this.mode === action.mode || action.isToggledOn?.(unit) === true;
      states.push({
        mode,
        label: this.getActionLabel(action, upgradePreview),
        isAvailable,
        isActive,
        tooltip: this.getActionTooltip(action, preview, upgradePreview, debarkPreview),
      });
    }
    return states;
  }

  hasSelectedUnit(): boolean {
    return this.selectedUnit !== null;
  }

  render(): HTMLElement {
    this.root = document.createElement('div');
    this.root.className = 'unit-action-toolbox';
    this.refresh();
    return this.root;
  }

  refresh(): void {
    if (!this.root) {
      this.notifyChanged();
      return;
    }

    this.root.replaceChildren();
    const unit = this.selectedUnit;
    if (!unit) {
      this.root.classList.add('unit-action-toolbox-hidden');
      this.notifyChanged();
      return;
    }

    this.root.classList.remove('unit-action-toolbox-hidden');

    const row = document.createElement('div');
    row.className = 'unit-action-row';

    for (const action of ACTIONS) {
      const preview = action.mode === 'build' ? this.getBuildPreview(unit) : undefined;
      const upgradePreview = action.mode === 'upgrade' ? this.getUpgradePreview(unit) : undefined;
      const debarkPreview = action.mode === 'debark' ? this.getDebarkPreview(unit) : undefined;
      const isAvailable = this.isActionAvailable(action, unit, preview, upgradePreview, debarkPreview);
      if (!isAvailable && action.mode !== 'build' && action.mode !== 'debark') continue;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'unit-action-button';
      const selectedAsMode = this.mode === action.mode;
      const toggledOn = isAvailable && action.isToggledOn?.(unit) === true;
      button.classList.toggle('unit-action-button-active', selectedAsMode || toggledOn);
      if (action.mode === 'dismiss') button.classList.add('unit-action-button-danger');
      button.textContent = this.getActionLabel(action, upgradePreview);
      const tooltip = this.getActionTooltip(action, preview, upgradePreview, debarkPreview);
      if (tooltip !== undefined) button.title = tooltip;
      button.disabled = !isAvailable;
      button.style.opacity = isAvailable ? '1' : '0.4';
      button.addEventListener('click', () => {
        if (!this.isActionAvailable(action, unit)) return;
        if (action.mode === 'sleep' || action.mode === 'dismiss' || action.mode === 'upgrade') {
          this.triggerMode(action.mode);
          return;
        }
        this.setMode(this.mode === action.mode ? 'move' : action.mode);
      });
      row.append(button);
    }

    this.root.append(row);
    this.notifyChanged();
  }

  private notifyModeChanged(): void {
    for (const listener of this.modeChangedListeners) listener(this.mode);
  }

  private isActionAvailable(
    action: UnitActionDefinition,
    unit: Unit,
    buildPreview = action.mode === 'build' ? this.getBuildPreview(unit) : undefined,
    upgradePreview = action.mode === 'upgrade' ? this.getUpgradePreview(unit) : undefined,
    debarkPreview = action.mode === 'debark' ? this.getDebarkPreview(unit) : undefined,
  ): boolean {
    if (!action.isAvailable(unit)) return false;
    if (action.mode === 'dismiss' && this.dismissAvailabilityProvider?.getCargoForTransport(unit) !== undefined) {
      return false;
    }
    if (action.mode === 'upgrade') return upgradePreview?.canUpgrade === true;
    // Destroy actions stay hidden unless the unit stands on a valid enemy target.
    if (action.mode === 'destroyImprovement') {
      return this.sabotageAvailabilityProvider?.canDestroyImprovement(unit) === true;
    }
    if (action.mode === 'destroyBuilding') {
      return this.sabotageAvailabilityProvider?.canDestroyBuilding(unit) === true;
    }
    // Repair stays hidden unless the unit stands on a broken own structure.
    if (action.mode === 'repair') {
      return this.repairAvailabilityProvider?.canRepair(unit) === true;
    }
    // Intel stays hidden unless a Spy/Agent stands on a foreign city center.
    if (action.mode === 'intel') {
      return this.intelAvailabilityProvider?.canGatherIntel(unit) === true;
    }
    if (action.mode === 'debark') {
      return debarkPreview?.canDebark === true;
    }
    if (action.mode !== 'build') return true;
    return buildPreview?.canBuild === true;
  }

  private getBuildPreview(unit: Unit): BuildImprovementPreview {
    return this.buildAvailabilityProvider?.getCurrentTileBuildPreview(unit)
      ?? { canBuild: false, reason: 'No build rules available' };
  }

  private getUpgradePreview(unit: Unit): UnitUpgradePreview {
    return this.upgradeAvailabilityProvider?.getUpgradePreview(unit, unit.ownerId)
      ?? { canUpgrade: false, reason: 'No upgrade rules available' };
  }

  private getDebarkPreview(unit: Unit): DebarkPreview {
    return this.debarkAvailabilityProvider?.getDebarkPreview(unit)
      ?? { canDebark: false, reason: 'No debark rules available' };
  }

  private getActionLabel(
    action: UnitActionDefinition,
    upgradePreview: UnitUpgradePreview | undefined,
  ): string {
    if (action.mode !== 'upgrade') return action.label;
    if (upgradePreview?.target && upgradePreview.cost !== undefined) {
      return `Upgrade to ${upgradePreview.target.name} (${upgradePreview.cost} gold)`;
    }
    return 'Upgrade';
  }

  private getActionTooltip(
    action: UnitActionDefinition,
    buildPreview: BuildImprovementPreview | undefined,
    upgradePreview: UnitUpgradePreview | undefined,
    debarkPreview: DebarkPreview | undefined,
  ): string | undefined {
    if (action.mode === 'dismiss') {
      const unit = this.selectedUnit;
      if (unit !== null && this.dismissAvailabilityProvider?.getCargoForTransport(unit) !== undefined) {
        return 'Cannot dismiss a transport carrying a unit.';
      }
      return 'Permanently remove this unit.';
    }
    if (action.mode === 'upgrade') {
      if (upgradePreview?.target && upgradePreview.cost !== undefined) {
        return `Upgrade to ${upgradePreview.target.name} for ${upgradePreview.cost} gold.`;
      }
      return upgradePreview?.reason ?? 'Cannot upgrade this unit.';
    }
    if (action.mode === 'explore') {
      return this.selectedUnit?.automation === 'explore'
        ? 'Auto exploring — choose another action to stop.'
        : 'Automatically explore the map (continues each turn).';
    }
    if (action.mode === 'debark') {
      return debarkPreview?.canDebark
        ? 'Unload cargo to an adjacent valid tile.'
        : debarkPreview?.reason ?? 'Cannot debark cargo here.';
    }
    if (action.mode !== 'build') return undefined;
    if (buildPreview?.canBuild) return 'Build improvement';
    return buildPreview?.reason ?? 'Cannot build improvement';
  }

  private notifyChanged(): void {
    for (const listener of this.changedListeners) listener();
  }
}
