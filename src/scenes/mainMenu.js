// MainMenuScene.js

export default class MainMenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainMenu' });
    }

    preload() {
        // Load any assets here
    }

    create() {
        this.add.text(100, 100, 'Main Menu', { fontSize: '64px', fill: '#fff' });

        const playButton = this.add.text(100, 250, 'Play Matching Pairs', { fontSize: '32px', fill: '#fff' })
            .setInteractive()
            .on('pointerdown', () => {
                this.scene.start('MatchingPairs');
            });

        const simulationButton = this.add.text(100, 350, 'Simulation Game', { fontSize: '32px', fill: '#fff' })
            .setInteractive()
            .on('pointerdown', () => {
                this.scene.start('SimulationGame');
            });
    }
}