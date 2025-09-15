// Basic Phaser game configuration
const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 800,
    height: 600,
    backgroundColor: '#2d2d2d',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [MainMenu, TreasureHunt, InteractiveQuiz, MatchingPairs, SimulationGame, WordPuzzle]
};

// Game instance
const game = new Phaser.Game(config);

// Global game state
game.globals = {
    // Helper function to create placeholder graphics
    createPlaceholder: function(scene, x, y, width, height, color, label) {
        const graphics = scene.add.graphics();
        graphics.fillStyle(color);
        graphics.fillRect(-width/2, -height/2, width, height);
        
        if (label) {
            const text = scene.add.text(0, 0, label, {
                fontSize: '16px',
                color: '#ffffff'
            }).setOrigin(0.5);
            
            const container = scene.add.container(x, y, [graphics, text]);
            return container;
        }
        
        return graphics;
    }
};
