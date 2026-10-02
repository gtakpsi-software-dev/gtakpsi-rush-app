function buildSignupPayload(form, imageUrl) {
    return {
        first_name: form.firstName,
        last_name: form.lastName,
        housing: form.housing,
        phone_number: form.phone,
        email: form.email,
        gtid: form.gtid,
        major: form.major,
        class: form.year,
        pronouns: form.pronouns,
        image_url: imageUrl,
        exposure: form.exposure,
        pis_meeting_id: "meeting123",
        pis_timeslot: form.selectedSlot.time,
        pis_link: "https://example.com/pis_meeting",
        flex_window: form.flexWindow,
    };
}

export function createPisSubmit({
    api,
    form,
    pageError,
    errorTitle,
    errorDescription,
    storage,
    ref,
    base64ToBlob,
    uploadBytes,
    getDownloadURL,
    post,
    navigate,
    setCurrLoading,
    setPage,
    setErrorTitle,
    setErrorDescription,
    setAccessCode,
    setError,
    logError,
}) {
    return async () => {
        setCurrLoading(true);
        setPage(3);

        let imageUrl;

        try {
            // Keep the GTID-based Storage path because the returned URL is persisted in the rushee record.
            const fileName = `profile-pictures/${form.gtid}.jpg`;
            const storageRef = ref(storage, fileName);
            const blob = base64ToBlob(form.image);
            await uploadBytes(storageRef, blob);
            imageUrl = await getDownloadURL(storageRef);
        } catch (error) {
            logError(error);
            setErrorTitle("Uh Oh! Something Unexpected Occurred..");
            setErrorDescription("There was an error uploading your image to the cloud.");
            navigate(`/error/${errorTitle}/${"There was an error uploading your image to the cloud."}`);
            return;
        }

        const payload = buildSignupPayload(form, imageUrl);

        try {
            await post(`${api}/rushee/signup`, payload)
                .then((response) => {
                    if (response.data.status === "error") {
                        navigate(`/error/${errorTitle}/${errorDescription}`);
                    } else if (response.data.status === "success") {
                        setAccessCode(response.data.payload);
                    } else {
                        navigate(`/error/${errorTitle}/${errorDescription}`);
                    }
                })
                .catch(() => {
                    // The existing request-rejection path logs the captured page error value.
                    logError(pageError);
                    navigate(`/error/${errorTitle}/${errorDescription}`);
                });
        } catch (error) {
            logError(error);
            navigate(`/error/${errorTitle}/${errorDescription}`);
        }

        setCurrLoading(false);
        setError(false);
    };
}
