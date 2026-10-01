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
        getApiPrefix: () => import.meta.env.VITE_API_PREFIX,
        getApiKey: () => import.meta.env.VITE_API_KEY,
        fetchRequest: (...args) => fetch(...args),
        storeUser: (...args) => localStorage.setItem(...args),
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
        storeUser: (...args) => localStorage.setItem(...args),
        toast,
        logger: console,
    });
}

export function resetPassword(email) {
    return resetPasswordWithServices(email, {
        auth,
        sendPasswordResetEmail,
        toast,
        resetErrorMessage,
        logger: console,
    });
}

/**
 * Sign out
 */
export async function logout() {
    try {
        await signOut(auth);
        localStorage.removeItem('user');
        return true;
    } catch (error) {
        console.error("Logout error:", error);
        return false;
    }
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
