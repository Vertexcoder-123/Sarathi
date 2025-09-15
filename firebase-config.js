// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js';
import { getFirestore, enableIndexedDbPersistence } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Enable offline persistence
enableIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a time.
      console.log('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code == 'unimplemented') {
      // The current browser does not support persistence
      console.log('The current browser does not support persistence');
    }
  });

// Database operations
export const dbOperations = {
  // Save student progress
  saveProgress: async (studentId, gameId, score) => {
    try {
      await db.collection('progress').doc(studentId).set({
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
      const doc = await db.collection('progress').doc(studentId).get();
      return doc.exists ? doc.data() : null;
    } catch (error) {
      console.error("Error getting progress:", error);
      return null;
    }
  },

  // Get class performance data
  getClassPerformance: async (classId) => {
    try {
      const snapshot = await db.collection('progress')
        .where('classId', '==', classId)
        .get();
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