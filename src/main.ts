import Phaser from 'phaser';
import { gameConfig } from './config/gameConfig';

// Starta Phaser-spelet med den centrala konfigurationen.
// Alla scener och inställningar definieras i gameConfig.
new Phaser.Game(gameConfig);
