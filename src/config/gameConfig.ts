import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { MainMenuScene } from '../scenes/MainMenuScene';
import { GameScene } from '../scenes/GameScene';

export function getGameContainerSize(): { width: number; height: number } {
  const container = document.getElementById('game-container');
  const rect = container?.getBoundingClientRect();

  return {
    width: Math.round(rect?.width ?? window.innerWidth),
    height: Math.round(rect?.height ?? window.innerHeight),
  };
}

const { width, height } = getGameContainerSize();

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width,
  height,
  backgroundColor: '#2d2d2d',
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.NONE,
  },
  scene: [BootScene, MainMenuScene, GameScene],
};
