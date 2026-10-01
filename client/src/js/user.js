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
    getDocs,
    collection,
    query,
    orderBy
} from "../firebase";
import { isEmailAllowed } from "../data/allowedEmails";
import { resetErrorMessage } from "../features/auth/errorMessages";
import { checkRushAppAccess } from "../features/auth/checkRushAppAccess";
import { loadBrotherDirectory } from "../features/brothers/loadBrotherDirectory";
import { loginWithServices } from "../features/auth/loginWithServices";
import { createAccountWithServices } from "../features/auth/createAccountWithServices";

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

/**
 * Fetch all brothers from Firestore
 * Returns array of brother objects with _id, firstname, lastname, email
 */
export async function getAllBrothers() {
    return loadBrotherDirectory({
        db,
        collection,
        query,
        orderBy,
        getDocs,
        logError: (...args) => console.error(...args),
    });
}

/**
 * Send password reset email
 */
export async function resetPassword(email) {
    try {
        await sendPasswordResetEmail(auth, email);
        
        toast.success('Password reset email sent! Check your inbox.', {
            position: "top-center",
            autoClose: 5000,
                    theme: "dark",
                });
        
        return true;
        
    } catch (error) {
        console.error("Password reset error:", error);
        
        toast.error(resetErrorMessage(error.code), {
                position: "top-center",
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                theme: "dark",
            });

        return false;
    }
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
