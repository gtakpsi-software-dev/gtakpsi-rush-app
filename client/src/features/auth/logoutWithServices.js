// Sign out and remove the local session, retaining it if Firebase sign-out fails.
export async function logoutWithServices({ auth, signOut, removeStoredUser, logger }) {
    try {
        await signOut(auth);

        // INVARIANT: retain the local session when Firebase sign-out fails.
        removeStoredUser();
        return true;
    } catch (error) {
        logger.error("Logout error:", error);
        return false;
    }
}
