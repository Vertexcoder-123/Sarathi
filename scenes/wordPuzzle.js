class WordPuzzle extends Phaser.Scene {
    constructor() {
        super({ key: 'WordPuzzle' });
        this.puzzles = [
            {
                type: 'scramble',
                word: 'PHOTOSYNTHESIS',
                hint: 'Process by which plants make their food',
                subject: 'Science'
            },
            {
                type: 'fillblank',
                sentence: 'The capital of India is _____.',
                answer: 'NEW DELHI',
                subject: 'Geography'
            },
            {
                type: 'scramble',
                word: 'INDEPENDENCE',
                hint: 'Freedom from colonial rule',
                subject: 'History'
            }
        ];
        this.currentPuzzle = 0;
        this.score = 0;
        this.letters = [];
        this.slots = [];
    }

    create() {
        // Header
        this.add.text(400, 30, 'Word Puzzle', { 
            fontSize: '32px', 
            color: '#ffffff' 
        }).setOrigin(0.5);

        // Score display
        this.scoreText = this.add.text(50, 50, 'Score: 0', { 
            fontSize: '24px', 
            color: '#ffffff' 
        });

        // Subject display
        this.subjectText = this.add.text(650, 50, '', { 
            fontSize: '24px', 
            color: '#ffffff' 
        });

        // Hint/Question text
        this.hintText = this.add.text(400, 100, '', { 
            fontSize: '24px', 
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: 700 }
        }).setOrigin(0.5, 0);

        // Create answer slots area
        this.slotsContainer = this.add.container(400, 250);

        // Create letters bank area for scramble
        this.lettersContainer = this.add.container(400, 400);

        // Navigation buttons
        this.add.text(50, 550, 'Main Menu', {
            fontSize: '24px',
            backgroundColor: '#0000ff',
            color: '#ffffff',
            padding: 10
        })
        .setInteractive()
        .on('pointerdown', () => this.scene.start('MainMenu'));

        this.add.text(650, 550, 'Next Puzzle', {
            fontSize: '24px',
            backgroundColor: '#00ff00',
            color: '#ffffff',
            padding: 10
        })
        .setInteractive()
        .on('pointerdown', () => this.nextPuzzle());

        // Start with first puzzle
        this.displayPuzzle();
    }

    displayPuzzle() {
        // Clear previous puzzle
        this.clearPuzzle();

        const puzzle = this.puzzles[this.currentPuzzle];
        this.subjectText.setText('Subject: ' + puzzle.subject);

        if (puzzle.type === 'scramble') {
            this.createScramblePuzzle(puzzle);
        } else {
            this.createFillBlankPuzzle(puzzle);
        }
    }

    createScramblePuzzle(puzzle) {
        this.hintText.setText(puzzle.hint);

        // Create answer slots
        const word = puzzle.word;
        const slotSpacing = 50;
        const startX = -(word.length * slotSpacing) / 2;

        for (let i = 0; i < word.length; i++) {
            const slot = this.add.rectangle(startX + i * slotSpacing, 0, 40, 40, 0x444444);
            const text = this.add.text(startX + i * slotSpacing, 0, '', {
                fontSize: '28px',
                color: '#ffffff'
            }).setOrigin(0.5);
            this.slotsContainer.add([slot, text]);
            this.slots.push({ slot, text, letter: word[i] });
        }

        // Create scrambled letters
        let letters = word.split('');
        Phaser.Utils.Array.Shuffle(letters);
        
        const letterSpacing = 50;
        const letterStartX = -(letters.length * letterSpacing) / 2;

        letters.forEach((letter, i) => {
            const bg = this.add.rectangle(letterStartX + i * letterSpacing, 0, 40, 40, 0x666666)
                .setInteractive();
            const text = this.add.text(letterStartX + i * letterSpacing, 0, letter, {
                fontSize: '28px',
                color: '#ffffff'
            }).setOrigin(0.5);
            
            this.lettersContainer.add([bg, text]);
            this.letters.push({ bg, text, letter, used: false });

            bg.on('pointerdown', () => this.onLetterClick(i));
        });
    }

    createFillBlankPuzzle(puzzle) {
        this.hintText.setText(puzzle.sentence);

        // Create input field
        const inputStyle = 'background: white; color: black; font-size: 24px; width: 200px; height: 40px; text-align: center';
        const input = this.add.dom(0, 0, 'input', inputStyle);
        this.slotsContainer.add(input);

        const checkButton = this.add.text(100, 0, 'Check Answer', {
            fontSize: '24px',
            backgroundColor: '#00ff00',
            color: '#ffffff',
            padding: 10
        })
        .setInteractive()
        .on('pointerdown', () => {
            const answer = input.node.value.trim().toUpperCase();
            if (answer === puzzle.answer) {
                this.score += 10;
                this.scoreText.setText('Score: ' + this.score);
                this.nextPuzzle();
            } else {
                input.node.value = '';
                this.add.text(400, 350, 'Try Again!', {
                    fontSize: '24px',
                    color: '#ff0000'
                }).setOrigin(0.5);
            }
        });

        this.slotsContainer.add(checkButton);
    }

    onLetterClick(index) {
        const letter = this.letters[index];
        if (letter.used) return;

        // Find next empty slot
        const emptySlotIndex = this.slots.findIndex(slot => !slot.text.text);
        if (emptySlotIndex !== -1) {
            this.slots[emptySlotIndex].text.setText(letter.letter);
            letter.used = true;
            letter.bg.setFillStyle(0x333333);

            // Check if word is complete
            if (this.slots.every(slot => slot.text.text)) {
                const enteredWord = this.slots.map(slot => slot.text.text).join('');
                if (enteredWord === this.puzzles[this.currentPuzzle].word) {
                    this.score += 10;
                    this.scoreText.setText('Score: ' + this.score);
                    this.time.delayedCall(1000, () => this.nextPuzzle());
                } else {
                    // Wrong answer - reset slots
                    this.time.delayedCall(500, () => {
                        this.slots.forEach(slot => slot.text.setText(''));
                        this.letters.forEach(letter => {
                            letter.used = false;
                            letter.bg.setFillStyle(0x666666);
                        });
                    });
                }
            }
        }
    }

    clearPuzzle() {
        this.slotsContainer.removeAll(true);
        this.lettersContainer.removeAll(true);
        this.slots = [];
        this.letters = [];
    }

    nextPuzzle() {
        this.currentPuzzle = (this.currentPuzzle + 1) % this.puzzles.length;
        this.displayPuzzle();
    }
}