import { createAdminExportActions } from "./createAdminExportActions.js";

export function createAdminDataActions({ apiBase, getApiPrefix, axios, toast, download }) {
    const handleRequest = async (endpoint, payload, method = "post", successMessage = "Success!") => {
        try {
            const updatedPayload = { ...payload };

            // Admin timeslot endpoints receive UTC ISO strings without mutating form state.
            if (updatedPayload.time) {
                updatedPayload.time = new Date(updatedPayload.time).toISOString();
            }

            const response = await axios[method](`${apiBase}/${endpoint}`, updatedPayload);

            if (response.data.status === "success") {
                toast.success(successMessage, {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            } else {
                toast.error(response.data.message || "Something went wrong", {
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

    const exportActions = createAdminExportActions({
        apiBase, getApiPrefix, axios, toast, download,
    });

    return { handleRequest, ...exportActions };
}
