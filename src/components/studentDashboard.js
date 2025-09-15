import { db } from '../config/firebase-config.js';
import { reportingSystem } from '../utils/reportingSystem.js';
import { getGameInstance } from '../utils/game.js';

class StudentDashboard {
    constructor(studentId) {
        this.db = db;
        this.studentId = studentId;
        this.missions = null;
        this.currentMission = null;
        this.currentPhase = null;
        this.phaserGame = getGameInstance();

        // DOM element references
        this.views = {
            missionSelect: document.getElementById('mission-select-view'),
            leaderboard: document.getElementById('leaderboard-view'), // Add this
            learn: document.getElementById('learn-view'),
            play: document.getElementById('play-view-container'),
            conquer: document.getElementById('conquer-view')
        };

        this.buttons = {
            startPlay: document.getElementById('start-play-phase-btn'),
            showAchievements: document.getElementById('achievements-btn'),
            closeAchievements: document.getElementById('modal-close-btn'),
            showLeaderboard: document.getElementById('leaderboard-btn') // Add this
        };

        this.modal = document.getElementById('achievements-modal');
        this.leaderboard = new Leaderboard(this.db); // Add this
        
        // Bind methods
        this.renderMissionSelect = this.renderMissionSelect.bind(this);
        this.renderLearnPhase = this.renderLearnPhase.bind(this);
        this.renderPlayPhase = this.renderPlayPhase.bind(this);
        this.renderConquerPhase = this.renderConquerPhase.bind(this);
        this.handlePhaseTransition = this.handlePhaseTransition.bind(this);
        this.handleOnlineStatus = this.handleOnlineStatus.bind(this);

        // Setup sync listeners
        window.addEventListener('online', this.handleOnlineStatus);
        window.addEventListener('offline', this.handleOnlineStatus);
        
        // Initialize periodic sync
        this.initPeriodicSync();
    }

    async init() {
        console.log("Initializing Student Dashboard...");
        this.setupEventListeners();
        this.setupGlobalEventListeners();
        await this.loadMissionsAndRender();
    }

