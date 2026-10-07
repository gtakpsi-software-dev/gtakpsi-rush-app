export async function loadRusheeZoom({
    verifyUser,
    navigate,
    errorTitle,
    errorDescription,
    auth,
    setIsAdmin,
    setIsBidcom,
    axios,
    api,
    gtid,
    setRushee,
    setRequireCommentToView,
    setError,
    setLoading,
    logError,
    logData,
}) {
    await verifyUser()
        .then(async (response) => {
            // Preserve the existing redirect while later profile reads still complete.
            if (response == false) {
                navigate(`/error/${errorTitle}/${errorDescription}`);
            }

            const currentUser = auth.currentUser;
            if (currentUser) {
                try {
                    const tokenResult = await currentUser.getIdTokenResult(true);
                    setIsAdmin(tokenResult.claims?.admin === true);
                    setIsBidcom(tokenResult.claims?.bidcom === true);
                } catch (e) {
                    logError("Error checking admin/bidcom status:", e);
                }
            }

            await axios.get(`${api}/rushee/${gtid}`)
                .then((response) => {
                    if (response.data.status === "success") {
                        logData(response.data.payload);
                        setRushee(response.data.payload);
                    } else {
                        navigate(`/error/${errorTitle}/${"Rushee with this GTID does not exist"}`);
                    }
                });

            try {
                const visibilityResponse = await axios.get(`${api}/brother/comment-visibility/status`);
                if (visibilityResponse.data.status === "success") {
                    setRequireCommentToView(visibilityResponse.data.require_comment_to_view);
                }
            } catch (e) {
                logError("Error fetching comment visibility settings:", e);
                // Retain the restrictive default when visibility settings are unavailable.
            }
        })
        .catch(() => {
            setError(true);
            navigate(`/error/${errorTitle}/${errorDescription}`);
        });

    setLoading(false);
}
