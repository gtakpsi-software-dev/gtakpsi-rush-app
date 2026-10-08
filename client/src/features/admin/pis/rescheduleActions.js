// Create rushee selection and PIS rescheduling actions.
export function createRescheduleActions({
    rusheeApiBase,
    selectedRushee,
    selectedNewTimeslot,
    setSelectedRushee,
    setRusheeSearch,
    setFilteredRushees,
    setSelectedNewTimeslot,
    setAvailableTimeslots,
    axios,
    toast,
    logError,
}) {
    // Select a rushee and replace search results with their name.
    const handleSelectRushee = (rushee) => {
        setSelectedRushee(rushee);
        setRusheeSearch(rushee.name);
        setFilteredRushees([]);
    };

    // Validate the selection, reschedule PIS, then clear the form and refresh capacity.
    const handleReschedulePIS = async () => {
        if (!selectedRushee || !selectedNewTimeslot) {
            toast.error("Please select a rushee and a new timeslot", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
            return;
        }

        try {
            const response = await axios.post(
                `${rusheeApiBase}/reschedule-pis/${selectedRushee.gtid}`,
                JSON.stringify(selectedNewTimeslot),
                {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data.status === "success") {
                toast.success(`PIS rescheduled for ${selectedRushee.name}`, {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
                // Clear the selection only after the reschedule succeeds.
                setSelectedRushee(null);
                setRusheeSearch("");
                setSelectedNewTimeslot("");

                // Refresh capacity after the mutation so the next choice is current.
                try {
                    const timeslotsResponse = await axios.get(`${rusheeApiBase}/get-available-timeslots`);
                    if (timeslotsResponse.data.status === "success") {
                        setAvailableTimeslots(timeslotsResponse.data.payload);
                    }
                } catch (e) {
                    logError("Failed to refresh timeslots:", e);
                }
            } else {
                toast.error(response.data.message || "Failed to reschedule", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "An error occurred", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        }
    };

    return { handleSelectRushee, handleReschedulePIS };
}
