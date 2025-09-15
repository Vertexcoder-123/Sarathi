import { loginWithEmail } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const errorMessageContainer = document.getElementById('error-message');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        errorMessageContainer.textContent = '';

        try {
            await loginWithEmail(email, password);
            // The redirection is handled by handleSuccessfulLogin inside loginWithEmail
        } catch (error) {
            console.error("Teacher login error:", error);
            errorMessageContainer.textContent = 'Invalid email or password.';
        }
    });
});
