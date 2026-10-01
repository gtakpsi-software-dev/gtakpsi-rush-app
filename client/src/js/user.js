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
import { createdStoredUser, loginStoredUser } from "../features/auth/userSession";
import { accountErrorMessage, loginErrorMessage, resetErrorMessage } from "../features/auth/errorMessages";
import { checkRushAppAccess } from "../features/auth/checkRushAppAccess";

/**
 * Sign in with email and password
 * Checks if the Rush App is disabled for this user before allowing access
 */
export async function login(credentials) {
    try {
        const userCredential = await signInWithEmailAndPassword(
            auth, 
            credentials.email, 
            credentials.pwd
        );
        
        const user = userCredential.user;
        
        // Get the user's token to check their claims (admin/bidcom status)
        const tokenResult = await user.getIdTokenResult(true);
        const isAdmin = tokenResult.claims?.admin === true;
        const isBidcom = tokenResult.claims?.bidcom === true;
        
        console.log("Login - User claims:", {
            uid: user.uid,
            email: user.email,
            claims: tokenResult.claims,
            isAdmin,
            isBidcom
        });
        
        const apiBase = import.meta.env.VITE_API_PREFIX;
        const accessAllowed = await checkRushAppAccess({
            user,
            isAdmin,
            isBidcom,
            apiBase,
            getApiKey: () => import.meta.env.VITE_API_KEY,
            fetchRequest: (...args) => fetch(...args),
            signOut,
            auth,
            removeStoredUser: () => localStorage.removeItem('user'),
            toast,
            logger: console,
        });
        if (!accessAllowed) {
            return false;
        }

        localStorage.setItem('user', JSON.stringify(loginStoredUser(user)));
        
        toast.success('Signed in successfully!', {
            position: "top-center",
            autoClose: 3000,
            theme: "dark",
        });
        
        return true;
        
    } catch (error) {
        console.error("Login error:", error);
        
        toast.error(loginErrorMessage(error.code), {
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
 * Create a new account
 * Only emails in the allowed list can create accounts
 * Also creates a user document in Firestore
 */
export async function createAccount(credentials) {
    // Check if email is in the allowed list
    if (!isEmailAllowed(credentials.email)) {
        toast.error('This email is not authorized to create an account. Only GT AKPsi brothers can register.', {
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

    try {
        const userCredential = await createUserWithEmailAndPassword(
            auth,
            credentials.email,
            credentials.pwd
        );
        
        const user = userCredential.user;
        
        // Update display name if provided
        const displayName = `${credentials.firstName || ''} ${credentials.lastName || ''}`.trim();
        if (displayName) {
            await updateProfile(user, { displayName });
        }
        
        // Create user document in Firestore
        const userDoc = {
            uid: user.uid,
            email: user.email,
            firstname: credentials.firstName || '',
            lastname: credentials.lastName || '',
            displayName: displayName,
            createdAt: new Date().toISOString(),
        };
        
        await setDoc(doc(db, "brothers", user.uid), userDoc);
        
        localStorage.setItem('user', JSON.stringify(createdStoredUser(user, credentials, displayName)));
        
        toast.success('Account created successfully!', {
            position: "top-center",
            autoClose: 3000,
                    theme: "dark",
                });
        
        return true;
        
    } catch (error) {
        console.error("Create account error:", error);
        
        toast.error(accountErrorMessage(error.code), {
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
 * Fetch all brothers from Firestore
 * Returns array of brother objects with _id, firstname, lastname, email
 */
export async function getAllBrothers() {
    try {
        const brothersRef = collection(db, "brothers");
        const q = query(brothersRef, orderBy("firstname"));
        const querySnapshot = await getDocs(q);
        
        const brothers = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            brothers.push({
                _id: doc.id,
                uid: data.uid,
                firstname: data.firstname,
                lastname: data.lastname,
                email: data.email,
                displayName: data.displayName,
            });
        });
        
        return brothers;
    } catch (error) {
        console.error("Error fetching brothers:", error);
        return [];
    }
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
