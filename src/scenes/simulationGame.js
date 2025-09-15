class SimulationGame extends Phaser.Scene {
    constructor() {
        super({ key: 'SimulationGame' });
    }

    create() {
        this.add.text(250, 50, 'Virtual Circuit', { fontSize: '32px', color: '#ffffff' });

        // --- Example Win Condition ---
        // In a real simulation, this would be triggered by completing the task.
        // For this example, we'll trigger it with a button press.
        const completeButton = this.add.text(400, 300, 'Complete Simulation', {
            fontSize: '24px',
            fill: '#fff',
            backgroundColor: '#27ae60',
            padding: { x: 20, y: 10 }
        })
        .setOrigin(0.5)
        .setInteractive();

        completeButton.on('pointerdown', () => {
            this.endSimulation();
        });
    }

    endSimulation() {
        this.add.text(400, 400, 'Simulation Complete!', { fontSize: '32px', color: '#00ff00' }).setOrigin(0.5);

        // --- Dispatch the custom event ---
        const score = 95; // Example score
        const gameCompleteEvent = new CustomEvent('gameComplete', {
            detail: { score: score }
        });
        window.dispatchEvent(gameCompleteEvent);
    }
}

export default SimulationGame;
