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
