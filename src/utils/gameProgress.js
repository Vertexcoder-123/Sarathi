import { db } from '../config/firebase-config.js';
import { doc, getDoc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';

/**
 * gameProgress.js
 * Refactored to use IndexedDB for robust offline storage and a reliable sync queue.
 */
class GameProgress {
    constructor(studentId) {
        this.db = db; // Firestore instance
        this.localDB = null; // IndexedDB instance
        this.studentId = studentId;
        this.studentName = null;
        this.classId = null;
        this.lastSyncTime = null;
        this.pendingSync = [];

        // Define the game sequence and requirements
        this.gameSequence = [
            { id: 'TreasureHunt', name: 'Treasure Hunt', required: null, score: 0, attempts: 0 },
            { id: 'InteractiveQuiz', name: 'Interactive Quiz', required: 'TreasureHunt', score: 0, attempts: 0 },
            { id: 'MatchingPairs', name: 'Matching Pairs', required: 'InteractiveQuiz', score: 0, attempts: 0 },
            { id: 'SimulationGame', name: 'Virtual Circuit', required: 'MatchingPairs', score: 0, attempts: 0 },
            { id: 'WordPuzzle', name: 'Word Puzzle', required: 'SimulationGame', score: 0, attempts: 0 }
        ];
    }

    /**
     * Initializes the service, including opening the IndexedDB connection.
     * @param {string} studentId The ID of the current student.
     */
    async init(studentId) {
        this.studentId = studentId;
        this.localDB = await this.openIndexedDB();
        
        // Listen for online/offline events to trigger sync
        window.addEventListener('online', () => this.syncWithFirebase());
        
        // Initial sync attempt
        this.syncWithFirebase();
    }

    /**
     * Opens and sets up the IndexedDB database.
     * @returns {Promise<IDBDatabase>}
     */
    openIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('SARATHI_StudentProgress', 1);

            request.onerror = () => reject("Error opening IndexedDB.");

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                // 'progress' stores the latest state of each mission
                db.createObjectStore('progress', { keyPath: 'missionId' });
                // 'syncQueue' stores actions to be sent to Firebase
                db.createObjectStore('syncQueue', { autoIncrement: true });
            };

            request.onsuccess = (event) => resolve(event.target.result);
        });
    }

    /**
     * Saves a progress update. This is the main method to call after a game or quiz.
     * @param {string} missionId The ID of the mission.
     * @param {number} score The score achieved.
     * @param {string} phase The phase completed ('play', 'conquer').
     */
    async saveProgress(missionId, score, phase) {
        const progressData = {
            missionId,
            score,
            phase,
            timestamp: new Date().toISOString()
        };

        // 1. Save the latest state to the 'progress' store
        const progressTx = this.localDB.transaction('progress', 'readwrite');
        await progressTx.objectStore('progress').put(progressData);
        await progressTx.done;

        // 2. Add the action to the sync queue
        const syncTx = this.localDB.transaction('syncQueue', 'readwrite');
        await syncTx.objectStore('syncQueue').add(progressData);
        await syncTx.done;

        console.log(`Progress for mission ${missionId} saved locally.`);

        // 3. Attempt to sync immediately
        this.syncWithFirebase();
    }

    /**
     * Reads the sync queue from IndexedDB and sends the data to Firestore.
     */
    async syncWithFirebase() {
        if (!navigator.onLine || !this.studentId) {
            console.log("Sync skipped: App is offline or no student is logged in.");
            return;
        }

        const syncTx = this.localDB.transaction('syncQueue', 'readwrite');
        const syncStore = syncTx.objectStore('syncQueue');
        const itemsToSync = await syncStore.getAll();

        if (itemsToSync.length === 0) {
            console.log("Sync: No items to sync.");
            return;
        }

        try {
            const batch = writeBatch(db);
            const studentProgressRef = doc(db, 'studentProgress', this.studentId);

            itemsToSync.forEach(item => {
                // Here, you would structure the data as needed for Firestore.
                // For simplicity, we'll just update a field with the mission ID.
                batch.update(studentProgressRef, {
                    [`missions.${item.missionId}.score`]: item.score,
                    [`missions.${item.missionId}.lastPlayed`]: item.timestamp,
                });
            });

            await batch.commit();

            // Clear the sync queue in IndexedDB
            await syncStore.clear();
            console.log(`Sync successful: ${itemsToSync.length} items synced.`);

        } catch (error) {
            console.error("Error syncing with Firebase:", error);
        }
    }

    /**
     * Retrieves the progress for a specific mission from IndexedDB.
     * @param {string} missionId The ID of the mission.
     * @returns {Promise<Object|null>}
     */
    async getMissionProgress(missionId) {
        const tx = this.localDB.transaction('progress', 'readonly');
        const store = tx.objectStore('progress');
        return await store.get(missionId) || null;
    }

    /**
     * Retrieves the complete progress report for the student.
     * @returns {Promise<Array>}
     */
    async getProgressReport() {
        const tx = this.localDB.transaction('progress', 'readonly');
        const store = tx.objectStore('progress');
        const progress = await store.getAll();

        return this.gameSequence.map(game => {
            return { ...game, ...progress[game.id] };
        });
    }
}

export { GameProgress };