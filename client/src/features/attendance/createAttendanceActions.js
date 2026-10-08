// Show an attendance error using the shared toast options.
function showAttendanceError(toast, message) {
    toast.error(message, {
        position: "top-center",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
    });
}

// Create rushee lookup, back, and check-in actions for the attendance flow.
export function createAttendanceActions({
    api, gtid, setLoading, setPage, setRushee, setGtid, axios, toast, log,
}) {
    // Look up the entered GTID while displaying the loading state.
    const handleSubmit = async () => {
        setLoading(true);

        await axios.get(`${api}/rushee/${gtid}`)
            .then((response) => {
                // Show the matched profile or report an unsuccessful lookup.
                if (response.data.status == "success") {
                    setPage(1);
                    setRushee(response.data.payload);
                    log(response.data.payload);
                } else {
                    showAttendanceError(toast, `${response.data.message}`);
                }
            })
            .catch((error) => {
                // Log a failed lookup request and show a network error.
                log(error);
                showAttendanceError(toast, "Some internal network error occurred");
            });

        setLoading(false);
    };

    // Clear the selected rushee and return to GTID entry.
    const goBack = () => {
        setGtid();
        setPage(0);
        setRushee();
    };

    // Record attendance for the selected GTID and update the loading state.
    const checkIn = async () => {
        setLoading(true);

        await axios.post(`${api}/rushee/update-attendance/${gtid}`)
            .then((response) => {
                // Show check-in confirmation or report an unsuccessful attendance update.
                if (response.data.status == "success") {
                    setPage(2);
                } else {
                    showAttendanceError(toast, `${response.data.message}`);
                }
            })
            .catch((error) => {
                // Log a failed attendance request and show a network error.
                log(error);
                showAttendanceError(toast, "Some internal network error occurred");
            });

        setLoading(false);
    };

    return { handleSubmit, goBack, checkIn };
}
