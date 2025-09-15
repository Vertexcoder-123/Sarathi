import { onAuthStateChanged } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const studentBtn = document.getElementById('student-btn');
    const teacherBtn = document.getElementById('teacher-btn');

    onAuthStateChanged(auth, (user) => {
        if (user) {
            studentBtn.onclick = () => updateUserRole(user, 'student');
            teacherBtn.onclick = () => updateUserRole(user, 'teacher');
        } else {
            // If no user is logged in, redirect to the login page
            window.location.href = 'index.html';
        }
    });
});

async function updateUserRole(user, role) {
    try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { role: role });

        // Redirect to the appropriate dashboard
        if (role === 'teacher') {
            window.location.href = 'teacher.html';
        } else {
            window.location.href = 'student.html';
        }
    } catch (error) {
        console.error("Error updating user role:", error);
    }
}
