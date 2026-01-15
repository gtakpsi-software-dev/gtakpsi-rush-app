import { useState, useEffect } from "react";
import axios from "axios";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";

/**
 * Custom hook to check if the app is disabled for the current user.
 * Checks against user type: admin, bidcom, or regular brother.
 * 
 * @returns {{ appDisabled: boolean, appDisabledMessage: string, isChecking: boolean }}
 */
export function useAppDisableCheck() {
    const [appDisabled, setAppDisabled] = useState(false);
    const [appDisabledMessage, setAppDisabledMessage] = useState("");
    const [isChecking, setIsChecking] = useState(true);
    
    useEffect(() => {
        // Use auth state listener to ensure we have the correct user state
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            // Reset state on auth change
            setAppDisabled(false);
            setAppDisabledMessage("");
            
            if (!user) {
                setIsChecking(false);
                return;
            }
            
            try {
                // Force refresh token to get latest claims
                const tokenResult = await user.getIdTokenResult(true);
                const isAdmin = tokenResult.claims?.admin === true;
                const isBidcom = tokenResult.claims?.bidcom === true;
                
                // Check if app is disabled
                const api = import.meta.env.VITE_API_PREFIX;
                const response = await axios.get(`${api}/brother/app-status`);
                
                if (response.data.status === "success") {
                    const disabledForRegular = response.data.disabled_for_regular_brothers;
                    const disabledForBidcom = response.data.disabled_for_bidcom_brothers;
                    const disabledForAdmins = response.data.disabled_for_admins;
                    
                    // Check if disabled for this user type
                    if (isAdmin && disabledForAdmins) {
                        setAppDisabled(true);
                        setAppDisabledMessage(response.data.message || "Rush App is Disabled.");
                    } else if (isBidcom && !isAdmin && disabledForBidcom) {
                        // Bidcom who is not an admin
                        setAppDisabled(true);
                        setAppDisabledMessage(response.data.message || "Rush App is Disabled.");
                    } else if (!isBidcom && !isAdmin && disabledForRegular) {
                        // Regular brother (not admin, not bidcom)
                        setAppDisabled(true);
                        setAppDisabledMessage(response.data.message || "Rush App is Disabled.");
                    }
                }
            } catch (err) {
                console.log("Error checking app disable status:", err);
                // On error, don't disable the app
                setAppDisabled(false);
            } finally {
                setIsChecking(false);
            }
        });
        
        return () => unsubscribe();
    }, []);
    
    return { appDisabled, appDisabledMessage, isChecking };
}
