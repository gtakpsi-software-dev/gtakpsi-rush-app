function toastOptions() {
    return {
        position: "top-center",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
    };
}

export async function submitProfileChanges(e, {
    rushee, initialRushee, api, gtid, link, setLoading,
    toast, verifyInfo, post, location, logger,
}) {
    setLoading(true);

    // Keep the existing validation order and early exits while moving this workflow.
    if (
        !rushee.first_name ||
        !rushee.last_name ||
        !rushee.housing ||
        !rushee.phone_number ||
        !rushee.email ||
        !rushee.gtid ||
        !rushee.major ||
        !rushee.class ||
        !rushee.pronouns ||
        rushee.first_name === "" ||
        rushee.last_name === "" ||
        rushee.housing === "" ||
        rushee.phone_number === "" ||
        rushee.email === "" ||
        rushee.gtid === "" ||
        rushee.major === "" ||
        rushee.class === "" ||
        rushee.pronouns === ""
    ) {
        toast.error("Fields cannot be empty", toastOptions());
        return;
    }

    e.preventDefault();

    if (!rushee || !initialRushee) {
        toast.error("Unable to parse changes", toastOptions());
        return;
    }

    const payload = Object.keys(rushee)
        .filter((key) => rushee[key] !== initialRushee[key])
        .map((key) => ({
            field: key,
            new_value: rushee[key],
        }));

    if (payload.length === 0) {
        toast.info("No changes were made", toastOptions());
        return;
    }

    try {
        const checkValidity = await verifyInfo(
            rushee["gtid"], rushee["email"], rushee["phone_number"],
            rushee["gtid"] !== initialRushee["gtid"]
        );
        if (checkValidity.status === "error") {
            toast.error(`${checkValidity.message}`, toastOptions());
            return;
        }
    } catch (err) {
        logger.log(err);
        toast.error("Failed to update rushee", toastOptions());
        return;
    }

    try {
        const response = await post(`${api}/rushee/update-rushee/${gtid}`, payload);
        if (response.data.status === "success") {
            location.href = `${location.origin}/rushee/${rushee.gtid}/${link}`;
        } else {
            toast.error(`${response.data.message}`, toastOptions());
        }
    } catch (err) {
        toast.error(`${err.response?.data?.message || "Failed to update rushee"}`, toastOptions());
    }

    setLoading(false);
}
