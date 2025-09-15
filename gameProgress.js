class GameProgress {
    constructor() {
        // Define the game sequence and requirements
        this.gameSequence = [
            { id: 'TreasureHunt', name: 'Treasure Hunt', required: null, score: 0, attempts: 0 },
            { id: 'InteractiveQuiz', name: 'Interactive Quiz', required: 'TreasureHunt', score: 0, attempts: 0 },
            { id: 'MatchingPairs', name: 'Matching Pairs', required: 'InteractiveQuiz', score: 0, attempts: 0 },
            { id: 'SimulationGame', name: 'Virtual Circuit', required: 'MatchingPairs', score: 0, attempts: 0 },
            { id: 'WordPuzzle', name: 'Word Puzzle', required: 'SimulationGame', score: 0, attempts: 0 }
        ];

        // Initialize student data
        this.studentId = null;
        this.studentName = null;
        this.classId = null;
        this.lastSyncTime = null;
        this.pendingSync = [];

        // Load saved progress
        this.loadProgress();
    }

    async initializeStudent(studentId, studentName, classId) {
        this.studentId = studentId;
        this.studentName = studentName;
        this.classId = classId;
        await Promise.all([
            this.loadProgress(),
            achievements.loadAchievements()
        ]);
    }

    async loadProgress() {
        try {
            // Try loading from Firebase first
            if (this.studentId && window.navigator.onLine) {
                const db = firebase.firestore();
                const docRef = db.collection('studentProgress').doc(this.studentId);
                const doc = await docRef.get();
                
                if (doc.exists) {
                    const data = doc.data();
                    this.lastSyncTime = data.lastSyncTime;
                    this.gameSequence.forEach((game, index) => {
                        if (data.games && data.games[game.id]) {
                            this.gameSequence[index] = {
                                ...game,
                                ...data.games[game.id]
                            };
                        }
                    });
                    return;
                }
            }
        } catch (error) {
            console.warn('Failed to load from Firebase:', error);
        }

        // Fall back to localStorage
        const saved = localStorage.getItem('gameProgress');
        if (saved) {
            const progress = JSON.parse(saved);
            this.gameSequence.forEach((game, index) => {
                if (progress.games && progress.games[game.id]) {
                    this.gameSequence[index] = {
                        ...game,
                        ...progress.games[game.id]
                    };
                }
            });
            this.lastSyncTime = progress.lastSyncTime;
            this.pendingSync = progress.pendingSync || [];
        }
    }

    async saveProgress() {
        const progress = {
            studentId: this.studentId,
            studentName: this.studentName,
            classId: this.classId,
            lastSyncTime: new Date().toISOString(),
            games: {}
        };

        this.gameSequence.forEach(game => {
            progress.games[game.id] = {
                score: game.score,
                attempts: game.attempts,
                lastPlayed: game.lastPlayed
            };
        });

        // Save to localStorage first
        localStorage.setItem('gameProgress', JSON.stringify({
            ...progress,
            pendingSync: this.pendingSync
        }));

        // Try saving to Firebase if online
        if (window.navigator.onLine && this.studentId) {
            try {
                const db = firebase.firestore();
                await db.collection('studentProgress').doc(this.studentId).set(progress, { merge: true });
                this.pendingSync = []; // Clear pending syncs after successful save
                localStorage.setItem('gameProgress', JSON.stringify({
                    ...progress,
                    pendingSync: []
                }));
            } catch (error) {
                console.warn('Failed to save to Firebase:', error);
                // Queue for later sync
                this.pendingSync.push({
                    timestamp: new Date().toISOString(),
                    data: progress
                });
            }
        } else if (this.studentId) {
            // Queue for later sync if offline
            this.pendingSync.push({
                timestamp: new Date().toISOString(),
                data: progress
            });
        }
    }

    async updateScore(gameId, score, timeSpent, completionStatus) {
        const game = this.gameSequence.find(g => g.id === gameId);
        if (game) {
            const now = new Date().toISOString();
            game.attempts += 1;
            game.lastPlayed = now;
            game.timeSpent = (game.timeSpent || 0) + timeSpent;
            
            // Update high score if new score is better
            if (score > (game.score || 0)) {
                game.score = score;
                game.bestCompletionTime = timeSpent;
            }
            
            // Check for achievements
            achievements.checkGameCompletion(gameId, score, timeSpent);

            // Track detailed analytics
            const analytics = {
                gameId,
                studentId: this.studentId,
                classId: this.classId,
                timestamp: now,
                score,
                timeSpent,
                attemptNumber: game.attempts,
                completionStatus
            };

            // Save analytics to Firebase if online
            if (window.navigator.onLine && this.studentId) {
                try {
                    const db = firebase.firestore();
                    await db.collection('gameAnalytics').add(analytics);
                } catch (error) {
                    console.warn('Failed to save analytics:', error);
                    this.pendingSync.push({
                        type: 'analytics',
                        timestamp: now,
                        data: analytics
                    });
                }
            } else if (this.studentId) {
                this.pendingSync.push({
                    type: 'analytics',
                    timestamp: now,
                    data: analytics
                });
            }

            await this.saveProgress();
        }
    }

    isGameUnlocked(gameId) {
        const game = this.gameSequence.find(g => g.id === gameId);
        if (!game) return false;
        if (!game.required) return true; // First game is always unlocked

        const requiredGame = this.gameSequence.find(g => g.id === game.required);
        if (!requiredGame) return false;

        // Game unlocks if previous game has been completed with minimum score threshold
        const minimumScoreThreshold = 60; // 60% minimum score to unlock next game
        return requiredGame.score >= minimumScoreThreshold;
    }

    getGameStatus(gameId) {
        const game = this.gameSequence.find(g => g.id === gameId);
        if (!game) return null;

        return {
            name: game.name,
            unlocked: this.isGameUnlocked(gameId),
            score: game.score,
            attempts: game.attempts,
            timeSpent: game.timeSpent,
            lastPlayed: game.lastPlayed,
            bestCompletionTime: game.bestCompletionTime,
            isComplete: game.score >= 60 // 60% threshold for completion
        };
    }

    getAllGameStatus() {
        return this.gameSequence.map(game => ({
            id: game.id,
            name: game.name,
            unlocked: this.isGameUnlocked(game.id),
            score: game.score,
            attempts: game.attempts,
            timeSpent: game.timeSpent,
            lastPlayed: game.lastPlayed,
            bestCompletionTime: game.bestCompletionTime,
            isComplete: game.score >= 60
        }));
    }

    getPerformanceMetrics() {
        const completedGames = this.gameSequence.filter(game => game.score >= 60);
        const totalTimeSpent = this.gameSequence.reduce((total, game) => total + (game.timeSpent || 0), 0);
        const averageScore = this.gameSequence.reduce((total, game) => total + (game.score || 0), 0) / this.gameSequence.length;

        return {
            totalGamesPlayed: this.gameSequence.filter(game => game.attempts > 0).length,
            totalGamesCompleted: completedGames.length,
            averageScore,
            totalTimeSpent,
            averageAttemptsPerGame: this.gameSequence.reduce((total, game) => total + game.attempts, 0) / this.gameSequence.length,
            completionPercentage: (completedGames.length / this.gameSequence.length) * 100,
            needsReview: this.gameSequence.filter(game => game.attempts > 0 && game.score < 60)
                .map(game => game.name)
        };
    }

    async resetProgress() {
        if (this.studentId) {
            try {
                const db = firebase.firestore();
                const batch = db.batch();
                
                // Delete progress
                batch.delete(db.collection('studentProgress').doc(this.studentId));
                // Delete achievements
                batch.delete(db.collection('achievements').doc(this.studentId));
                
                await batch.commit();
            } catch (error) {
                console.warn('Failed to reset progress in Firebase:', error);
            }
        }

        this.gameSequence.forEach(game => {
            game.score = 0;
            game.attempts = 0;
            game.timeSpent = 0;
            game.lastPlayed = null;
            game.bestCompletionTime = null;
        });

        this.lastSyncTime = null;
        this.pendingSync = [];
        localStorage.removeItem('gameProgress');
        
        // Reset achievements
        achievements.resetAchievements();
    }

    async syncPendingData() {
        if (!window.navigator.onLine || !this.studentId || this.pendingSync.length === 0) {
            return;
        }

        const db = firebase.firestore();
        const batch = db.batch();

        try {
            for (const item of this.pendingSync) {
                if (item.type === 'analytics') {
                    const analyticsRef = db.collection('gameAnalytics').doc();
                    batch.set(analyticsRef, item.data);
                } else {
                    // Progress sync
                    const progressRef = db.collection('studentProgress').doc(this.studentId);
                    batch.set(progressRef, item.data, { merge: true });
                }
            }

            await batch.commit();
            this.pendingSync = [];
            localStorage.setItem('gameProgress', JSON.stringify({
                ...JSON.parse(localStorage.getItem('gameProgress')),
                pendingSync: []
            }));
        } catch (error) {
            console.warn('Failed to sync pending data:', error);
        }
    }
}

// Create a global instance for all scenes to access
const gameProgress = new GameProgress();