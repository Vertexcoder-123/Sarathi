class TreasureHunt extends Phaser.Scene {
    constructor() {
        super({ key: 'TreasureHunt' });
        this.player = null;
        this.clues = null;
        this.treasure = null;
        this.cursors = null;
        this.clueOrder = [0xff0000, 0x00ff00, 0xffff00]; // Red, Green, Yellow
        this.currentClueIndex = 0;
    }

    preload() {
        // No assets to load for this scene
    }

    create() {
        // --- Player Setup ---
        const playerGraphics = this.add.graphics();
        playerGraphics.fillStyle(0x0000ff, 1);
        playerGraphics.fillRect(0, 0, 50, 50);
        playerGraphics.generateTexture('player', 50, 50);
        playerGraphics.destroy();

        this.player = this.physics.add.sprite(400, 300, 'player');
        this.player.setCollideWorldBounds(true);

        // --- Clues Setup ---
        this.clues = this.physics.add.staticGroup();
        const clueGraphics = this.add.graphics();
        clueGraphics.fillStyle(0xff0000, 1);
        clueGraphics.fillRect(0, 0, 30, 30);
        clueGraphics.generateTexture('clue_red', 30, 30);
        clueGraphics.fillStyle(0x00ff00, 1);
        clueGraphics.fillRect(0, 0, 30, 30);
        clueGraphics.generateTexture('clue_green', 30, 30);
        clueGraphics.fillStyle(0xffff00, 1);
        clueGraphics.fillRect(0, 0, 30, 30);
        clueGraphics.generateTexture('clue_yellow', 30, 30);
        clueGraphics.destroy();

        const redClue = this.clues.create(100, 100, 'clue_red');
        redClue.setData('color', 0xff0000);
        const greenClue = this.clues.create(700, 500, 'clue_green');
        greenClue.setData('color', 0x00ff00);
        const yellowClue = this.clues.create(100, 500, 'clue_yellow');
        yellowClue.setData('color', 0xffff00);

        // --- Treasure Setup ---
        const treasureGraphics = this.add.graphics();
        treasureGraphics.fillStyle(0xffd700, 1);
        treasureGraphics.fillRect(0, 0, 60, 40);
        treasureGraphics.generateTexture('treasure', 60, 40);
        treasureGraphics.destroy();

        this.treasure = this.physics.add.sprite(0, 0, 'treasure');
        this.treasure.disableBody(true, true);

        // --- Input Setup ---
        this.cursors = this.input.keyboard.createCursorKeys();

        // --- Collision Detection ---
        this.physics.add.overlap(this.player, this.clues, this.collectClue, null, this);
        this.physics.add.overlap(this.player, this.treasure, this.findTreasure, null, this);
    }

    update() {
        this.player.setVelocity(0);
        if (this.cursors.left.isDown) {
            this.player.setVelocityX(-300);
        } else if (this.cursors.right.isDown) {
            this.player.setVelocityX(300);
        }
        if (this.cursors.up.isDown) {
            this.player.setVelocityY(-300);
        } else if (this.cursors.down.isDown) {
            this.player.setVelocityY(300);
        }
    }

    collectClue(player, clue) {
        const clueColor = clue.getData('color');
        if (clueColor === this.clueOrder[this.currentClueIndex]) {
            clue.disableBody(true, true);
            this.currentClueIndex++;
            if (this.currentClueIndex >= this.clueOrder.length) {
                const x = Phaser.Math.Between(50, 750);
                const y = Phaser.Math.Between(50, 550);
                this.treasure.enableBody(true, x, y, true, true);
            }
        }
    }

    findTreasure(player, treasure) {
        console.log('You Win!');
        this.events.emit('treasureFound');
        treasure.disableBody(true, true);
        player.setVelocity(0);
        this.add.text(300, 250, 'YOU WIN!', { fontSize: '48px', color: '#ffd700' });
        
        // Go back to the main menu after a delay
        this.time.delayedCall(2000, () => {
            this.scene.start('MainMenu');
        });
    }
}
