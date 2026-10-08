// Build the signup API payload from form values and the uploaded photo URL.
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

// Create the final registration handler with upload and API dependencies.
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
        // Upload the profile photo, submit signup details, and store the returned access code.
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

        // Store the successful signup access code or navigate to the configured error page.
        const handleSignupResponse = (response) => {
            if (response.data.status === "error") {
                navigate(`/error/${errorTitle}/${errorDescription}`);
            } else if (response.data.status === "success") {
                setAccessCode(response.data.payload);
            } else {
                navigate(`/error/${errorTitle}/${errorDescription}`);
            }
        };

        // Log the captured page error and navigate after a rejected signup request.
        const handleRequestRejection = () => {
            // Response-handler failures share the request rejection's captured page error.
            logError(pageError);
            navigate(`/error/${errorTitle}/${errorDescription}`);
        };

        try {
            await post(`${api}/rushee/signup`, payload)
                .then(handleSignupResponse)
                .catch(handleRequestRejection);
        } catch (error) {
            logError(error);
            navigate(`/error/${errorTitle}/${errorDescription}`);
        }

        setCurrLoading(false);
        setError(false);
    };
}
