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
        setCurrLoading(true);

        for (const [input] of fields) {
            if (!input.current || input.current.value == null || input.current.value === "") {
                // Preserve the current loading state on an empty field until the next submission.
                toast.warn('Fields cannot be empty', warningOptions());
                return;
            }
        }

        await verifyInfo(gtid.current?.value, email.current?.value, phone.current?.value, true)
            .then((response) => {
                if (response.status === "success") {
                    for (const [input, setValue] of fields) {
                        setValue(input.current?.value);
                    }
                    setPage(1);
                } else {
                    toast.warn(`${response.message}`, warningOptions());
                }
            })
            .catch((error) => {
                logError(error);
                toast.warn(`Some internal error occurred`, warningOptions());
            });

        setCurrLoading(false);
    };
}
