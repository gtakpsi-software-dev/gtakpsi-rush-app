const ERROR_ROUTE = "/error/Uh Oh! Something weird happened.../Some network error happened while submitting your comment...";

export async function loadBrotherPisSlots({
    verifyUser,
    navigate,
    axios,
    api,
    setDays,
    setLoading,
    logPayload,
}) {
    setLoading(true);
    await verifyUser()
        .then(async (response) => {
            if (response === false) {
                navigate("/");
            }

            await axios.get(`${api}/rushee/get-timeslots`).then((response) => {
                if (response.data.status && response.data.status == "success") {
                    const tempDays = new Map();
                    logPayload(response.data.payload);

                    for (const slot in response.data.payload) {
                        const jsDate = new Date(
                            parseInt(response.data.payload[slot].time.$date.$numberLong)
                        );
                        const day = jsDate.toDateString();
                        const newSlot = {
                            time: jsDate,
                            rushee_first_name: response.data.payload[slot].rushee_first_name,
                            rushee_last_name: response.data.payload[slot].rushee_last_name,
                            rushee_gtid: response.data.payload[slot].rushee_gtid,
                            first_brother_first_name: response.data.payload[slot].first_brother_first_name,
                            first_brother_last_name: response.data.payload[slot].first_brother_last_name,
                            second_brother_first_name: response.data.payload[slot].second_brother_first_name,
                            second_brother_last_name: response.data.payload[slot].second_brother_last_name,
                        };

                        if (tempDays.has(day)) {
                            tempDays.get(day).push(newSlot);
                            tempDays.set(day, tempDays.get(day).sort((a, b) => a.time - b.time));
                        } else {
                            tempDays.set(day, [newSlot]);
                        }

                        // Preserve the original state-update sequence and shared Map identity.
                        setDays(tempDays);
                    }
                } else {
                    navigate(ERROR_ROUTE);
                }
            });
        })
        .catch(() => {
            navigate(ERROR_ROUTE);
        });

    setLoading(false);
}
