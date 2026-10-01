import { toast } from "react-toastify";
import { auth, signOut } from "../../firebase";

const api = import.meta.env.VITE_API_PREFIX;

export async function verifyUser() {
    return new Promise((resolve) => {
        // Check if there's a current user
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            unsubscribe(); // Stop listening after first check

            if (user) {
                // Check if the Rush App is disabled for this user
                try {
                    const tokenResult = await user.getIdTokenResult(true);
                    const isAdmin = tokenResult.claims?.admin === true;
                    const isBidcom = tokenResult.claims?.bidcom === true;
                    const apiKey = import.meta.env.VITE_API_KEY;
                    const headers = {
                        'Content-Type': 'application/json',
                    };
                    if (apiKey) {
                        headers['X-API-Key'] = apiKey;
                    }

                    const accessResponse = await fetch(`${api}/brother/rush-app/check-access`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            uid: user.uid,
                            is_admin: isAdmin,
                            is_bidcom: isBidcom,
                        }),
                    });
                    const accessData = await accessResponse.json();
                    if (accessData.status === 'success' && accessData.allowed === false) {
                        await signOut(auth);
                        localStorage.removeItem('user');
                        toast.error(accessData.reason || 'The Rush App has been temporarily disabled.', {
                            position: "top-center",
                            autoClose: 6000,
                            hideProgressBar: false,
                            closeOnClick: true,
                            pauseOnHover: true,
                            draggable: true,
                            theme: "dark",
                        });
                        resolve(false);
                        return;
                    }
                } catch (accessError) {
                    // If access check fails, allow access (fail open)
                    console.warn("Could not check Rush App access status:", accessError);
                }

                // User is signed in, update localStorage
                const nameParts = user.displayName?.split(' ') || ['', ''];
                const firstName = nameParts[0] || '';
                const lastName = nameParts.slice(1).join(' ') || '';

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
                resolve(true);
            } else {
                // User is not signed in
                localStorage.removeItem('user');
                resolve(false);
            }
        });
    });
}
