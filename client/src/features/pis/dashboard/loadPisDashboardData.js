/**
 * PIS Dashboard Load Summary:
 * - Moves the existing verification and PIS request sequence out of the page.
 * - Retains navigation, error classification, logging, and state-update order.
 */
export async function loadPisDashboardData({
    verifyUser, navigate, user, api, post, setRushees,
    setLoading, setErrorDescription, setError, log,
}) {
    setLoading(true);

    await verifyUser()
        .then(async (response) => {
            // A false verification result navigates away but the existing request still runs.
            if (response === false) {
                navigate("/");
            }

            const payload = {
                "first_name": user.firstname,
                "last_name": user.lastname,
            };

            await post(`${api}/admin/get-brother-pis`, payload)
                .then((response) => {
                    if (response.data.status === "success") {
                        setRushees(response.data.payload);
                        log(response.data.payload);
                    } else {
                        setErrorDescription("There was some issue fetching the rushees");
                        setError(true);
                    }
                })
                .catch(() => {
                    setErrorDescription("There was some network error while fetching the rushees.");
                    setError(true);
                });
        })
        .catch((error) => {
            log(error);
            setErrorDescription("There was an error verifying your credentials.");
            setError(true);
        });

    setLoading(false);
}
