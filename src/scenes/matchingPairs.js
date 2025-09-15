class MatchingPairs extends Phaser.Scene {
    constructor() {
        super({ key: 'MatchingPairs' });

        this.pairs = [
            ['India', 'New Delhi'],
            ['USA', 'Washington D.C.'],
            ['Japan', 'Tokyo'],
            ['France', 'Paris'],
            ['UK', 'London'],
            ['Canada', 'Ottawa']
        ];
        this.cards = [];
        this.flippedCards = [];
        this.matchesFound = 0;
    }

    create() {
        this.add.text(250, 30, 'Matching Pairs', { fontSize: '40px', color: '#ffffff' });

        // Create a shuffled list of card values
        let cardValues = [];
        this.pairs.forEach(pair => {
            cardValues.push(pair[0]);
            cardValues.push(pair[1]);
        });
        Phaser.Utils.Array.Shuffle(cardValues);

        const rows = 3;
        const cols = 4;
        const cardWidth = 150;
        const cardHeight = 100;
        const spacing = 20;
        const startX = (this.sys.game.config.width - (cols * (cardWidth + spacing))) / 2 + 80;
        const startY = 120;

        // Create the cards
        for (let i = 0; i < cardValues.length; i++) {
            const row = Math.floor(i / cols);
            const col = i % cols;
            const x = startX + col * (cardWidth + spacing);
            const y = startY + row * (cardHeight + spacing);

            const card = this.add.container(x, y);
            this.cards.push(card);

            const cardBack = this.add.graphics();
            cardBack.fillStyle(0x5555ff, 1);
            cardBack.fillRoundedRect(0, 0, cardWidth, cardHeight, 10);
            card.add(cardBack);

            const cardText = this.add.text(cardWidth / 2, cardHeight / 2, cardValues[i], {
                fontSize: '20px',
                color: '#ffffff',
                align: 'center',
                wordWrap: { width: cardWidth - 10 }
            }).setOrigin(0.5);
            cardText.setVisible(false);
            card.add(cardText);

            card.setData('value', cardValues[i]);
            card.setData('flipped', false);
            card.setSize(cardWidth, cardHeight);
            card.setInteractive();

            card.on('pointerdown', () => {
                this.flipCard(card);
            });
        }
    }

    flipCard(card) {
        if (card.getData('flipped') || this.flippedCards.length >= 2) {
            return; // Card is already flipped or two cards are already showing
        }

        card.setData('flipped', true);
        card.getAt(0).setVisible(false); // Hide back
        card.getAt(1).setVisible(true);  // Show text

        this.flippedCards.push(card);

        if (this.flippedCards.length === 2) {
            this.checkForMatch();
        }
    }

    checkForMatch() {
        const card1 = this.flippedCards[0];
        const card2 = this.flippedCards[1];

        const value1 = card1.getData('value');
        const value2 = card2.getData('value');

        let isMatch = false;
        this.pairs.forEach(pair => {
            if ((pair[0] === value1 && pair[1] === value2) || (pair[0] === value2 && pair[1] === value1)) {
                isMatch = true;
            }
        });

        if (isMatch) {
            // It's a match!
            this.matchesFound++;
            this.flippedCards = []; // Reset for the next pair

            if (this.matchesFound >= this.pairs.length) {
                this.endGame();
            }
        } else {
            // Not a match, flip them back after a delay
            this.time.delayedCall(1000, () => {
                card1.setData('flipped', false);
                card1.getAt(0).setVisible(true);
                card1.getAt(1).setVisible(false);

                card2.setData('flipped', false);
                card2.getAt(0).setVisible(true);
                card2.getAt(1).setVisible(false);

                this.flippedCards = [];
            });
        }
    }

    endGame() {
        this.add.text(400, 300, 'You found all pairs!', { fontSize: '32px', color: '#00ff00' }).setOrigin(0.5);

        // --- Dispatch the custom event ---
        const score = 100; // Example score for completing the game
        const gameCompleteEvent = new CustomEvent('gameComplete', {
            detail: { score: score }
        });
        window.dispatchEvent(gameCompleteEvent);

        this.time.delayedCall(1000, () => {
            this.scene.start('MainMenu'); // Or restart, or go to a results screen
        });
    }
}

export default MatchingPairs;
