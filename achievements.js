class Achievements {
    constructor() {
        // Define achievement categories
        this.categories = {
            PROGRESSION: 'progression',
            PERFORMANCE: 'performance',
            CONSISTENCY: 'consistency',
            MASTERY: 'mastery'
        };

        // Define all possible achievements
        this.achievementsList = {
            // Progression Achievements
            firstGame: {
                id: 'firstGame',
                category: this.categories.PROGRESSION,
                title: 'First Steps',
                description: 'Complete your first game',
                icon: 'assets/ui/achievements/first-steps.png',
                xpReward: 50
            },
            allGamesPlayed: {
                id: 'allGamesPlayed',
                category: this.categories.PROGRESSION,
                title: 'Explorer',
                description: 'Play all available games at least once',
                icon: 'assets/ui/achievements/explorer.png',
                xpReward: 100
            },

            // Performance Achievements
            perfectScore: {
                id: 'perfectScore',
                category: this.categories.PERFORMANCE,
                title: 'Perfect Score',
                description: 'Get 100% in any game',
                icon: 'assets/ui/achievements/perfect-score.png',
                xpReward: 150
            },
            quickLearner: {
                id: 'quickLearner',
                category: this.categories.PERFORMANCE,
                title: 'Quick Learner',
                description: 'Complete any game in under 2 minutes with at least 80% score',
                icon: 'assets/ui/achievements/quick-learner.png',
                xpReward: 100
            },

            // Consistency Achievements
            dailyStreak: {
                id: 'dailyStreak',
                category: this.categories.CONSISTENCY,
                title: 'Daily Scholar',
                description: 'Play at least one game for 5 consecutive days',
                icon: 'assets/ui/achievements/daily-scholar.png',
                xpReward: 200,
                progress: 0,
                maxProgress: 5
            },
            practiceChampion: {
                id: 'practiceChampion',
                category: this.categories.CONSISTENCY,
                title: 'Practice Champion',
                description: 'Complete the same game 10 times',
                icon: 'assets/ui/achievements/practice-champion.png',
                xpReward: 150,
                progress: 0,
                maxProgress: 10
            },

            // Mastery Achievements
            subjectMaster: {
                id: 'subjectMaster',
                category: this.categories.MASTERY,
                title: 'Subject Master',
                description: 'Get at least 90% in all games',
                icon: 'assets/ui/achievements/subject-master.png',
                xpReward: 300
            },
            speedMaster: {
                id: 'speedMaster',
                category: this.categories.MASTERY,
                title: 'Speed Master',
                description: 'Complete all games under par time with at least 80% score',
                icon: 'assets/ui/achievements/speed-master.png',
                xpReward: 250
            }
        };

        // Initialize student's achievements
        this.unlockedAchievements = new Set();
        this.currentXP = 0;
        this.lastPlayDate = null;
        this.consecutiveDays = 0;

        // Load saved achievements
        this.loadAchievements();
    }

    async loadAchievements() {
        try {
            // Try loading from Firebase if online and authenticated
            if (window.navigator.onLine && gameProgress.studentId) {
                const db = firebase.firestore();
                const doc = await db.collection('achievements')
                    .doc(gameProgress.studentId)
                    .get();

                if (doc.exists) {
                    const data = doc.data();
                    this.unlockedAchievements = new Set(data.unlockedAchievements);
                    this.currentXP = data.currentXP;
                    this.lastPlayDate = data.lastPlayDate;
                    this.consecutiveDays = data.consecutiveDays;
                    return;
                }
            }
        } catch (error) {
            console.warn('Failed to load achievements from Firebase:', error);
        }

        // Fall back to localStorage
        const saved = localStorage.getItem('achievements');
        if (saved) {
            const data = JSON.parse(saved);
            this.unlockedAchievements = new Set(data.unlockedAchievements);
            this.currentXP = data.currentXP;
            this.lastPlayDate = data.lastPlayDate;
            this.consecutiveDays = data.consecutiveDays;
        }
    }

    async saveAchievements() {
        const data = {
            unlockedAchievements: Array.from(this.unlockedAchievements),
            currentXP: this.currentXP,
            lastPlayDate: this.lastPlayDate,
            consecutiveDays: this.consecutiveDays
        };

        // Save to localStorage
        localStorage.setItem('achievements', JSON.stringify(data));

        // Save to Firebase if online
        if (window.navigator.onLine && gameProgress.studentId) {
            try {
                const db = firebase.firestore();
                await db.collection('achievements')
                    .doc(gameProgress.studentId)
                    .set(data, { merge: true });
            } catch (error) {
                console.warn('Failed to save achievements to Firebase:', error);
            }
        }
    }

    async unlockAchievement(achievementId) {
        if (this.unlockedAchievements.has(achievementId)) {
            return false; // Already unlocked
        }

        const achievement = this.achievementsList[achievementId];
        if (!achievement) {
            return false;
        }

        this.unlockedAchievements.add(achievementId);
        this.currentXP += achievement.xpReward;
        await this.saveAchievements();

        // Show achievement notification
        this.showAchievementNotification(achievement);
        return true;
    }

    showAchievementNotification(achievement) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'achievement-notification';
        notification.innerHTML = `
            <img src="${achievement.icon}" alt="${achievement.title}">
            <div class="achievement-info">
                <h3>${achievement.title}</h3>
                <p>${achievement.description}</p>
                <span class="xp-reward">+${achievement.xpReward} XP</span>
            </div>
        `;

        // Add notification styles
        const style = document.createElement('style');
        style.textContent = `
            .achievement-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                display: flex;
                align-items: center;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 15px;
                border-radius: 10px;
                z-index: 1000;
                animation: slideIn 0.5s ease-out, fadeOut 0.5s ease-in 4.5s;
            }
            .achievement-notification img {
                width: 50px;
                height: 50px;
                margin-right: 15px;
            }
            .achievement-info h3 {
                margin: 0;
                color: #ffd700;
            }
            .achievement-info p {
                margin: 5px 0;
                font-size: 14px;
            }
            .xp-reward {
                color: #00ff00;
                font-weight: bold;
            }
            @keyframes slideIn {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
            }
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(notification);

        // Remove notification after 5 seconds
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    getUnlockedAchievements() {
        return Array.from(this.unlockedAchievements).map(id => ({
            ...this.achievementsList[id],
            unlockDate: new Date().toISOString() // In a real app, store unlock dates
        }));
    }

    getLockedAchievements() {
        return Object.values(this.achievementsList)
            .filter(achievement => !this.unlockedAchievements.has(achievement.id));
    }

    getCurrentLevel() {
        const xpPerLevel = 500;
        return Math.floor(this.currentXP / xpPerLevel) + 1;
    }

    getXPProgress() {
        const xpPerLevel = 500;
        const currentLevel = this.getCurrentLevel();
        const xpInCurrentLevel = this.currentXP - ((currentLevel - 1) * xpPerLevel);
        return {
            currentXP: this.currentXP,
            levelXP: xpInCurrentLevel,
            nextLevelXP: xpPerLevel,
            progress: (xpInCurrentLevel / xpPerLevel) * 100
        };
    }

    checkGameCompletion(gameId, score, timeSpent) {
        // Check for first game completion
        if (this.unlockedAchievements.size === 0) {
            this.unlockAchievement('firstGame');
        }

        // Check for perfect score
        if (score >= 100) {
            this.unlockAchievement('perfectScore');
        }

        // Check for quick learner
        if (score >= 80 && timeSpent < 120) { // 120 seconds = 2 minutes
            this.unlockAchievement('quickLearner');
        }

        // Update daily streak
        this.updateDailyStreak();

        // Check for practice champion
        const gameStatus = gameProgress.getGameStatus(gameId);
        if (gameStatus && gameStatus.attempts >= 10) {
            this.unlockAchievement('practiceChampion');
        }

        // Check for subject master and all games played
        const allStatus = gameProgress.getAllGameStatus();
        if (allStatus.every(game => game.attempts > 0)) {
            this.unlockAchievement('allGamesPlayed');
        }
        if (allStatus.every(game => game.score >= 90)) {
            this.unlockAchievement('subjectMaster');
        }
    }

    updateDailyStreak() {
        const today = new Date().toDateString();
        if (this.lastPlayDate) {
            const lastPlay = new Date(this.lastPlayDate).toDateString();
            const yesterday = new Date(Date.now() - 86400000).toDateString();

            if (today === lastPlay) {
                return; // Already played today
            } else if (yesterday === lastPlay) {
                this.consecutiveDays++;
                if (this.consecutiveDays >= 5) {
                    this.unlockAchievement('dailyStreak');
                }
            } else {
                this.consecutiveDays = 1; // Reset streak
            }
        } else {
            this.consecutiveDays = 1;
        }

        this.lastPlayDate = new Date().toISOString();
        this.saveAchievements();
    }

    resetAchievements() {
        this.unlockedAchievements.clear();
        this.currentXP = 0;
        this.lastPlayDate = null;
        this.consecutiveDays = 0;
        this.saveAchievements();
    }
}

// Create a global instance
const achievements = new Achievements();