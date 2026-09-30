import {
    buildRusheePersonalInfoCsv,
    buildRusheeNumbersCsv,
    buildPisScheduleCsv,
    buildPisScheduleWithBrothersCsv,
} from "./exportCsv.js";

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

    const exportRusheePersonalInfo = async () => {
        try {
            const response = await axios.get(`${apiBase}/export-rushee-info`);

            if (response.data.status === "success") {
                const rushees = response.data.payload;

                const csvContent = buildRusheePersonalInfoCsv(rushees);
                download(csvContent, "Rushee_Personal_Info");

                toast.success(`Exported personal info for ${rushees.length} rushees`, {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            } else {
                toast.error("Failed to fetch rushee personal info", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch (error) {
            toast.error(`Export error: ${error.message}`, {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        }
    };

    const exportRusheeNumbers = async () => {
        try {
            const response = await axios.get(`${apiBase}/export-rushee-numbers`);

            if (response.data.status === "success") {
                const mappings = response.data.payload;

                const csvContent = buildRusheeNumbersCsv(mappings);
                download(csvContent, "Rushee_Numbers");

                toast.success(`Exported ${mappings.length} rushee numbers`, {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            } else {
                toast.error("Failed to fetch rushee numbers", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch (error) {
            toast.error(`Export error: ${error.message}`, {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        }
    };

    const exportPISSchedule = async () => {
        try {
            const api = getApiPrefix();
            const response = await axios.get(`${api}/rushee/get-timeslots`);

            if (response.data.status === "success") {
                const timeslots = response.data.payload;

                const csvContent = buildPisScheduleCsv(timeslots);
                download(csvContent, "PIS_Schedule");

                toast.success(`Exported ${timeslots.length} PIS appointments`, {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            } else {
                toast.error("Failed to fetch PIS timeslots", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch (error) {
            toast.error(`Export error: ${error.message}`, {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        }
    };

    const exportPISWithBrothers = async () => {
        try {
            const response = await axios.get(`${apiBase}/pis-availability/export-csv`);

            if (response.data.status === "success") {
                const data = response.data.payload;

                const csvContent = buildPisScheduleWithBrothersCsv(data);
                download(csvContent, "PIS_Schedule_With_Brothers");

                toast.success(`Exported ${data.length} PIS appointments with brother assignments`, {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            } else {
                toast.error("Failed to export", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch (error) {
            toast.error(`Export error: ${error.message}`, {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        }
    };

    return {
        handleRequest,
        exportRusheePersonalInfo,
        exportRusheeNumbers,
        exportPISSchedule,
        exportPISWithBrothers,
    };
}
