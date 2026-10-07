export async function checkRushAppAccess({
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
}) {
    try {
        const requestBody = {
            uid: user.uid,
            is_admin: isAdmin,
            is_bidcom: isBidcom,
        };
        logger.log("Login - Sending access check:", requestBody);

        const apiKey = getApiKey();
        const headers = {
            'Content-Type': 'application/json',
        };
        if (apiKey) {
            headers['X-API-Key'] = apiKey;
        }

        const accessResponse = await fetchRequest(`${apiBase}/brother/rush-app/check-access`, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
        });

        const accessData = await accessResponse.json();
        logger.log("Login - Access check response:", accessData);

        if (accessData.status === 'success' && accessData.allowed === false) {
            await signOut(auth);
            removeStoredUser();

            toast.error(accessData.reason || 'The Rush App has been temporarily disabled.', {
                position: "top-center",
                autoClose: 6000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                theme: "dark",
            });

            return false;
        }
    } catch (accessError) {
        // INVARIANT: only an explicit denial blocks login; request and cleanup errors fail open.
        logger.warn("Could not check Rush App access status:", accessError);
    }

    return true;
}