    async loadMissionsAndRender() {
        try {
            const response = await fetch('missions.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.missions = await response.json();
            console.log("Missions loaded successfully:", this.missions);
            this.renderMissionSelect();
        } catch (error) {
            console.error("Could not load missions.json:", error);
            const missionGrid = document.getElementById('mission-grid');
            missionGrid.innerHTML = '<p style="color: red;">Error: Could not load missions. Please check the console.</p>';
        }
    }

    renderMissionSelect() {
        const missionGrid = document.getElementById('mission-grid');
        missionGrid.innerHTML = ''; // Clear any previous content

        if (!this.missions || !this.missions.subjects) {
            missionGrid.innerHTML = '<p>No missions are available at this time.</p>';
            return;
        }

        // Loop through each subject and its missions
        for (const subjectKey in this.missions.subjects) {
            const subject = this.missions.subjects[subjectKey];
            subject.missions.forEach(mission => {
                const card = document.createElement('div');
                card.className = 'mission-card';
                card.dataset.missionId = mission.id; // Set data attribute for click handling

                card.innerHTML = `
                    <h3>${mission.title}</h3>
                    <p>${mission.description}</p>
                `;
                missionGrid.appendChild(card);
            });
        }
    }

    selectMission(missionId) {
        if (!this.missions) return;

        // Find the selected mission from the loaded data
        for (const subjectKey in this.missions.subjects) {
            const subject = this.missions.subjects[subjectKey];
            const foundMission = subject.missions.find(m => m.id === missionId);
            if (foundMission) {
                this.currentMission = foundMission;
                break;
            }
        }

        if (this.currentMission) {
            console.log("Mission selected:", this.currentMission.title);
            // Transition to the first phase of the mission
            this.handlePhaseTransition('learn');
        } else {
            console.error(`Mission with ID "${missionId}" not found.`);
        }
    }

    setupEventListeners() {
        // Subject selection
        const subjectSelect = document.getElementById('subject-select');
        subjectSelect.addEventListener('change', () => {
            this.renderMissionSelect(subjectSelect.value);
        });

        // Navigation buttons
        document.getElementById('prev-btn').addEventListener('click', () => {
            this.navigateContent(-1);
        });
        document.getElementById('next-btn').addEventListener('click', () => {
            this.navigateContent(1);
        });

        // Phase transitions
        document.querySelectorAll('.phase').forEach(phase => {
            phase.addEventListener('click', () => {
                const phaseType = phase.dataset.phase;
                if (this.canTransitionTo(phaseType)) {
                    this.handlePhaseTransition(phaseType);
                }
            });
        });

        // Use event delegation for mission card clicks
        this.views.missionSelect.addEventListener('click', (event) => {
            const missionCard = event.target.closest('.mission-card');
            if (missionCard) {
                const missionId = missionCard.dataset.missionId;
                this.selectMission(missionId);
            }
        });

        // Event listener for starting the play phase
        this.buttons.startPlay.addEventListener('click', () => {
            this.handlePhaseTransition('play');
        });

        // Add event listener for the finish mission button
        document.getElementById('finish-mission-btn').addEventListener('click', () => {
            this.submitQuiz();
        });

        // Event listeners for achievements modal
        this.buttons.showAchievements.addEventListener('click', () => {
            this.showAchievementsModal();
        });

        this.buttons.closeAchievements.addEventListener('click', () => {
            this.hideAchievementsModal();
        });

        // Event listener for showing the leaderboard
        this.buttons.showLeaderboard.addEventListener('click', () => {
            // We can reuse the handlePhaseTransition logic to switch views
            this.handlePhaseTransition('leaderboard');
        });

        // Also close modal if user clicks on the overlay
        this.modal.addEventListener('click', (event) => {
            if (event.target === this.modal) {
                this.hideAchievementsModal();
            }
        });
    }

    setupGlobalEventListeners() {
        // Listen for the custom event dispatched by the Phaser scenes
        window.addEventListener('gameComplete', (event) => {
            this.handleGameCompletion(event.detail);
        });
        console.log("Global event listener for 'gameComplete' is set up.");
    }

    handleGameCompletion(detail) {
        console.log(`Game complete event received. Score: ${detail.score}`);

        if (!this.currentMission) {
            console.error("Game completed, but no mission is currently active.");
            return;
        }

        // 1. Save the score using gameProgress.js
        // Assuming gameProgress has a method like `saveGameResult`
        if (typeof gameProgress !== 'undefined' && gameProgress.saveGameResult) {
            gameProgress.saveGameResult(this.currentMission.id, detail.score);
            console.log(`Score for mission ${this.currentMission.id} saved.`);
        } else {
            console.warn("gameProgress.saveGameResult method not found. Score not saved.");
        }

        // 2. Destroy the Phaser game instance to free up resources
        if (this.phaserGame) {
            this.phaserGame.destroy(true);
            this.phaserGame = null;
            console.log("Phaser game instance destroyed.");
        }

        // 3. Hide the #play-view-container (handled by handlePhaseTransition)
        // 4. Transition the UI to show the "Conquer" phase quiz
        console.log("Transitioning to Conquer phase.");
        this.handlePhaseTransition('conquer');
    }

    canTransitionTo(phase) {
        if (!this.currentMission) return false;
        
        const progress = gameProgress.getGameStatus(this.currentMission.id);
        
        switch (phase) {
            case 'learn':
                return true; // Can always access learn phase
            case 'play':
                return progress && progress.learnPhaseCompleted;
            case 'conquer':
                return progress && progress.playPhaseCompleted;
            default:
                return false;
        }
    }

    async handlePhaseTransition(newPhase) {
        // Hide all views
        Object.values(this.views).forEach(view => view.style.display = 'none');

        // Show the new view and render its content
        this.currentPhase = newPhase;
        switch (newPhase) {
            case 'leaderboard':
                this.views.leaderboard.style.display = 'block';
                this.renderLeaderboard();
                break;
            case 'learn':
                this.views.learn.style.display = 'block';
                this.renderLearnPhase();
                break;
            case 'play':
                this.views.play.style.display = 'flex'; // Use flex to center the game
                this.renderPlayPhase();
                break;
            case 'conquer':
                this.views.conquer.style.display = 'block';
                this.renderConquerPhase();
                break;
            default:
                this.views.missionSelect.style.display = 'block';
                this.renderMissionSelect();
        }
    }

    async savePhaseProgress() {
        if (!this.currentMission || !this.currentPhase) return;

        const progress = {
            missionId: this.currentMission.id,
            phase: this.currentPhase,
            completedContent: this.currentContent,
            timestamp: new Date().toISOString(),
            deviceId: this.getDeviceId(), // Used for conflict resolution
            syncStatus: 'pending'
        };

        try {
            // Save to IndexedDB first
            await this.saveProgressOffline(progress);

            // Add to sync queue
            this.syncQueue.push({
                type: 'progress',
                data: progress,
                timestamp: progress.timestamp
            });
            localStorage.setItem('syncQueue', JSON.stringify(this.syncQueue));

            // Try to sync immediately if online
            if (window.navigator.onLine) {
                await this.syncProgress();
            }
        } catch (error) {
            console.error('Failed to save phase progress:', error);
        }
    }

    async saveProgressOffline(progress) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('StudentDashboard', 1);
            
            request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction(['progress'], 'readwrite');
                const store = transaction.objectStore('progress');
                
                const key = `${progress.missionId}_${progress.phase}_${progress.timestamp}`;
                const storeRequest = store.put(progress, key);
                
                storeRequest.onsuccess = () => resolve();
                storeRequest.onerror = () => reject(storeRequest.error);
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    async syncProgress() {
        if (!window.navigator.onLine || !this.student?.id || this.syncQueue.length === 0) {
            return;
        }

        const db = firebase.firestore();
        const batch = db.batch();
        const successfulSyncs = [];

        try {
            // Sort sync queue by timestamp
            this.syncQueue.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            for (const item of this.syncQueue) {
                if (item.type === 'progress') {
                    const progressRef = db.collection('studentProgress')
                        .doc(this.student.id)
                        .collection('phases')
                        .doc(item.data.timestamp); // Use timestamp as document ID for ordering

                    batch.set(progressRef, {
                        ...item.data,
                        syncedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });

                    successfulSyncs.push(item);
                }
            }

            await batch.commit();

            // Remove synced items from queue
            this.syncQueue = this.syncQueue.filter(item => !successfulSyncs.includes(item));
            localStorage.setItem('syncQueue', JSON.stringify(this.syncQueue));

            // Update offline progress status
            await this.updateOfflineProgressStatus(successfulSyncs);

        } catch (error) {
            console.error('Failed to sync progress:', error);
            // Implement exponential backoff for retries
            setTimeout(() => this.syncProgress(), this.getNextRetryDelay());
        }
    }

    async updateOfflineProgressStatus(syncedItems) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('StudentDashboard', 1);
            
            request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction(['progress'], 'readwrite');
                const store = transaction.objectStore('progress');

                syncedItems.forEach(item => {
                    const key = `${item.data.missionId}_${item.data.phase}_${item.data.timestamp}`;
                    const getRequest = store.get(key);

                    getRequest.onsuccess = () => {
                        const progress = getRequest.result;
                        if (progress) {
                            progress.syncStatus = 'synced';
                            store.put(progress, key);
                        }
                    };
                });

                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            };
        });
    }

    getDeviceId() {
        let deviceId = localStorage.getItem('deviceId');
        if (!deviceId) {
            deviceId = 'device_' + new Date().getTime() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('deviceId', deviceId);
        }
        return deviceId;
    }

    getNextRetryDelay() {
        const retryAttempt = parseInt(localStorage.getItem('syncRetryAttempt') || '0');
        const baseDelay = 1000; // 1 second
        const maxDelay = 60000; // 1 minute
        
        const delay = Math.min(baseDelay * Math.pow(2, retryAttempt), maxDelay);
        localStorage.setItem('syncRetryAttempt', (retryAttempt + 1).toString());
        
        return delay;
    }

    async renderMissionSelect(subject = '') {
        const container = document.getElementById('mission-select');
        container.classList.add('active');

        if (!this.missions) {
            container.innerHTML = '<p>Loading missions...</p>';
            return;
        }

        // Update subject dropdown
        const subjectSelect = document.getElementById('subject-select');
        subjectSelect.innerHTML = '<option value="">Select Subject</option>' +
            Object.keys(this.missions.subjects).map(key => 
                `<option value="${key}" ${key === subject ? 'selected' : ''}>
                    ${this.missions.subjects[key].title}
                </option>`
            ).join('');

        // Render missions for selected subject
        let missionHtml = '';
        if (subject && this.missions.subjects[subject]) {
            const subjectMissions = this.missions.subjects[subject].missions;
            missionHtml = subjectMissions.map(mission => {
                const status = gameProgress.getGameStatus(mission.id);
                const isLocked = mission.prerequisite && 
                    !gameProgress.isGameUnlocked(mission.prerequisite);
                
                return `
                    <div class="mission-card ${isLocked ? 'locked' : ''}"
                         data-mission-id="${mission.id}"
                         onclick="${isLocked ? '' : `this.selectMission('${mission.id}')`}">
                        <h3>${mission.title}</h3>
                        <p>${mission.description || ''}</p>
                        <div class="mission-meta">
                            <span>Grade ${mission.grade}</span>
                            <span>${mission.estimatedTime}</span>
                        </div>
                        ${status ? `
                            <div class="mission-progress">
                                <div class="progress-bar">
                                    <div class="progress" style="width: ${status.progress}%"></div>
                                </div>
                                <span>${status.progress}% Complete</span>
                            </div>
                        ` : ''}
                        ${isLocked ? `
                            <div class="lock-message">
                                Complete previous mission to unlock
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');
        }

        container.innerHTML = `
            <h2>${subject ? this.missions.subjects[subject].title : 'Select a Subject'}</h2>
            <div class="missions-grid">
                ${missionHtml || '<p>Select a subject to view missions</p>'}
            </div>
        `;
    }

    renderLearnPhase() {
        if (!this.currentMission) {
            console.error("Cannot render Learn phase: no mission selected.");
            this.handlePhaseTransition('missionSelect'); // Go back if no mission is active
            return;
        }

        const learnContentContainer = document.getElementById('learn-content');
        const learnTitle = document.getElementById('learn-title');

        // 1. Clear any previous content
        learnContentContainer.innerHTML = '';
        learnTitle.textContent = `${this.currentMission.title}: Learn Phase`;

        const learnSteps = this.currentMission.learn;

        if (!learnSteps || learnSteps.length === 0) {
            learnContentContainer.innerHTML = '<p>No learning materials are available for this mission.</p>';
            return;
        }

        // 2. Parse and render each content item
        learnSteps.forEach(step => {
            let element;
            switch (step.type) {
                case 'text':
                    element = document.createElement('p');
                    element.textContent = step.content;
                    break;
                case 'image':
                    element = document.createElement('img');
                    element.src = step.url;
                    element.alt = step.caption || 'Learning Image';
                    // Add some basic styling for responsiveness
                    element.style.maxWidth = '100%';
                    element.style.height = 'auto';
                    element.style.borderRadius = '8px';
                    break;
                case 'video':
                    // Create a responsive container for video embeds
                    element = document.createElement('div');
                    element.className = 'video-container';
                    element.innerHTML = `<iframe src="${step.url}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
                    break;
                default:
                    console.warn(`Unknown learn content type: ${step.type}`);
                    // Create a fallback element for unknown types
                    element = document.createElement('p');
                    element.textContent = `Unsupported content type: ${step.type}`;
            }

            if (element) {
                learnContentContainer.appendChild(element);
            }
        });
    }

    async renderPlayPhase() {
        if (!this.currentMission) {
            console.error("No mission selected to play.");
            this.handlePhaseTransition('missionSelect'); // Go back to mission select
            return;
        }

        // If a game instance already exists, destroy it first
        if (this.phaserGame) {
            this.phaserGame.destroy(true);
            this.phaserGame = null;
        }

        // Configuration for the new Phaser game instance
        const gameConfig = {
            type: Phaser.AUTO,
            parent: 'play-view-container', // Target the div from index.html
            width: 800,
            height: 600,
            backgroundColor: '#000000',
            // Dynamically select the scene based on the mission's game ID
            scene: this.getSceneForGame(this.currentMission.gameId)
        };

        // Create the new Phaser game instance
        console.log(`Starting game: ${this.currentMission.gameId}`);
        this.phaserGame = new Phaser.Game(gameConfig);
    }

    getSceneForGame(gameId) {
        // This function maps a gameId from missions.json to the corresponding Phaser scene class.
        // IMPORTANT: Assumes scene classes are available in the global scope (e.g., TreasureHuntScene, QuizScene)
        // We will need to define these scenes in their respective files.
        switch (gameId) {
            case 'treasureHunt':
                return TreasureHuntScene; // Example scene class
            case 'interactiveQuiz':
                return InteractiveQuizScene; // Example scene class
            case 'matchingPairs':
                return MatchingPairsScene; // Example scene class
            case 'simulationGame':
                return SimulationGameScene; // Example scene class
            case 'wordPuzzle':
                return WordPuzzleScene; // Example scene class
            default:
                console.error(`No scene found for gameId: ${gameId}`);
                // Return a default or error scene if you have one
                return null;
        }
    }

    renderConquerPhase() {
        if (!this.currentMission) {
            console.error("Cannot render Conquer phase: no mission selected.");
            this.handlePhaseTransition('missionSelect');
            return;
        }

        const quizContentContainer = document.getElementById('quiz-content');
        const quizTitle = document.getElementById('quiz-title');

        // 1. Clear previous quiz and set title
        quizContentContainer.innerHTML = '';
        quizTitle.textContent = `${this.currentMission.title}: Conquer Quiz`;

        const questions = this.currentMission.conquer;

        if (!questions || questions.length === 0) {
            quizContentContainer.innerHTML = '<p>No quiz is available for this mission.</p>';
            // Maybe auto-complete the mission here or show a different button
            return;
        }

        // 2. Generate the quiz form dynamically
        const form = document.createElement('form');
        form.id = 'quiz-form';

        questions.forEach((question, qIndex) => {
            const questionElement = document.createElement('div');
            questionElement.className = 'quiz-question';
            questionElement.innerHTML = `<p><strong>${qIndex + 1}. ${question.question}</strong></p>`;

            const optionsList = document.createElement('div');
            optionsList.className = 'quiz-options';

            question.options.forEach((option, oIndex) => {
                const optionElement = document.createElement('div');
                optionElement.innerHTML = `
                    <input type="radio" id="q${qIndex}_o${oIndex}" name="question${qIndex}" value="${oIndex}">
                    <label for="q${qIndex}_o${oIndex}">${option}</label>
                `;
                optionsList.appendChild(optionElement);
            });

            questionElement.appendChild(optionsList);
            form.appendChild(questionElement);
        });

        quizContentContainer.appendChild(form);
    }

    submitQuiz() {
        if (!this.currentMission) return;

        const questions = this.currentMission.conquer;
        const form = document.getElementById('quiz-form');
        let score = 0;
        let correctAnswers = 0;

        questions.forEach((question, qIndex) => {
            const selectedOption = form.querySelector(`input[name="question${qIndex}"]:checked`);
            if (selectedOption && parseInt(selectedOption.value) === question.correctAnswer) {
                correctAnswers++;
            }
        });

        // Calculate score as a percentage
        score = Math.round((correctAnswers / questions.length) * 100);

        alert(`Quiz Complete!\nYour score: ${score}%`);

        // Save the final mission result
        if (typeof gameProgress !== 'undefined' && gameProgress.completeMission) {
            gameProgress.completeMission(this.currentMission.id, score);
            console.log(`Mission ${this.currentMission.id} completed with score ${score}.`);
        }

        // Check for any new achievements
        if (typeof achievements !== 'undefined' && achievements.checkGameCompletion) {
            // We can pass null for timeSpent if not tracked in the quiz
            achievements.checkGameCompletion(this.currentMission.id, score, null);
        }

        // Transition back to the mission selection screen
        this.handlePhaseTransition('missionSelect');
    }

    async renderLeaderboard() {
        const tbody = document.getElementById('leaderboard-tbody');
        tbody.innerHTML = '<tr><td colspan="3">Loading...</td></tr>'; // Show loading state

        const topStudents = await this.leaderboard.getTopStudents();

        if (topStudents.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3">No data available yet. Keep playing!</td></tr>';
            return;
        }

        tbody.innerHTML = ''; // Clear loading/previous state

        topStudents.forEach((student, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${student.name}</td>
                <td>${student.xp}</td>
            `;
            tbody.appendChild(row);
        });
    }

    showAchievementsModal() {
        if (!this.modal) return;

        const achievementsListContainer = document.getElementById('achievements-list');
        achievementsListContainer.innerHTML = ''; // Clear previous content

        // Assuming 'achievements' is a global instance of the Achievements class
        if (typeof achievements === 'undefined') {
            console.error("Achievements system not found.");
            achievementsListContainer.innerHTML = '<p>Could not load achievements.</p>';
            this.modal.style.display = 'flex';
            return;
        }

        const allAchievements = achievements.achievementsList;
        const unlockedIds = achievements.unlockedAchievements;

        for (const id in allAchievements) {
            const achievement = allAchievements[id];
            const isUnlocked = unlockedIds.has(id);

            const item = document.createElement('div');
            item.className = 'achievement-item';
            if (isUnlocked) {
                item.classList.add('unlocked');
            }

            item.innerHTML = `
                <img src="${achievement.icon || 'assets/ui/default-badge.png'}" alt="${achievement.title}">
                <h4>${achievement.title}</h4>
                <p>${achievement.description}</p>
            `;
            
            // Add a tooltip for locked achievements
            if (!isUnlocked) {
                item.title = "Keep playing to unlock this badge!";
            }

            achievementsListContainer.appendChild(item);
        }

        this.modal.style.display = 'flex';
    }

    hideAchievementsModal() {
        if (this.modal) {
            this.modal.style.display = 'none';
        }
    }

    updateNavigationButtons() {
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');

        if (this.currentPhase === 'learn') {
            const totalContent = this.currentMission.phases.learn.content.length;
            prevBtn.disabled = this.currentContent === 0;
            nextBtn.disabled = this.currentContent === totalContent - 1;
        } else {
            prevBtn.disabled = true;
            nextBtn.disabled = true;
        }
    }

    updateProgressDisplay() {
        if (!this.currentMission) return;

        const progress = gameProgress.getGameStatus(this.currentMission.id);
        const xpProgress = achievements.getXPProgress();

        // Update XP bar
        const xpBar = document.querySelector('.xp-progress');
        const levelIndicator = document.querySelector('.level-indicator');
        
        xpBar.style.width = `${xpProgress.progress}%`;
        levelIndicator.textContent = `Level ${achievements.getCurrentLevel()}`;

        // Update phase indicators
        document.querySelectorAll('.phase').forEach(phase => {
            const phaseType = phase.dataset.phase;
            const isCompleted = progress && progress[`${phaseType}PhaseCompleted`];
            phase.classList.toggle('completed', isCompleted);
        });

        // Update progress dots
        const progressIndicator = document.querySelector('.progress-indicator');
        if (this.currentPhase === 'learn') {
            const totalContent = this.currentMission.phases.learn.content.length;
            progressIndicator.innerHTML = Array(totalContent).fill(0)
                .map((_, i) => `
                    <div class="progress-dot ${i <= this.currentContent ? 'completed' : ''}"></div>
                `).join('');
        }
    }

    navigateContent(direction) {
        if (this.currentPhase !== 'learn') return;

        const totalContent = this.currentMission.phases.learn.content.length;
        const newContent = this.currentContent + direction;

        if (newContent >= 0 && newContent < totalContent) {
            this.currentContent = newContent;
            this.renderLearnPhase();
        }
    }

    async selectMission(missionId) {
        const subject = document.getElementById('subject-select').value;
        const mission = this.missions.subjects[subject].missions
            .find(m => m.id === missionId);

        if (!mission) return;

        // Check if mission is unlocked
        const isUnlocked = await this.checkMissionUnlock(mission);
        if (!isUnlocked) {
            this.showError('Complete the prerequisite mission first to unlock this content.');
            return;
        }

        this.currentMission = mission;
        this.currentContent = await this.getLastViewedContent(missionId) || 0;
        
        // Record mission access
        await this.recordMissionAccess(missionId);
        
        await this.handlePhaseTransition('learn');
    }

    async checkMissionUnlock(mission) {
        if (!mission.prerequisite) return true;

        try {
            // Check local progress first
            const localProgress = await this.getOfflineProgress(mission.prerequisite);
            if (localProgress && this.isMissionCompleted(localProgress)) {
                return true;
            }

            // Check online progress if available
            if (window.navigator.onLine && this.student?.id) {
                const db = firebase.firestore();
                const prereqDoc = await db.collection('studentProgress')
                    .doc(this.student.id)
                    .collection('missions')
                    .doc(mission.prerequisite)
                    .get();

                if (prereqDoc.exists && this.isMissionCompleted(prereqDoc.data())) {
                    // Cache the result
                    await this.saveProgressOffline({
                        missionId: mission.prerequisite,
                        ...prereqDoc.data()
                    });
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.error('Error checking mission unlock:', error);
            // Default to local progress check on error
            const localProgress = await this.getOfflineProgress(mission.prerequisite);
            return localProgress ? this.isMissionCompleted(localProgress) : false;
        }
    }

    async getOfflineProgress(missionId) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('StudentDashboard', 1);
            
            request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction(['progress'], 'readonly');
                const store = transaction.objectStore('progress');
                
                // Get all progress entries for this mission
                const index = store.index('missionId');
                const query = index.getAll(missionId);
                
                query.onsuccess = () => {
                    const progress = query.result;
                    if (progress && progress.length > 0) {
                        // Combine all progress data for the mission
                        const missionProgress = this.aggregateMissionProgress(progress);
                        resolve(missionProgress);
                    } else {
                        resolve(null);
                    }
                };
                
                query.onerror = () => resolve(null);
            };
            
            request.onerror = () => resolve(null);
        });
    }

    aggregateMissionProgress(progressEntries) {
        // Sort by timestamp to get the latest entries
        progressEntries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Aggregate progress for each phase
        const progress = {
            missionId: progressEntries[0].missionId,
            learn: { completed: false, progress: 0 },
            play: { completed: false, score: 0 },
            conquer: { completed: false, score: 0 },
            lastAccessed: progressEntries[0].timestamp
        };

        progressEntries.forEach(entry => {
            switch (entry.phase) {
                case 'learn':
                    if (!progress.learn.completed) {
                        progress.learn.progress = Math.max(progress.learn.progress, 
                            entry.completedContent / this.currentMission.phases.learn.content.length);
                        progress.learn.completed = progress.learn.progress >= 1;
                    }
                    break;
                case 'play':
                    if (!progress.play.completed) {
                        progress.play.score = Math.max(progress.play.score, entry.score || 0);
                        progress.play.completed = progress.play.score >= this.currentMission.phases.play.config.minScore;
                    }
                    break;
                case 'conquer':
                    if (!progress.conquer.completed) {
                        progress.conquer.score = Math.max(progress.conquer.score, entry.score || 0);
                        progress.conquer.completed = progress.conquer.score >= this.currentMission.phases.conquer.passingScore;
                    }
                    break;
            }
        });

        return progress;
    }

    isMissionCompleted(progress) {
        return progress.learn.completed && 
               progress.play.completed && 
               progress.conquer.completed;
    }

    async recordMissionAccess(missionId) {
        const accessRecord = {
            missionId,
            timestamp: new Date().toISOString(),
            deviceId: this.getDeviceId()
        };

        // Save locally
        await this.saveProgressOffline({
            ...accessRecord,
            type: 'access'
        });

        // Add to sync queue
        this.syncQueue.push({
            type: 'access',
            data: accessRecord,
            timestamp: accessRecord.timestamp
        });
        localStorage.setItem('syncQueue', JSON.stringify(this.syncQueue));

        // Try to sync if online
        if (window.navigator.onLine) {
            await this.syncProgress();
        }
    }

    async getLastViewedContent(missionId) {
        try {
            const progress = await this.getOfflineProgress(missionId);
            if (progress && progress.learn) {
                return Math.floor(progress.learn.progress * 
                    this.currentMission.phases.learn.content.length);
            }
            return 0;
        } catch (error) {
            console.warn('Error getting last viewed content:', error);
            return 0;
        }
    }

    async handleOnlineStatus() {
        const isOnline = window.navigator.onLine;
        
        // Update UI to show connection status
        this.updateConnectionStatus(isOnline);
        
        if (isOnline && this.syncQueue.length > 0) {
            await this.syncProgress();
        }
    }

    updateConnectionStatus(isOnline) {
        const statusElement = document.querySelector('.connection-status');
        if (!statusElement) {
            const status = document.createElement('div');
            status.className = 'connection-status';
            this.container.appendChild(status);
        }
        
        statusElement.textContent = isOnline ? 'Online' : 'Offline';
        statusElement.className = `connection-status ${isOnline ? 'online' : 'offline'}`;
    }

    initPeriodicSync() {
        // Register periodic sync if supported
        if ('serviceWorker' in navigator && 'periodicSync' in navigator.serviceWorker) {
            navigator.serviceWorker.ready.then(async (registration) => {
                try {
                    await registration.periodicSync.register('sync-progress', {
                        minInterval: 60 * 60 * 1000 // Sync every hour
                    });
                } catch (error) {
                    console.warn('Periodic sync could not be registered:', error);
                }
            });
        }

        // Fallback for browsers that don't support periodic sync
        setInterval(() => {
            if (window.navigator.onLine && this.syncQueue.length > 0) {
                this.syncProgress();
            }
        }, 5 * 60 * 1000); // Check every 5 minutes
    }

    async resolveConflicts(localProgress, serverProgress) {
        // Compare timestamps and device IDs
        const isLocalNewer = new Date(localProgress.timestamp) > new Date(serverProgress.timestamp);
        const isLocalDevice = localProgress.deviceId === this.getDeviceId();

        if (isLocalDevice && isLocalNewer) {
            // Local changes are newer and from this device, keep local
            return localProgress;
        } else if (!isLocalDevice && !isLocalNewer) {
            // Server changes are newer and from another device, keep server
            return serverProgress;
        } else {
            // Merge the progress
            return {
                ...serverProgress,
                score: Math.max(localProgress.score || 0, serverProgress.score || 0),
                completedContent: Math.max(
                    localProgress.completedContent || 0,
                    serverProgress.completedContent || 0
                ),
                timestamp: new Date().toISOString(),
                deviceId: this.getDeviceId(),
                mergeVersion: (serverProgress.mergeVersion || 0) + 1
            };
        }
    }

    async handleSyncError(error) {
        console.error('Sync error:', error);
        
        // Increment retry count
        const retryCount = parseInt(localStorage.getItem('syncRetryCount') || '0');
        localStorage.setItem('syncRetryCount', (retryCount + 1).toString());
        
        // If too many retries, notify user
        if (retryCount >= 5) {
            this.showError('Having trouble syncing your progress. Please check your connection.');
            localStorage.setItem('syncRetryCount', '0');
        }
        
        // Schedule retry with exponential backoff
        setTimeout(() => this.syncProgress(), this.getNextRetryDelay());
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        this.container.appendChild(errorDiv);
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
}

// Export the StudentDashboard class
export { StudentDashboard };
}

// Create global instance
const studentDashboard = new StudentDashboard();