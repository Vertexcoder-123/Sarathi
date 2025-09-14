// Basic Phaser game configuration
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [MainMenu, TreasureHunt, InteractiveQuiz, MatchingPairs, SimulationGame] // Add all scenes to the game
};

// Game instance
const game = new Phaser.Game(config);
