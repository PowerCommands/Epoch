import type { Unit } from '../entities/Unit';
import type { BuilderSystem, BuildImprovementPreview } from '../systems/BuilderSystem';
import type { UnitUpgradePreview, UnitUpgradeSystem } from '../systems/UnitUpgradeSystem';

export type UnitActionMode = 'move' | 'found' | 'attack' | 'ranged' | 'build' | 'upgrade' | 'sleep' | 'dismiss';

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
    mode: 'upgrade',
    label: 'Upgrade',
    isAvailable: (unit) => unit.unitType.upgradeToUnitId !== undefined,
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

const HUD_ACTION_ORDER: readonly UnitActionMode[] = ['move', 'attack', 'ranged', 'upgrade', 'sleep', 'build', 'found', 'dismiss'];

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
    if (mode === 'sleep' || mode === 'dismiss' || mode === 'upgrade') {
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

  getHudActions(): UnitActionViewState[] {
    const unit = this.selectedUnit;
    return HUD_ACTION_ORDER.map((mode) => {
      const action = ACTIONS.find((candidate) => candidate.mode === mode);
      if (!action) {
        return { mode, label: mode, isAvailable: false, isActive: false };
      }

      const preview = unit !== null && action.mode === 'build'
        ? this.getBuildPreview(unit)
        : undefined;
      const upgradePreview = unit !== null && action.mode === 'upgrade'
        ? this.getUpgradePreview(unit)
        : undefined;
      const isAvailable = unit !== null && this.isActionAvailable(action, unit, preview, upgradePreview);
      const isActive = unit !== null && isAvailable && (
        this.mode === action.mode || action.isToggledOn?.(unit) === true
      );

      return {
        mode,
        label: this.getActionLabel(action, upgradePreview),
        isAvailable,
        isActive,
        tooltip: this.getActionTooltip(action, preview, upgradePreview),
      };
    });
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
      const isAvailable = this.isActionAvailable(action, unit, preview, upgradePreview);
      if (!isAvailable && action.mode !== 'build') continue;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'unit-action-button';
      const selectedAsMode = this.mode === action.mode;
      const toggledOn = isAvailable && action.isToggledOn?.(unit) === true;
      button.classList.toggle('unit-action-button-active', selectedAsMode || toggledOn);
      if (action.mode === 'dismiss') button.classList.add('unit-action-button-danger');
      button.textContent = this.getActionLabel(action, upgradePreview);
      const tooltip = this.getActionTooltip(action, preview, upgradePreview);
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
  ): boolean {
    if (!action.isAvailable(unit)) return false;
    if (action.mode === 'dismiss' && this.dismissAvailabilityProvider?.getCargoForTransport(unit) !== undefined) {
      return false;
    }
    if (action.mode === 'upgrade') return upgradePreview?.canUpgrade === true;
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
    if (action.mode !== 'build') return undefined;
    if (buildPreview?.canBuild) return 'Build improvement';
    return buildPreview?.reason ?? 'Cannot build improvement';
  }

  private notifyChanged(): void {
    for (const listener of this.changedListeners) listener();
  }
}
