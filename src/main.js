/**
 * main.js
 * This script serves as the main entry point for the student application.
 * Using Firebase v9+ modular SDK.
 */

import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './config/firebase-config.js';
import { StudentDashboard } from './components/studentDashboard.js';

document.addEventListener('DOMContentLoaded', () => {
    const loadingOverlay = document.getElementById('loading-overlay');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is signed in.
            console.log("Authenticated user found. Verifying role...");
            
            const userRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists() && userDoc.data().role === 'student') {
                // Role is correct, initialize the dashboard.
                console.log("Student role confirmed. Initializing dashboard...");
                await initializeApp(user);
                loadingOverlay.style.display = 'none'; // Hide loading screen
            } else {
                // Role is not 'student' or document doesn't exist.
                console.error("Access Denied: User is not a student. Redirecting to login.");
                window.location.href = 'student_login.html';
            }
        } else {
            // User is not signed in. Redirect to the login page.
            console.log("No authenticated user found. Redirecting to login.");
            window.location.href = 'student_login.html';
        }
    });
});

/**
 * Initializes the main application logic after security checks have passed.
 * @param {object} user The authenticated user object.
 */
async function initializeApp(user) {
    console.log("Initializing SARATHI platform...");

    try {
        // Create a new instance of the StudentDashboard
        const studentDashboard = new StudentDashboard(user.uid);

        // Initialize the dashboard UI
        await studentDashboard.init();

        console.log("Student Dashboard has been initialized.");

    } catch (error) {
        console.error("Application Initialization Failed:", error);
        // Display a user-friendly error message on the screen
        document.body.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #D8000C; background-color: #FFD2D2;">
                <h1>Application Error</h1>
                <p>Could not start the learning platform. Please check the developer console for more details.</p>
                <p><strong>Error:</strong> ${error.message}</p>
            </div>
        `;
    }
}
