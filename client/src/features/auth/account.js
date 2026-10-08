import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
    auth,
    db,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    updateProfile,
    doc,
    setDoc,
} from "../../firebase";
import { isEmailAllowed } from "../../data/allowedEmails";
import { checkRushAppAccess } from "./checkRushAppAccess";
import { createAccountWithServices } from "./createAccountWithServices";
import { resetErrorMessage } from "./errorMessages";
import { loginWithServices } from "./loginWithServices";
import { logoutWithServices } from "./logoutWithServices";
import { resetPasswordWithServices } from "./resetPasswordWithServices";

/**
 * Sign in with email and password
 * Checks if the Rush App is disabled for this user before allowing access
 */
export async function login(credentials) {
    return loginWithServices(credentials, {
        auth,
        signInWithEmailAndPassword,
        signOut,
        checkRushAppAccess,
        // Read the configured API base URL for the login access check.
        getApiPrefix: () => import.meta.env.VITE_API_PREFIX,
        // Read the shared API key for the login access check.
        getApiKey: () => import.meta.env.VITE_API_KEY,
        // Send access-check requests through the browser fetch API.
        fetchRequest: (...args) => fetch(...args),
        // Persist the authenticated user in browser storage.
        storeUser: (...args) => localStorage.setItem(...args),
        // Remove the locally stored user after access is denied.
        removeStoredUser: () => localStorage.removeItem('user'),
        toast,
        logger: console,
    });
}

/**
 * Create a new account
 * Only emails in the allowed list can create accounts
 * Also creates a user document in Firestore
 */
export async function createAccount(credentials) {
    return createAccountWithServices(credentials, {
        isEmailAllowed,
        auth,
        createUserWithEmailAndPassword,
        updateProfile,
        db,
        doc,
        setDoc,
        // Persist the newly created user in browser storage.
        storeUser: (...args) => localStorage.setItem(...args),
        toast,
        logger: console,
    });
}

// Send a password-reset email using the configured Firebase and notification services.
export function resetPassword(email) {
    return resetPasswordWithServices(email, {
        auth,
        sendPasswordResetEmail,
        toast,
        resetErrorMessage,
        logger: console,
    });
}

// Sign out through Firebase and clear the local user after success.
export function logout() {
    return logoutWithServices({
        auth,
        signOut,
        // Remove the local user after Firebase sign-out succeeds.
        removeStoredUser: () => localStorage.removeItem('user'),
        logger: console,
    });
}

/**
 * Get current user from localStorage
 */
export function getCurrentUser() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
        return JSON.parse(userStr);
    }
    return null;
}
