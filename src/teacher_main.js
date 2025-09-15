/**
 * teacher_main.js
 * This script serves as the main entry point for the Teacher Dashboard application.
 * Using Firebase v9+ modular SDK.
 */

import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './config/firebase-config.js';
import { TeacherDashboard } from './components/teacherDashboard.js';

document.addEventListener('DOMContentLoaded', () => {
    const loadingOverlay = document.getElementById('loading-overlay');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is signed in. Verify their role.
            console.log("Authenticated user found. Verifying teacher role...");
            
            const userRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists() && userDoc.data().role === 'teacher') {
                // Role is correct, initialize the dashboard.
                console.log("Teacher role confirmed. Initializing dashboard...");
                await initializeApp(user);
                loadingOverlay.style.display = 'none'; // Hide loading screen
            } else {
                // Role is not 'teacher' or document doesn't exist.
                console.error("Access Denied: User is not a teacher. Redirecting to login.");
                window.location.href = 'teacher_login.html';
            }
        } else {
            // User is not signed in. Redirect to the login page.
            console.log("No authenticated user found. Redirecting to login.");
            window.location.href = 'teacher_login.html';
        }
    });
});

/**
 * Initializes the main application logic after security checks have passed.
 * @param {object} user The authenticated user object.
 */
async function initializeApp(user) {
    console.log("Teacher Dashboard DOM fully loaded. Initializing...");

    try {
        // Create a new instance of the TeacherDashboard
        const teacherDashboard = new TeacherDashboard();

        // Initialize the dashboard to fetch data and render the initial view
        await teacherDashboard.init();
        console.log("Teacher Dashboard has been initialized.");

    } catch (error) {
        console.error("Teacher Dashboard Initialization Failed:", error);
        // Display a user-friendly error message on the screen
        document.body.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #D8000C; background-color: #FFD2D2;">
                <h1>Application Error</h1>
                <p>Could not start the teacher dashboard. Please check the developer console for more details.</p>
                <p><strong>Error:</strong> ${error.message}</p>
            </div>
        `;
    }
}
