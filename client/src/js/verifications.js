import axios from "axios"
import { toast } from "react-toastify";
import { auth, signOut } from "../firebase";

const api = import.meta.env.VITE_API_PREFIX;

/**
 * Verify if user is logged in via Firebase Auth
 */
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

export function verifyGTID(gtid) {

    // check length
    if (gtid.length != 9) {
        return false;
    }

    // verify its all numbers
    if (!/^[0-9]+$/.test(gtid)) {
        return false
    }

    return true;

}

/**
 * 
 * Checks if a Rushee's Basic Info is valid or not
 * 
 * @param String gtid
 * @param String email
 * @returns Status and Error JSON
 */
export async function verifyInfo(gtid, email, phone, isNewGTID) {

    // verify gtid is 9 digits
    // check length
    console.log(gtid.length)
    if (gtid.length != 9) {
        return {
            "status": "error",
            "message": "GTID Must be 9 digits long"
        };
    }

    if (phone.length != 14) {
        return {
            "status": "error",
            "message": "Phone Number must be 10 digits long"
        };
    }

    // verify its all numbers
    if (!/^[0-9]+$/.test(gtid)) {
        return {
            "status": "error",
            "message": "GTID must be comprised of all digits"
        };
    }

    const valid_email_regex = /^[^\s@]+@gatech\.edu$/;

    // verify valid email
    if (!valid_email_regex.test(email)) {
        return {
            "status": "error",
            "message": "Email must be a valid Georgia Tech Email Address"
        };
    }

    // verify if GTID exists already 

    if (!isNewGTID) {
        return {
            status: "success",
        };
    }

    try {
        const response = await axios.get(`${api}/rushee/does-rushee-exist/${gtid}`);

        if (response.data.status === "success") {
            return {
                status: "success",
            };
        } else if (response.data.message === "exists") {
            return {
                status: "error",
                message: `Rushee with GTID ${gtid} already exists in our system`,
            };
        } else {
            return {
                status: "error",
                message: "Some server-based network error occurred",
            };
        }
    } catch (error) {
        console.error(error);
        return {
            status: "error",
            message: "Some network error occurred",
        };
    }

}