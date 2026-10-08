// Subscribe to authentication until the board’s initial access check is complete.
export function subscribeToSortingAuth({ auth, authChecked, fetchData, navigate }) {
    if (authChecked) return undefined;

    // Identity presence starts the load; each board loader still applies its own access rules.
    const unsubscribe = auth.onAuthStateChanged((user) => {
        // Load the board for a signed-in user or redirect to login.
        if (user) {
            fetchData();
        } else {
            navigate('/login');
        }
    });
    return /* Unsubscribe from sorting authentication changes. */ () => unsubscribe();
}
