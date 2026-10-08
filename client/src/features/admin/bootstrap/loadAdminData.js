// Verify admin access and load the directory, schedules, availability, and access settings.
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
            // Navigate to the credential error page when verification returns false.
            if (response == false) {
                navigate(`/error/${errorTitle}/${errorDescription}`);
            }
        })
        .catch(() => {
            // Navigate to the credential error page when verification rejects.
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
    // Load one admin section and log its failure without stopping later requests.
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
        const list = snapshot.docs.map(/* Combine each brother’s document ID with its stored profile data. */ (doc) => ({
            id: doc.id,
            ...doc.data(),
        }));
        setBrothers(list);
    } catch (error) {
        logError("Failed to fetch brothers:", error);
    }

    await loadSection(`${rusheeApiBase}/get-rushees`, "Failed to fetch rushees:",
        /* Store the loaded rushee list. */ (data) => setRushees(data.payload));

    await loadSection(`${rusheeApiBase}/get-available-timeslots`, "Failed to fetch timeslots:",
        /* Store the available rescheduling timeslots. */ (data) => setAvailableTimeslots(data.payload));

    await loadSection(`${apiBase}/pis-availability/status`, "Failed to fetch PIS form status:",
        /* Store the availability form’s active status and sent time. */ (data) => setPisFormStatus({
            is_active: data.is_active,
            sent_at: data.sent_at
        }));

    await loadSection(`${apiBase}/pis-availability/all`, "Failed to fetch brother availabilities:",
        /* Store brother availability submissions. */ (data) => setBrotherAvailabilities(data.payload));

    await loadSection(`${apiBase}/get_pis_timeslots`, "Failed to fetch PIS timeslots:", (data) => {
        // Sort PIS timeslots chronologically and store them for availability editing.
        const sorted = data.payload.sort((a, b) => {
            // Compare timeslot BSON timestamps in ascending order.
            const timeA = parseInt(a.time.$date.$numberLong);
            const timeB = parseInt(b.time.$date.$numberLong);
            return timeA - timeB;
        });
        setAllPisTimeslots(sorted);
    });

    await loadSection(`${apiBase}/rush-app/status`, "Failed to fetch Rush App status:",
        /* Store rush-app access flags and the last updater. */ (data) => setRushAppStatus({
            disable_bidcom: data.disable_bidcom,
            disable_regular: data.disable_regular,
            midterm_mode: data.midterm_mode ?? false,
            updated_by: data.updated_by
        }));

    await loadSection(`${apiBase}/comment-visibility/status`, "Failed to fetch comment visibility status:",
        /* Store the comment restriction and the last updater. */ (data) => setCommentVisibilityStatus({
            require_comment_to_view: data.require_comment_to_view,
            updated_by: data.updated_by
        }));

    setLoading(false);
}
