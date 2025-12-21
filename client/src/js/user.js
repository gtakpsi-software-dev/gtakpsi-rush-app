import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { 
    auth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    updateProfile
} from "../firebase";
import { isEmailAllowed } from "../data/allowedEmails";

/**
 * Sign in with email and password
 */
export async function login(credentials) {
    try {
        const userCredential = await signInWithEmailAndPassword(
            auth, 
            credentials.email, 
            credentials.pwd
        );
        
        const user = userCredential.user;
        const nameParts = user.displayName?.split(' ') || ['', ''];
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        // Store user info in localStorage for easy access
        // Using both old field names (for voting compatibility) and new ones
        localStorage.setItem('user', JSON.stringify({
            _id: user.uid,           // For voting system compatibility
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            firstname: firstName,     // lowercase for voting system
            lastname: lastName,       // lowercase for voting system
            firstName: firstName,     // camelCase for other uses
            lastName: lastName,       // camelCase for other uses
        }));
        
        toast.success('Signed in successfully!', {
            position: "top-center",
            autoClose: 3000,
            theme: "dark",
        });
        
        return true;
        
    } catch (error) {
        console.error("Login error:", error);
        
        let errorMessage = 'Some error occurred. Try again later';
        
        switch (error.code) {
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address';
                break;
            case 'auth/user-disabled':
                errorMessage = 'This account has been disabled';
                break;
            case 'auth/user-not-found':
                errorMessage = 'No account found with this email';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Incorrect password';
                break;
            case 'auth/invalid-credential':
                errorMessage = 'Invalid email or password';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Too many failed attempts. Please try again later';
                break;
        }
        
        toast.error(errorMessage, {
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
        if (credentials.firstName || credentials.lastName) {
            const displayName = `${credentials.firstName || ''} ${credentials.lastName || ''}`.trim();
            await updateProfile(user, { displayName });
        }
        
        // Store user info in localStorage
        // Using both old field names (for voting compatibility) and new ones
        const displayName = user.displayName || `${credentials.firstName} ${credentials.lastName}`;
        localStorage.setItem('user', JSON.stringify({
            _id: user.uid,           // For voting system compatibility
            uid: user.uid,
            email: user.email,
            displayName: displayName,
            firstname: credentials.firstName || '',   // lowercase for voting system
            lastname: credentials.lastName || '',     // lowercase for voting system
            firstName: credentials.firstName || '',   // camelCase for other uses
            lastName: credentials.lastName || '',     // camelCase for other uses
        }));
        
        toast.success('Account created successfully!', {
            position: "top-center",
            autoClose: 3000,
            theme: "dark",
        });
        
        return true;
        
    } catch (error) {
        console.error("Create account error:", error);
        
        let errorMessage = 'Some error occurred. Try again later';
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'An account with this email already exists';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address';
                break;
            case 'auth/operation-not-allowed':
                errorMessage = 'Email/password accounts are not enabled';
                break;
            case 'auth/weak-password':
                errorMessage = 'Password is too weak. Use at least 6 characters';
                break;
        }
        
        toast.error(errorMessage, {
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
        
        let errorMessage = 'Some error occurred. Try again later';
        
        switch (error.code) {
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address';
                break;
            case 'auth/user-not-found':
                errorMessage = 'No account found with this email';
                break;
        }
        
        toast.error(errorMessage, {
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
