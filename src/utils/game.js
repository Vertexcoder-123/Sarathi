/**
 * game.js
 * This module manages the Phaser game instance and provides functions
 * for creating and managing the game state.
 */

let gameInstance = null;

/**
 * Creates and returns a new Phaser game instance
 * @param {Object} config - Phaser game configuration
 * @returns {Phaser.Game} The created game instance
 */
export function createGame(config) {
    if (gameInstance) {
        gameInstance.destroy(true);
    }
    gameInstance = new Phaser.Game(config);
    return gameInstance;
}

/**
 * Gets the current game instance
 * @returns {Phaser.Game|null} The current game instance or null if none exists
 */
export function getGameInstance() {
    return gameInstance;
}
    type: Phaser.AUTO,
    parent: 'play-view-container',
    width: 800,
    height: 600,
    scene: SomeSceneClass
};

SARATHI_GAME_INSTANCE = new Phaser.Game(gameConfig);
*/
