/**
 * auth.js
 * This script manages all user authentication with Firebase, including
 * email/password sign-up, email/password login, and Google Sign-In.
 * Using Firebase v9+ modular SDK.
 */

import { 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    GoogleAuthProvider,
    signInWithPopup,
    onAuthStateChanged 
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase-config.js';

/**
 * Signs up a new user with their full name, email, and password.
 * @param {string} fullName The user's full name.
 * @param {string} email The user's email address.
 * @param {string} password The user's chosen password.
 * @returns {Promise<object>} A promise that resolves with the user credential on success.
 */
async function signUpWithEmail(fullName, email, password, role) {
    try {
        // Step 1: Create the user in Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        console.log("User created in Firebase Auth:", user.uid);

        // Step 2: Create the user document in the 'users' collection in Firestore
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
            fullName: fullName,
            email: user.email,
            role: role, // Use the role from the form
            createdAt: serverTimestamp()
        });

        console.log("User document created in Firestore with role:", role);

        // After sign-up, the user is automatically logged in. Handle the redirection.
        await handleSuccessfulLogin(user);

        return userCredential;
    } catch (error) {
        console.error("Error during sign-up:", error);
        // Re-throw the error so the UI can catch it and display a message
        throw error;
    }
}

/**
 * Logs in an existing user with their email and password.
 * @param {string} email The user's email address.
 * @param {string} password The user's password.
 * @returns {Promise<object>} A promise that resolves with the user credential on success.
 */
async function loginWithEmail(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log("User logged in:", userCredential.user.uid);
        
        // After any successful login, handle the user's profile and redirection
        await handleSuccessfulLogin(userCredential.user);

        return userCredential;
    } catch (error) {
        console.error("Error during login:", error);
        throw error;
    }
}

/**
 * Initiates the Google Sign-In process using a popup window.
 * @returns {Promise<object>} A promise that resolves with the user credential on success.
 */
async function signInWithGoogle() {
    try {
        const provider = new GoogleAuthProvider();
        const userCredential = await signInWithPopup(auth, provider);
        const user = userCredential.user;

        // Let handleSuccessfulLogin handle all redirection logic
        await handleSuccessfulLogin(user);
        
        return userCredential;
    } catch (error) {
        console.error("Error during Google sign-in:", error);
        throw error;
    }
}

/**
 * Signs out the currently authenticated user.
 * @returns {Promise<void>}
 */
async function signOutUser() {
    try {
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (error) {
        console.error("Error signing out:", error);
        throw error;
    }
}

/**
 * Handles the post-login logic for any sign-in method.
 * @param {object} user The authenticated user object from Firebase.
 */
async function handleSuccessfulLogin(user) {
    if (!user) return;

    try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        let userProfile;

        // 1. Check if the user document exists
        if (!userDoc.exists()) {
            console.log(`User document for ${user.uid} not found. Creating one.`);
            // This case is primarily for users signing in for the first time with Google
            userProfile = {
                fullName: user.displayName || 'New User',
                email: user.email,
                role: 'unassigned', // Set role to 'unassigned' for new Google users
                createdAt: serverTimestamp()
            };
            await setDoc(userDocRef, userProfile);
            // Redirect to role selection page using absolute path
            window.location.href = '../role_selection.html';
            return; // Stop further execution
        } else {
            userProfile = userDoc.data();
        }

        console.log(`User role is: ${userProfile.role}`);

        // 2. Handle unassigned roles
        if (userProfile.role === 'unassigned') {
            window.location.href = '../role_selection.html';
            return;
        }

        // 3. Read the role and 4. Redirect accordingly
        console.log('Attempting to redirect based on role:', userProfile.role);
        if (userProfile.role === 'teacher') {
            console.log('Redirecting to teacher dashboard...');
            window.location.href = '../teacher.html';
        } else {
            console.log('Redirecting to student dashboard...');
            window.location.href = '../student.html';
        }
    } catch (error) {
        console.error("Error handling login:", error);
        // Log more details about the error
        console.error("Error details:", {
            errorName: error.name,
            errorMessage: error.message,
            errorStack: error.stack
        });
        throw error;
    }
}

// Add auth state change listener
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log('User is signed in:', user.uid);
    } else {
        console.log('User is signed out');
    }
});

// Export the authentication functions
export {
    signUpWithEmail,
    loginWithEmail,
    signInWithGoogle,
    signOutUser,
    handleSuccessfulLogin
};