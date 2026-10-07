import { loginErrorMessage } from "./errorMessages.js";
import { loginStoredUser } from "./userSession.js";

export async function loginWithServices(credentials, {
    auth,
    signInWithEmailAndPassword,
    signOut,
    checkRushAppAccess,
    getApiPrefix,
    getApiKey,
    fetchRequest,
    storeUser,
    removeStoredUser,
    toast,
    logger,
}) {
    try {
        const userCredential = await signInWithEmailAndPassword(
            auth,
            credentials.email,
            credentials.pwd
        );

        const user = userCredential.user;
        const tokenResult = await user.getIdTokenResult(true);
        const isAdmin = tokenResult.claims?.admin === true;
        const isBidcom = tokenResult.claims?.bidcom === true;

        logger.log("Login - User claims:", {
            uid: user.uid,
            email: user.email,
            claims: tokenResult.claims,
            isAdmin,
            isBidcom,
        });

        const apiBase = getApiPrefix();
        const accessAllowed = await checkRushAppAccess({
            user,
            isAdmin,
            isBidcom,
            apiBase,
            getApiKey,
            fetchRequest,
            signOut,
            auth,
            removeStoredUser,
            toast,
            logger,
        });
        if (!accessAllowed) {
            return false;
        }

        // INVARIANT: only an allowed login may be stored or shown as successful.
        storeUser('user', JSON.stringify(loginStoredUser(user)));

        toast.success('Signed in successfully!', {
            position: "top-center",
            autoClose: 3000,
            theme: "dark",
        });

        return true;
    } catch (error) {
        logger.error("Login error:", error);

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
