// Return the toast options used for registration warnings.
const warningOptions = () => ({
    position: "top-center",
    autoClose: 5000,
    hideProgressBar: false,
    closeOnClick: false,
    pauseOnHover: true,
    draggable: true,
    progress: undefined,
    theme: "colored",
});

// Create a handler that validates input refs and advances registration.
export function createBasicInfoSubmit({
    fields,
    gtid,
    email,
    phone,
    verifyInfo,
    setCurrLoading,
    setPage,
    toast,
    logError,
}) {
    return async () => {
        // Check required fields, verify registration details, and update loading state.
        setCurrLoading(true);

        for (const [input] of fields) {
            if (!input.current || input.current.value == null || input.current.value === "") {
                // Preserve the current loading state on an empty field until the next submission.
                toast.warn('Fields cannot be empty', warningOptions());
                return;
            }
        }

        // Save verified field values and advance to photo capture, or show the validation error.
        const handleVerificationResponse = (response) => {
            if (response.status === "success") {
                for (const [input, setValue] of fields) {
                    setValue(input.current?.value);
                }
                setPage(1);
            } else {
                toast.warn(`${response.message}`, warningOptions());
            }
        };

        // Log verification or field-update failures and show an internal-error warning.
        const handleVerificationFailure = (error) => {
            // Field-setter failures use the same warning path as rejected verification.
            logError(error);
            toast.warn(`Some internal error occurred`, warningOptions());
        };

        await verifyInfo(gtid.current?.value, email.current?.value, phone.current?.value, true)
            .then(handleVerificationResponse)
            .catch(handleVerificationFailure);

        setCurrLoading(false);
    };
}
