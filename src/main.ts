import Phaser from 'phaser';
import { gameConfig, getGameContainerSize } from './config/gameConfig';

// Starta Phaser-spelet med den centrala konfigurationen.
// Alla scener och inställningar definieras i gameConfig.
const game = new Phaser.Game(gameConfig);

window.addEventListener('resize', () => {
  const { width, height } = getGameContainerSize();
  game.scale.resize(width, height);
});
