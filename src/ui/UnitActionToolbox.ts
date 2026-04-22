import type { Unit } from '../entities/Unit';

export type UnitActionMode = 'move' | 'found' | 'attack' | 'ranged' | 'build' | 'sleep' | 'kill';

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
  },
  {
    mode: 'sleep',
    label: 'Sleep',
    isAvailable: () => true,
    isToggledOn: (unit) => unit.isSleeping,
  },
  {
    mode: 'kill',
    label: 'Kill',
    isAvailable: () => true,
  },
];

type ModeChangedListener = (mode: UnitActionMode) => void;
type ChangedListener = () => void;

const HUD_ACTION_ORDER: readonly UnitActionMode[] = ['move', 'attack', 'ranged', 'sleep', 'build', 'found'];

// LEGACY: this class still owns shared action state/mode rules, but its HTML
// rendering path is no longer mounted in active gameplay. Phaser HUD is the
// authoritative interaction layer.
export class UnitActionToolbox {
  private selectedUnit: Unit | null = null;
  private mode: UnitActionMode = 'move';
  private root: HTMLElement | null = null;
  private readonly modeChangedListeners: ModeChangedListener[] = [];
  private readonly changedListeners: ChangedListener[] = [];

  constructor(private readonly humanNationId: string | undefined) {}

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
    if (!action || !action.isAvailable(unit)) return;
    if (mode === 'sleep' || mode === 'kill') {
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

      const isAvailable = unit !== null && action.isAvailable(unit);
      const isActive = unit !== null && isAvailable && (
        this.mode === action.mode || action.isToggledOn?.(unit) === true
      );

      return {
        mode,
        label: action.label,
        isAvailable,
        isActive,
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
      if (!action.isAvailable(unit)) continue;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'unit-action-button';
      const selectedAsMode = this.mode === action.mode;
      const toggledOn = action.isToggledOn?.(unit) === true;
      button.classList.toggle('unit-action-button-active', selectedAsMode || toggledOn);
      if (action.mode === 'kill') button.classList.add('unit-action-button-danger');
      button.textContent = action.label;
      button.addEventListener('click', () => {
        if (action.mode === 'sleep' || action.mode === 'kill') {
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

  private notifyChanged(): void {
    for (const listener of this.changedListeners) listener();
  }
}
