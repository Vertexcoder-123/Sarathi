class SimulationGame extends Phaser.Scene {
    constructor() {
        super({ key: 'SimulationGame' });
    }

    create() {
        this.add.text(250, 50, 'Virtual Circuit', { fontSize: '32px', color: '#ffffff' });
    }
}
