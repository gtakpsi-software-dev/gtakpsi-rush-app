export async function submitBrotherPisSlot({
    selectedSlot,
    user,
    axios,
    api,
    toast,
    alert,
    reload,
    logError,
}) {
    if (!selectedSlot) return;

    try {
        const [, , gtid] = selectedSlot.split("zz");
        const payload = {
            brother_first_name: user.firstname,
            brother_last_name: user.lastname,
        };

        const response = await axios.post(`${api}/admin/pis-signup/${gtid}`, payload);

        if (response.data.status === "success") {
            alert("YOU successfully signed up for PIS timeslot! Great Work!");
            reload();
        } else {
            toast.error(`${response.data.message}`, {
                position: "top-center",
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: "dark",
                style: {
                    fontSize: '18px',
                    padding: '20px',
                    minHeight: '80px'
                }
            });
        }
    } catch (error) {
        logError("Error submitting selected slot:", error);
        toast.error("An error occurred while submitting the timeslot. Please try again.", {
            position: "top-center",
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "dark",
            style: {
                fontSize: '18px',
                padding: '20px',
                minHeight: '80px'
            }
        });
    }
}
