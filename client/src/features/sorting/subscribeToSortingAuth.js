export function subscribeToSortingAuth({ auth, authChecked, fetchData, navigate }) {
    if (authChecked) return undefined;

    // Identity presence starts the load; each board loader still checks its own role rules.
    const unsubscribe = auth.onAuthStateChanged((user) => {
        if (user) {
            fetchData();
        } else {
            navigate('/login');
        }
    });
    return () => unsubscribe();
}
