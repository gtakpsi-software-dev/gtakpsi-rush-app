export function createAddTimeslotActions({
    apiBase,
    timeslotTime,
    timeslotChange,
    setResult,
    setIsSubmitting,
    setTimeslotTime,
    setTimeslotChange,
    setShowSuccess,
    axios,
    scheduleTimeout,
}) {
    const handleAddTimeslot = async () => {
        if (!timeslotTime) {
            setResult("Please select a time");
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                time: new Date(timeslotTime).toISOString(),
                change: timeslotChange,
            };
            const response = await axios.post(`${apiBase}/add_pis_timeslot`, payload);
            setResult(JSON.stringify(response.data, null, 2));
            // A resolved request clears the form even when the API reports an error payload.
            setTimeslotTime("");
            setTimeslotChange(1);
            setShowSuccess(true);
            scheduleTimeout(() => setShowSuccess(false), 3000);
        } catch (error) {
            setResult(error.response?.data || "An error occurred");
        }
        setIsSubmitting(false);
    };

    return { handleAddTimeslot };
}
