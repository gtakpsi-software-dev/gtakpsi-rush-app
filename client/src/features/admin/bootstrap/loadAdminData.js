export async function loadAdminData({
    verifyUser,
    navigate,
    errorTitle,
    errorDescription,
    auth,
    allowlist,
    axios,
    db,
    collection,
    getDocs,
    apiBase,
    rusheeApiBase,
    toast,
    logError,
    setBrothers,
    setRushees,
    setAvailableTimeslots,
    setPisFormStatus,
    setBrotherAvailabilities,
    setAllPisTimeslots,
    setRushAppStatus,
    setCommentVisibilityStatus,
    setLoading,
}) {
    await verifyUser()
        .then(async (response) => {
            if (response == false) {
                navigate(`/error/${errorTitle}/${errorDescription}`);
            }
        })
        .catch(() => {
            navigate(`/error/${errorTitle}/${errorDescription}`);
        });

    const current = auth.currentUser;
    if (!current) {
        navigate(`/error/${errorTitle}/${errorDescription}`);
        return;
    }

    const tokenResult = await current.getIdTokenResult(true);
    const isAdmin = tokenResult.claims?.admin === true;
    const isAllowlisted = current.email && allowlist.includes(current.email.toLowerCase());
    if (!(isAdmin || isAllowlisted)) {
        toast.error("Not authorized");
        navigate(`/error/${errorTitle}/${errorDescription}`);
        return;
    }

    // INVARIANT: only a valid claim or allowlist match may set the shared admin header.
    axios.defaults.headers.common["Authorization"] = `Bearer ${tokenResult.token}`;

    // Catch request and setter errors per section so later sequential reads still run.
    async function loadSection(path, failureMessage, apply) {
        try {
            const response = await axios.get(path);
            if (response.data.status === "success") {
                apply(response.data);
            }
        } catch (error) {
            logError(failureMessage, error);
        }
    }

    try {
        const snapshot = await getDocs(collection(db, "brothers"));
        const list = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));
        setBrothers(list);
    } catch (error) {
        logError("Failed to fetch brothers:", error);
    }

    await loadSection(`${rusheeApiBase}/get-rushees`, "Failed to fetch rushees:",
        (data) => setRushees(data.payload));

    await loadSection(`${rusheeApiBase}/get-available-timeslots`, "Failed to fetch timeslots:",
        (data) => setAvailableTimeslots(data.payload));

    await loadSection(`${apiBase}/pis-availability/status`, "Failed to fetch PIS form status:",
        (data) => setPisFormStatus({
            is_active: data.is_active,
            sent_at: data.sent_at
        }));

    await loadSection(`${apiBase}/pis-availability/all`, "Failed to fetch brother availabilities:",
        (data) => setBrotherAvailabilities(data.payload));

    await loadSection(`${apiBase}/get_pis_timeslots`, "Failed to fetch PIS timeslots:", (data) => {
        const sorted = data.payload.sort((a, b) => {
            const timeA = parseInt(a.time.$date.$numberLong);
            const timeB = parseInt(b.time.$date.$numberLong);
            return timeA - timeB;
        });
        setAllPisTimeslots(sorted);
    });

    await loadSection(`${apiBase}/rush-app/status`, "Failed to fetch Rush App status:",
        (data) => setRushAppStatus({
            disable_bidcom: data.disable_bidcom,
            disable_regular: data.disable_regular,
            midterm_mode: data.midterm_mode ?? false,
            updated_by: data.updated_by
        }));

    await loadSection(`${apiBase}/comment-visibility/status`, "Failed to fetch comment visibility status:",
        (data) => setCommentVisibilityStatus({
            require_comment_to_view: data.require_comment_to_view,
            updated_by: data.updated_by
        }));

    setLoading(false);
}
