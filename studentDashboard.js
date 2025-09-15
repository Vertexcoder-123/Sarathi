class StudentDashboard {
    constructor() {
        this.missions = null;
        this.currentMission = null;
        this.currentPhase = null; // 'learn', 'play', 'conquer'
        this.currentContent = 0;
        this.student = null;
        this.container = document.getElementById('dashboard-container');
        this.syncQueue = [];
        this.syncInProgress = false;
        this.lastSyncTime = null;
        
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

    async init(studentId) {
        try {
            // Initialize student data
            await gameProgress.initializeStudent(studentId);
            this.student = {
                id: studentId,
                progress: gameProgress.getAllGameStatus()
            };

            // Load missions
            await this.loadMissions();
            
            // Initialize dashboard UI
            this.createDashboardStructure();
            this.renderMissionSelect();

            // Set up event listeners for navigation
            this.setupEventListeners();
            
            // Update progress visualization
            this.updateProgressDisplay();
        } catch (error) {
            console.error('Failed to initialize dashboard:', error);
            this.showError('Failed to load dashboard. Please try again.');
        }
    }

    async loadMissions() {
        try {
            // Initialize sync queue if not exists
            this.syncQueue = JSON.parse(localStorage.getItem('syncQueue') || '[]');
            
            // Try loading from Firebase first
            if (window.navigator.onLine) {
                const db = firebase.firestore();
                
                // Enable offline persistence
                await db.enablePersistence()
                    .catch((err) => {
                        if (err.code == 'failed-precondition') {
                            console.warn('Multiple tabs open, offline persistence disabled');
                        } else if (err.code == 'unimplemented') {
                            console.warn('Browser doesn\'t support offline persistence');
                        }
                    });

                // Load missions with metadata
                const missionsDoc = await db.collection('missions').doc('current').get();
                if (missionsDoc.exists) {
                    this.missions = missionsDoc.data();
                    
                    // Store missions in IndexedDB for offline access
                    await this.storeMissionsOffline(this.missions);
                    
                    // Load student-specific mission states
                    if (this.student?.id) {
                        const studentMissionsDoc = await db.collection('studentMissions')
                            .doc(this.student.id)
                            .get();
                            
                        if (studentMissionsDoc.exists) {
                            const studentMissions = studentMissionsDoc.data();
                            this.mergeMissionStates(studentMissions);
                        }
                    }
                    return;
                }
            }

            // Try loading from IndexedDB
            const offlineMissions = await this.loadMissionsOffline();
            if (offlineMissions) {
                this.missions = offlineMissions;
                return;
            }

            // Final fallback to local missions.json
            const response = await fetch('missions.json');
            this.missions = await response.json();
            await this.storeMissionsOffline(this.missions);
        } catch (error) {
            console.error('Failed to load missions:', error);
            throw new Error('Could not load mission data');
        }
    }

    async storeMissionsOffline(missions) {
        try {
            const request = indexedDB.open('StudentDashboard', 1);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('missions')) {
                    db.createObjectStore('missions');
                }
                if (!db.objectStoreNames.contains('progress')) {
                    db.createObjectStore('progress');
                }
            };

            request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction(['missions'], 'readwrite');
                const store = transaction.objectStore('missions');
                store.put(missions, 'current');
            };
        } catch (error) {
            console.warn('Failed to store missions offline:', error);
        }
    }

    async loadMissionsOffline() {
        return new Promise((resolve, reject) => {
            try {
                const request = indexedDB.open('StudentDashboard', 1);
                
                request.onsuccess = (event) => {
                    const db = event.target.result;
                    const transaction = db.transaction(['missions'], 'readonly');
                    const store = transaction.objectStore('missions');
                    const getRequest = store.get('current');
                    
                    getRequest.onsuccess = () => {
                        resolve(getRequest.result);
                    };
                    
                    getRequest.onerror = () => {
                        resolve(null);
                    };
                };
                
                request.onerror = () => {
                    resolve(null);
                };
            } catch (error) {
                console.warn('Failed to load missions from offline storage:', error);
                resolve(null);
            }
        });
    }

    mergeMissionStates(studentMissions) {
        // Merge student-specific mission states with main mission data
        Object.keys(this.missions.subjects).forEach(subjectKey => {
            const subject = this.missions.subjects[subjectKey];
            subject.missions.forEach(mission => {
                if (studentMissions[mission.id]) {
                    mission.state = studentMissions[mission.id];
                    mission.lastAccessed = studentMissions[mission.id].lastAccessed;
                }
            });
        });
    }

    createDashboardStructure() {
        this.container.innerHTML = `
            <div class="dashboard-layout">
                <header class="dashboard-header">
                    <div class="student-info">
                        <span class="student-name"></span>
                        <div class="xp-display">
                            <div class="xp-bar">
                                <div class="xp-progress"></div>
                            </div>
                            <span class="level-indicator"></span>
                        </div>
                    </div>
                    <div class="phase-indicator">
                        <div class="phase learn" data-phase="learn">Learn</div>
                        <div class="phase play" data-phase="play">Play</div>
                        <div class="phase conquer" data-phase="conquer">Conquer</div>
                    </div>
                </header>
                
                <nav class="subject-nav">
                    <select id="subject-select">
                        <option value="">Select Subject</option>
                    </select>
                </nav>

                <main class="content-area">
                    <div id="mission-select" class="panel"></div>
                    <div id="content-display" class="panel"></div>
                    <div id="game-container" class="panel"></div>
                    <div id="quiz-container" class="panel"></div>
                </main>

                <footer class="dashboard-footer">
                    <button id="prev-btn" class="nav-btn">Previous</button>
                    <div class="progress-indicator"></div>
                    <button id="next-btn" class="nav-btn">Next</button>
                </footer>
            </div>
        `;

        // Add dashboard styles
        const style = document.createElement('style');
        style.textContent = `
            .dashboard-layout {
                display: flex;
                flex-direction: column;
                height: 100vh;
                background: #f5f5f5;
            }

            .dashboard-header {
                background: #2c3e50;
                color: white;
                padding: 1rem;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .phase-indicator {
                display: flex;
                gap: 1rem;
            }

            .phase {
                padding: 0.5rem 1rem;
                border-radius: 20px;
                background: #34495e;
                opacity: 0.7;
                cursor: pointer;
                transition: all 0.3s ease;
            }

            .phase.active {
                opacity: 1;
                background: #27ae60;
            }

            .subject-nav {
                padding: 1rem;
                background: #34495e;
            }

            #subject-select {
                width: 200px;
                padding: 0.5rem;
                border-radius: 5px;
            }

            .content-area {
                flex: 1;
                padding: 2rem;
                overflow-y: auto;
            }

            .panel {
                display: none;
                background: white;
                border-radius: 10px;
                padding: 2rem;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }

            .panel.active {
                display: block;
            }

            .mission-card {
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 1rem;
                margin-bottom: 1rem;
                cursor: pointer;
                transition: all 0.3s ease;
            }

            .mission-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            }

            .mission-card.locked {
                opacity: 0.7;
                background: #f8f9fa;
                cursor: not-allowed;
            }

            .dashboard-footer {
                padding: 1rem;
                background: #2c3e50;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .nav-btn {
                padding: 0.5rem 1rem;
                border: none;
                border-radius: 5px;
                background: #27ae60;
                color: white;
                cursor: pointer;
            }

            .nav-btn:disabled {
                background: #95a5a6;
                cursor: not-allowed;
            }

            .progress-indicator {
                display: flex;
                gap: 0.5rem;
            }

            .progress-dot {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: #95a5a6;
            }

            .progress-dot.completed {
                background: #27ae60;
            }

            .xp-display {
                margin-top: 0.5rem;
            }

            .xp-bar {
                width: 200px;
                height: 8px;
                background: #34495e;
                border-radius: 4px;
                overflow: hidden;
            }

            .xp-progress {
                height: 100%;
                background: #27ae60;
                transition: width 0.3s ease;
            }

            .level-indicator {
                font-size: 0.8rem;
                color: #2ecc71;
            }
        `;
        document.head.appendChild(style);
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
        if (newPhase === this.currentPhase) return;

        // Save current phase progress
        if (this.currentPhase) {
            await this.savePhaseProgress();
        }

        // Update UI
        document.querySelectorAll('.phase').forEach(p => {
            p.classList.toggle('active', p.dataset.phase === newPhase);
        });

        // Hide all panels
        document.querySelectorAll('.panel').forEach(panel => {
            panel.classList.remove('active');
        });

        // Show appropriate panel and render content
        this.currentPhase = newPhase;
        switch (newPhase) {
            case 'learn':
                document.getElementById('content-display').classList.add('active');
                await this.renderLearnPhase();
                break;
            case 'play':
                document.getElementById('game-container').classList.add('active');
                await this.renderPlayPhase();
                break;
            case 'conquer':
                document.getElementById('quiz-container').classList.add('active');
                await this.renderConquerPhase();
                break;
        }

        this.updateProgressDisplay();
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

    async renderLearnPhase() {
        if (!this.currentMission) return;

        const container = document.getElementById('content-display');
        const content = this.currentMission.phases.learn.content[this.currentContent];

        let contentHtml = '';
        switch (content.type) {
            case 'text':
                contentHtml = `
                    <div class="text-content">
                        <h2>${content.title}</h2>
                        <p>${content.content}</p>
                    </div>
                `;
                break;

            case 'image':
                contentHtml = `
                    <div class="image-content">
                        <h2>${content.title}</h2>
                        <img src="${content.url}" alt="${content.title}">
                        ${content.caption ? `<p class="caption">${content.caption}</p>` : ''}
                    </div>
                `;
                break;

            case 'video':
                contentHtml = `
                    <div class="video-content">
                        <h2>${content.title}</h2>
                        <video controls>
                            <source src="${content.url}" type="video/mp4">
                            Your browser does not support the video tag.
                        </video>
                        ${content.duration ? `<span class="duration">${content.duration}</span>` : ''}
                    </div>
                `;
                break;

            case 'interactive':
                contentHtml = `
                    <div class="interactive-content">
                        <h2>${content.title}</h2>
                        <div id="interactive-container" data-type="${content.interactionType}">
                            ${content.description}
                        </div>
                    </div>
                `;
                // Initialize interactive content
                this.initializeInteractiveContent(content);
                break;
        }

        container.innerHTML = contentHtml;
        this.updateNavigationButtons();
    }

    async renderPlayPhase() {
        if (!this.currentMission) return;

        const container = document.getElementById('game-container');
        const gameConfig = this.currentMission.phases.play;

        // Initialize the game based on configuration
        const game = new Phaser.Game({
            type: Phaser.AUTO,
            parent: 'game-container',
            width: 800,
            height: 600,
            physics: {
                default: 'arcade',
                arcade: {
                    gravity: { y: 0 },
                    debug: false
                }
            },
            scene: [LoadingScene, gameConfig.gameId]
        });

        // Pass mission configuration to the game
        game.missionConfig = gameConfig.config;
    }

    async renderConquerPhase() {
        if (!this.currentMission) return;

        const container = document.getElementById('quiz-container');
        const quiz = this.currentMission.phases.conquer;

        container.innerHTML = `
            <div class="quiz-header">
                <h2>${quiz.quizTitle}</h2>
                <div class="quiz-meta">
                    <span>Passing Score: ${quiz.passingScore}%</span>
                    <span class="timer">Time Remaining: ${Math.floor(quiz.timeLimit / 60)}:00</span>
                </div>
            </div>
            <div class="questions-container">
                ${quiz.questions.map((q, index) => this.renderQuestion(q, index)).join('')}
            </div>
            <button id="submit-quiz" class="submit-btn">Submit Quiz</button>
        `;

        // Initialize quiz timer
        this.initializeQuizTimer(quiz.timeLimit);
        
        // Add event listener for quiz submission
        document.getElementById('submit-quiz').addEventListener('click', () => {
            this.submitQuiz();
        });
    }

    renderQuestion(question, index) {
        switch (question.type) {
            case 'mcq':
                return `
                    <div class="question mcq" data-question-id="${question.id}">
                        <p class="question-text">${index + 1}. ${question.question}</p>
                        <div class="options">
                            ${question.options.map((opt, i) => `
                                <label class="option">
                                    <input type="radio" name="q${question.id}" value="${i}">
                                    ${opt}
                                </label>
                            `).join('')}
                        </div>
                    </div>
                `;

            case 'matching':
                return `
                    <div class="question matching" data-question-id="${question.id}">
                        <p class="question-text">${index + 1}. ${question.question}</p>
                        <div class="matching-container">
                            <div class="items">
                                ${question.pairs.map(pair => `
                                    <div class="match-item" draggable="true" data-item="${pair.item}">
                                        ${pair.item}
                                    </div>
                                `).join('')}
                            </div>
                            <div class="matches">
                                ${question.pairs.map(pair => `
                                    <div class="match-slot" data-match="${pair.match}">
                                        ${pair.match}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `;

            default:
                return `
                    <div class="question" data-question-id="${question.id}">
                        <p class="question-text">${index + 1}. ${question.question}</p>
                        <p class="error">Unsupported question type</p>
                    </div>
                `;
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

// Create global instance
const studentDashboard = new StudentDashboard();