/**
 * Firebase Configuration and Service Initialization
 * This module exports initialized Firebase services using the modular SDK v9+.
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
    getFirestore, 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    getDocs, 
    query, 
    where,
    enableIndexedDbPersistence 
} from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

// Firebase configuration object
const firebaseConfig = {
    apiKey: "AIzaSyCRRA-QUZxLqr3wq0szeN2AU_sTf-kAgXg",
    authDomain: "sarathi-learning-app.firebaseapp.com",
    projectId: "sarathi-learning-app",
    storageBucket: "sarathi-learning-app.firebasestorage.app",
    messagingSenderId: "281908900821",
    appId: "1:281908900821:web:5d0a8a98c0594644e7835c",
    measurementId: "G-RD2XREEQEV"
};

// Initialize Firebase services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);

// Enable offline persistence
enableIndexedDbPersistence(db)
    .catch((err) => {
        if (err.code === 'failed-precondition') {
            console.log('Multiple tabs open, persistence can only be enabled in one tab at a time.');
        } else if (err.code === 'unimplemented') {
            console.log('The current browser does not support persistence');
        }
    });

// Database operations using the modular API
export const dbOperations = {
    // Save student progress
    saveProgress: async (studentId, gameId, score) => {
        try {
            const progressRef = doc(db, 'progress', studentId);
            await setDoc(progressRef, {
                [gameId]: {
                    score: score,
                    timestamp: new Date()
                }
            }, { merge: true });
            return true;
        } catch (error) {
            console.error("Error saving progress:", error);
            return false;
        }
    },

    // Get student progress
    getProgress: async (studentId) => {
        try {
            const progressRef = doc(db, 'progress', studentId);
            const docSnap = await getDoc(progressRef);
            return docSnap.exists() ? docSnap.data() : null;
        } catch (error) {
            console.error("Error getting progress:", error);
            return null;
        }
    },

    // Get class performance data
    getClassPerformance: async (classId) => {
        try {
            const progressRef = collection(db, 'progress');
            const q = query(progressRef, where('classId', '==', classId));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                studentId: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error("Error getting class performance:", error);
            return [];
        }
    }
};

// Export initialized services
export { auth, db, analytics };