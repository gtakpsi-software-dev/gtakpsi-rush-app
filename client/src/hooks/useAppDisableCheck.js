import { useState, useEffect } from "react";
import axios from "axios";
import { auth } from "../firebase";

/**
 * Custom hook to check if the app is disabled for the current user.
 * Admins always bypass the disable check.
 * 
 * @returns {{ appDisabled: boolean, appDisabledMessage: string, isChecking: boolean }}
 */
export function useAppDisableCheck() {
    const [appDisabled, setAppDisabled] = useState(false);
    const [appDisabledMessage, setAppDisabledMessage] = useState("");
    const [isChecking, setIsChecking] = useState(true);
    
    useEffect(() => {
        async function checkAppStatus() {
            try {
                const currentUser = auth.currentUser;
                if (!currentUser) {
                    setIsChecking(false);
                    return;
                }
                
                // Get user claims to check admin/bidcom status
                const tokenResult = await currentUser.getIdTokenResult(true);
                const isAdmin = tokenResult.claims?.admin === true;
                const isBidcom = tokenResult.claims?.bidcom === true;
                
                // Admins always bypass the disable check
                if (isAdmin) {
                    setIsChecking(false);
                    return;
                }
                
                // Check if app is disabled
                const api = import.meta.env.VITE_API_PREFIX;
                const response = await axios.get(`${api}/brother/app-status`);
                
                if (response.data.status === "success") {
                    const disabledForRegular = response.data.disabled_for_regular_brothers;
                    const disabledForBidcom = response.data.disabled_for_bidcom_brothers;
                    
                    // Check if disabled for this user type
                    if (isBidcom && disabledForBidcom) {
                        setAppDisabled(true);
                        setAppDisabledMessage(response.data.message || "");
                    } else if (!isBidcom && disabledForRegular) {
                        setAppDisabled(true);
                        setAppDisabledMessage(response.data.message || "");
                    }
                }
            } catch (err) {
                console.log("Error checking app disable status:", err);
            } finally {
                setIsChecking(false);
            }
        }
        
        checkAppStatus();
    }, []);
    
    return { appDisabled, appDisabledMessage, isChecking };
}
