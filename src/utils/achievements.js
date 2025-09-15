import { db } from '../config/firebase-config.js';
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';

class Achievements {
    constructor(studentId) {
        this.studentId = studentId;

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
        if (!this.studentId) return;
        const docRef = doc(db, 'achievements', this.studentId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            this.unlockedAchievements = new Set(data.unlocked || []);
            this.currentXP = data.xp || 0;
            this.lastPlayDate = data.lastPlayDate ? data.lastPlayDate.toDate() : null;
            this.consecutiveDays = data.consecutiveDays || 0;
        } else {
            // Initialize in Firestore
            await setDoc(docRef, {
                unlocked: [],
                xp: 0,
                lastPlayDate: null,
                consecutiveDays: 0
            });
        }
    }

    async saveAchievements() {
        if (!this.studentId) return;
        const docRef = doc(db, 'achievements', this.studentId);
        await updateDoc(docRef, {
            unlocked: Array.from(this.unlockedAchievements),
            xp: this.currentXP,
            lastPlayDate: this.lastPlayDate,
            consecutiveDays: this.consecutiveDays
        });
    }

    async unlock(achievementId) {
        if (this.unlockedAchievements.has(achievementId)) {
            return false; // Already unlocked
        }

        const achievement = this.achievementsList[achievementId];
        if (!achievement) {
            return false;
        }

        this.unlockedAchievements.add(achievementId);
        this.currentXP += achievement.xpReward;

        // Save to Firestore
        const docRef = doc(db, 'achievements', this.studentId);
        await updateDoc(docRef, {
            unlocked: arrayUnion(achievementId),
            xp: this.currentXP
        });

        // Show achievement notification
        this.showNotification(achievement);
        return true;
    }

    showNotification(achievement) {
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
        return Array.from(this.unlockedAchievements).map(id => this.achievementsList[id]);
    }
}

export { Achievements };