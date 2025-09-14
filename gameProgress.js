class GameProgress {
    constructor() {
        // Define the game sequence and requirements
        this.gameSequence = [
            { id: 'TreasureHunt', name: 'Treasure Hunt', required: null, score: 0 },
            { id: 'InteractiveQuiz', name: 'Interactive Quiz', required: 'TreasureHunt', score: 0 },
            { id: 'MatchingPairs', name: 'Matching Pairs', required: 'InteractiveQuiz', score: 0 },
            { id: 'SimulationGame', name: 'Virtual Circuit', required: 'MatchingPairs', score: 0 },
            { id: 'WordPuzzle', name: 'Word Puzzle', required: 'SimulationGame', score: 0 }
        ];

        // Load saved progress from localStorage if available
        this.loadProgress();
    }

    loadProgress() {
        const saved = localStorage.getItem('gameProgress');
        if (saved) {
            const progress = JSON.parse(saved);
            this.gameSequence.forEach((game, index) => {
                if (progress[game.id]) {
                    this.gameSequence[index].score = progress[game.id].score;
                }
            });
        }
    }

    saveProgress() {
        const progress = {};
        this.gameSequence.forEach(game => {
            progress[game.id] = {
                score: game.score
            };
        });
        localStorage.setItem('gameProgress', JSON.stringify(progress));
    }

    updateScore(gameId, score) {
        const game = this.gameSequence.find(g => g.id === gameId);
        if (game) {
            game.score = Math.max(game.score, score); // Keep highest score
            this.saveProgress();
        }
    }

    isGameUnlocked(gameId) {
        const game = this.gameSequence.find(g => g.id === gameId);
        if (!game) return false;
        if (!game.required) return true; // First game is always unlocked

        const requiredGame = this.gameSequence.find(g => g.id === game.required);
        return requiredGame && requiredGame.score > 0; // Game unlocks if previous game has been completed
    }

    getGameStatus(gameId) {
        const game = this.gameSequence.find(g => g.id === gameId);
        if (!game) return null;

        return {
            name: game.name,
            unlocked: this.isGameUnlocked(gameId),
            score: game.score,
            isComplete: game.score > 0
        };
    }

    getAllGameStatus() {
        return this.gameSequence.map(game => ({
            id: game.id,
            name: game.name,
            unlocked: this.isGameUnlocked(game.id),
            score: game.score,
            isComplete: game.score > 0
        }));
    }

    resetProgress() {
        this.gameSequence.forEach(game => {
            game.score = 0;
        });
        localStorage.removeItem('gameProgress');
    }
}

// Create a global instance for all scenes to access
const gameProgress = new GameProgress();