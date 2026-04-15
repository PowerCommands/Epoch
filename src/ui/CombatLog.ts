import Phaser from 'phaser';
import {
  CombatSystem,
  type CombatEvent,
  type CityCombatEvent,
  type CombatRejectedEvent,
} from '../systems/CombatSystem';
import { NationManager } from '../systems/NationManager';

const MAX_ENTRIES = 3;
const FADE_DELAY = 10_000;
const FADE_DURATION = 600;
const LOG_WIDTH = 500;
const LINE_HEIGHT = 20;
const PADDING = 8;
const BG_COLOR = 0x000000;
const BG_ALPHA = 0.5;

interface LogEntry {
  text: string;
  label: Phaser.GameObjects.Text;
  timer: Phaser.Time.TimerEvent;
}

/**
 * CombatLog — visar de senaste 3 stridshändelserna nära botten av skärmen.
 * Rader fadar ut efter ~10 sekunder.
 */
export class CombatLog {
  private readonly scene: Phaser.Scene;
  private readonly nationManager: NationManager;
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly entries: LogEntry[] = [];
  private readonly baseX: number;
  private readonly baseY: number;

  constructor(
    scene: Phaser.Scene,
    combatSystem: CombatSystem,
    nationManager: NationManager,
  ) {
    this.scene = scene;
    this.nationManager = nationManager;

    const { width, height } = scene.scale;
    this.baseX = (width - LOG_WIDTH) / 2;
    this.baseY = height - 100;

    this.bg = scene.add
      .rectangle(this.baseX, this.baseY, LOG_WIDTH, 0, BG_COLOR, BG_ALPHA)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(105)
      .setVisible(false);

    combatSystem.on((e) => this.addEntry(e));
    combatSystem.onCityCombat((e) => this.addCityCombatEntry(e));
    combatSystem.onRejected((e) => this.addRejectedEntry(e));
  }

  private addEntry(e: CombatEvent): void {
    const attackerNation = this.nationManager.getNation(e.attacker.ownerId);
    const defenderNation = this.nationManager.getNation(e.defender.ownerId);

    const aName = `${attackerNation?.name.split(' ')[0] ?? ''} ${e.attacker.name}`;
    const dName = `${defenderNation?.name.split(' ')[0] ?? ''} ${e.defender.name}`;

    let text = `${aName} -> ${dName}: -${e.result.defenderDamageTaken} HP (took -${e.result.attackerDamageTaken})`;
    if (e.result.defenderDied) text += ' (killed)';
    if (e.result.attackerDied) text += ' (attacker killed)';

    this.addTextEntry(text);
  }

  private addCityCombatEntry(e: CityCombatEvent): void {
    const attackerNation = this.nationManager.getNation(e.attacker.ownerId);
    const aName = `${attackerNation?.name.split(' ')[0] ?? ''} ${e.attacker.name}`;

    if (e.captured) {
      // Erövring — fetare meddelande
      const capturerNation = this.nationManager.getNation(e.attacker.ownerId);
      this.addTextEntry(
        `${e.city.name} captured by ${capturerNation?.name ?? 'Unknown'}!`,
        '#ffd700',
      );
    } else {
      let text = `${aName} -> ${e.city.name}: -${e.result.cityDamageTaken} HP (took -${e.result.attackerDamageTaken})`;
      if (e.result.attackerDied) text += ' (killed)';
      this.addTextEntry(text);
    }
  }

  private addRejectedEntry(e: CombatRejectedEvent): void {
    const attackerNation = this.nationManager.getNation(e.attacker.ownerId);
    const defenderNation = this.nationManager.getNation(e.target.ownerId);

    const aName = `${attackerNation?.name.split(' ')[0] ?? ''} ${e.attacker.name}`;
    const dName = `${defenderNation?.name.split(' ')[0] ?? ''} ${e.target.name}`;
    this.addTextEntry(`${aName} -> ${dName}: ${e.reason}`, '#ffb0b0');
  }

  private addTextEntry(text: string, color = '#e0e0e0'): void {
    const label = this.scene.add
      .text(this.baseX + PADDING, 0, text, {
        fontSize: '13px',
        color,
      })
      .setScrollFactor(0)
      .setDepth(106);

    const timer = this.scene.time.delayedCall(FADE_DELAY, () => {
      this.scene.tweens.add({
        targets: label,
        alpha: 0,
        duration: FADE_DURATION,
        onComplete: () => this.removeEntry(label),
      });
    });

    this.entries.push({ text, label, timer });

    while (this.entries.length > MAX_ENTRIES) {
      const old = this.entries.shift()!;
      old.timer.destroy();
      old.label.destroy();
    }

    this.layoutEntries();
  }

  private removeEntry(label: Phaser.GameObjects.Text): void {
    const idx = this.entries.findIndex((e) => e.label === label);
    if (idx === -1) return;

    const entry = this.entries[idx];
    entry.label.destroy();
    this.entries.splice(idx, 1);

    this.layoutEntries();
  }

  private layoutEntries(): void {
    if (this.entries.length === 0) {
      this.bg.setVisible(false);
      return;
    }

    const totalHeight = this.entries.length * LINE_HEIGHT + PADDING * 2;
    const topY = this.baseY - totalHeight;

    this.bg.setPosition(this.baseX, topY);
    this.bg.setSize(LOG_WIDTH, totalHeight);
    this.bg.setVisible(true);

    for (let i = 0; i < this.entries.length; i++) {
      this.entries[i].label.setPosition(
        this.baseX + PADDING,
        topY + PADDING + i * LINE_HEIGHT,
      );
    }
  }
}
