import Phaser from 'phaser';
import { gameConfig, getGameContainerSize } from './config/gameConfig';
import { installDomInputIsolation } from './utils/domInputIsolation';

// Starta Phaser-spelet med den centrala konfigurationen.
// Alla scener och inställningar definieras i gameConfig.
const game = new Phaser.Game(gameConfig);
const removeDomInputIsolation = installDomInputIsolation(() => game.canvas);
game.events.once(Phaser.Core.Events.DESTROY, removeDomInputIsolation);

window.addEventListener('resize', () => {
  const { width, height } = getGameContainerSize();
  game.scale.resize(width, height);
});
