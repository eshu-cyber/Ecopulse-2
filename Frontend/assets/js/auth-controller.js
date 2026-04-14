import { auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const exportBtn = document.getElementById('exportBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const profileEmail = document.querySelector('#profileMenu p.truncate');
    const profileBtn = document.getElementById('profileBtn');

    // Initial state: Disable export button if it exists
    if (exportBtn) {
        exportBtn.disabled = true;
        exportBtn.classList.add('opacity-50', 'cursor-not-allowed');
        exportBtn.title = "Please login to export data";
    }

    // Monitor Auth State
    onAuthStateChanged(auth, (user) => {
        const isLoginPage = window.location.pathname.endsWith('login.html');

        if (user) {
            console.log('User authenticated:', user.email);
            
            // If on login page, redirect to dashboard
            if (isLoginPage) {
                window.location.href = 'index.html';
                return;
            }

            // Enable export button
            if (exportBtn) {
                exportBtn.disabled = false;
                exportBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                exportBtn.title = "Export data to CSV";
            }

            // Update Profile UI
            if (profileEmail) {
                profileEmail.textContent = user.email;
            }
            if (profileBtn) {
                profileBtn.style.display = 'flex';
            }

        } else {
            console.log('User not authenticated');
            
            // If NOT on login page, redirect to login
            if (!isLoginPage) {
                window.location.href = 'login.html';
            }
        }
    });

    // Handle Logout
    if (logoutBtn) {
        logoutBtn.onclick = async (e) => {
            e.preventDefault();
            try {
                await signOut(auth);
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Logout failed:', error);
            }
        };
    }
});
