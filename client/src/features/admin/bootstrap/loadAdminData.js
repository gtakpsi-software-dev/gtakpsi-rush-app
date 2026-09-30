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

    // Keep reads sequential and let later sections load if one request fails.
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

    try {
        const rusheesResponse = await axios.get(`${rusheeApiBase}/get-rushees`);
        if (rusheesResponse.data.status === "success") {
            setRushees(rusheesResponse.data.payload);
        }
    } catch (error) {
        logError("Failed to fetch rushees:", error);
    }

    try {
        const timeslotsResponse = await axios.get(`${rusheeApiBase}/get-available-timeslots`);
        if (timeslotsResponse.data.status === "success") {
            setAvailableTimeslots(timeslotsResponse.data.payload);
        }
    } catch (error) {
        logError("Failed to fetch timeslots:", error);
    }

    try {
        const formStatusResponse = await axios.get(`${apiBase}/pis-availability/status`);
        if (formStatusResponse.data.status === "success") {
            setPisFormStatus({
                is_active: formStatusResponse.data.is_active,
                sent_at: formStatusResponse.data.sent_at
            });
        }
    } catch (error) {
        logError("Failed to fetch PIS form status:", error);
    }

    try {
        const availabilitiesResponse = await axios.get(`${apiBase}/pis-availability/all`);
        if (availabilitiesResponse.data.status === "success") {
            setBrotherAvailabilities(availabilitiesResponse.data.payload);
        }
    } catch (error) {
        logError("Failed to fetch brother availabilities:", error);
    }

    try {
        const timeslotsResponse = await axios.get(`${apiBase}/get_pis_timeslots`);
        if (timeslotsResponse.data.status === "success") {
            const sorted = timeslotsResponse.data.payload.sort((a, b) => {
                const timeA = parseInt(a.time.$date.$numberLong);
                const timeB = parseInt(b.time.$date.$numberLong);
                return timeA - timeB;
            });
            setAllPisTimeslots(sorted);
        }
    } catch (error) {
        logError("Failed to fetch PIS timeslots:", error);
    }

    try {
        const rushAppResponse = await axios.get(`${apiBase}/rush-app/status`);
        if (rushAppResponse.data.status === "success") {
            setRushAppStatus({
                disable_bidcom: rushAppResponse.data.disable_bidcom,
                disable_regular: rushAppResponse.data.disable_regular,
                midterm_mode: rushAppResponse.data.midterm_mode ?? false,
                updated_by: rushAppResponse.data.updated_by
            });
        }
    } catch (error) {
        logError("Failed to fetch Rush App status:", error);
    }

    try {
        const commentVisibilityResponse = await axios.get(`${apiBase}/comment-visibility/status`);
        if (commentVisibilityResponse.data.status === "success") {
            setCommentVisibilityStatus({
                require_comment_to_view: commentVisibilityResponse.data.require_comment_to_view,
                updated_by: commentVisibilityResponse.data.updated_by
            });
        }
    } catch (error) {
        logError("Failed to fetch comment visibility status:", error);
    }

    setLoading(false);
}
