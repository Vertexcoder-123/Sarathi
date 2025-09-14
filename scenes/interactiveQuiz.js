class InteractiveQuiz extends Phaser.Scene {
    constructor() {
        super({ key: 'InteractiveQuiz' });

        this.questions = [
            {
                question: 'What is the capital of India?',
                options: ['Mumbai', 'New Delhi', 'Kolkata', 'Chennai'],
                answer: 1
            },
            {
                question: 'Which of these is a source of Vitamin C?',
                options: ['Bread', 'Rice', 'Orange', 'Milk'],
                answer: 2
            },
            {
                question: 'In which year did India gain independence?',
                options: ['1942', '1945', '1947', '1950'],
                answer: 2
            }
        ];
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.timer = null;
        this.timeLeft = 30; // 30 seconds for the whole quiz
    }

    create() {
        this.scoreText = this.add.text(50, 50, 'Score: 0', { fontSize: '24px', color: '#ffffff' });
        this.timerText = this.add.text(600, 50, 'Time: 30', { fontSize: '24px', color: '#ffffff' });

        this.questionText = this.add.text(100, 150, '', { fontSize: '28px', color: '#ffffff', wordWrap: { width: 600 } });
        this.optionButtons = [];

        this.feedbackText = this.add.text(400, 500, '', { fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);

        this.displayQuestion();

        // --- Timer ---
        this.timer = this.time.addEvent({
            delay: 1000,
            callback: this.updateTimer,
            callbackScope: this,
            loop: true
        });
    }

    displayQuestion() {
        // Clear previous options
        this.optionButtons.forEach(button => button.destroy());
        this.optionButtons = [];
        this.feedbackText.setText('');

        if (this.currentQuestionIndex >= this.questions.length) {
            this.endQuiz();
            return;
        }

        const questionData = this.questions[this.currentQuestionIndex];
        this.questionText.setText(questionData.question);

        questionData.options.forEach((option, index) => {
            const button = this.add.text(150, 250 + index * 60, option, {
                fontSize: '24px',
                backgroundColor: '#333333',
                color: '#ffffff',
                padding: 10,
                fixedWidth: 500
            })
            .setInteractive()
            .on('pointerdown', () => this.selectAnswer(index, button));
            
            this.optionButtons.push(button);
        });
    }

    selectAnswer(selectedIndex, button) {
        const questionData = this.questions[this.currentQuestionIndex];
        
        // Disable all buttons to prevent multiple answers
        this.optionButtons.forEach(btn => btn.disableInteractive());

        if (selectedIndex === questionData.answer) {
            // Correct answer
            this.score += 10;
            this.timeLeft += 5; // Add 5 seconds for correct answer
            this.scoreText.setText(`Score: ${this.score}`);
            this.timerText.setText(`Time: ${this.timeLeft}`);
            button.setBackgroundColor('#00ff00'); // Green for correct
            this.feedbackText.setText('Correct! +5 seconds');
        } else {
            // Incorrect answer
            button.setBackgroundColor('#ff0000'); // Red for incorrect
            // Highlight the correct answer
            this.optionButtons[questionData.answer].setBackgroundColor('#00ff00');
            this.feedbackText.setText('Wrong!');
        }

        this.currentQuestionIndex++;

        // Move to the next question after a short delay
        this.time.delayedCall(1500, () => {
            this.displayQuestion();
        });
    }

    updateTimer() {
        this.timeLeft--;
        this.timerText.setText(`Time: ${this.timeLeft}`);

        if (this.timeLeft <= 0) {
            this.timer.remove();
            this.endQuiz();
        }
    }

    endQuiz() {
        this.timer.remove();
        this.questionText.setText('Quiz Complete!');
        this.optionButtons.forEach(button => button.destroy());

        this.add.text(400, 300, `Final Score: ${this.score}`, { fontSize: '32px', color: '#ffffff' }).setOrigin(0.5);

        const menuButton = this.add.text(400, 400, 'Main Menu', { fontSize: '32px', backgroundColor: '#0000ff', color: '#ffffff', padding: 10 })
            .setOrigin(0.5)
            .setInteractive()
            .on('pointerdown', () => {
                // Reset quiz state before going to menu
                this.currentQuestionIndex = 0;
                this.score = 0;
                this.timeLeft = 30;
                this.scene.start('MainMenu');
            });
    }
}
