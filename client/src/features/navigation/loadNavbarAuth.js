export async function loadNavbarAuth({
    verifyUser,
    auth,
    allowlist,
    setIsAuthenticated,
    setIsAdmin,
    setIsBidcom,
    setIsLoading,
}) {
    try {
        const authenticated = await verifyUser();
        setIsAuthenticated(authenticated);

        // Keep role lookup after verification even when it returns false.
        const user = auth.currentUser;
        if (user) {
            const tokenResult = await user.getIdTokenResult(true);
            const adminClaim = tokenResult.claims?.admin === true;
            const bidcomClaim = tokenResult.claims?.bidcom === true;
            const email = user.email ? user.email.toLowerCase() : "";
            const isAllowlisted = email && allowlist.includes(email);

            setIsAdmin(adminClaim || isAllowlisted);
            setIsBidcom(bidcomClaim);
        }
    } catch {
        setIsAuthenticated(false);
    } finally {
        setIsLoading(false);
    }
}
