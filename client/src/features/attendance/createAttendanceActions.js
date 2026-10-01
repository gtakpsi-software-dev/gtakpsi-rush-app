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

export function createAttendanceActions({
    api, gtid, setLoading, setPage, setRushee, setGtid, axios, toast, log,
}) {
    const handleSubmit = async () => {
        setLoading(true);

        await axios.get(`${api}/rushee/${gtid}`)
            .then((response) => {
                if (response.data.status == "success") {
                    setPage(1);
                    setRushee(response.data.payload);
                    log(response.data.payload);
                } else {
                    showAttendanceError(toast, `${response.data.message}`);
                }
            })
            .catch((error) => {
                log(error);
                showAttendanceError(toast, "Some internal network error occurred");
            });

        setLoading(false);
    };

    const goBack = () => {
        setGtid();
        setPage(0);
        setRushee();
    };

    const checkIn = async () => {
        setLoading(true);

        await axios.post(`${api}/rushee/update-attendance/${gtid}`)
            .then((response) => {
                if (response.data.status == "success") {
                    setPage(2);
                } else {
                    showAttendanceError(toast, `${response.data.message}`);
                }
            })
            .catch((error) => {
                log(error);
                showAttendanceError(toast, "Some internal network error occurred");
            });

        setLoading(false);
    };

    return { handleSubmit, goBack, checkIn };
}
