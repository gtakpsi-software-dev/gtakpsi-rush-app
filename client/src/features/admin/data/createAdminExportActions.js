import {
    buildRusheePersonalInfoCsv,
    buildRusheeNumbersCsv,
    buildPisScheduleCsv,
    buildPisScheduleWithBrothersCsv,
} from "./exportCsv.js";

// Create CSV download actions for rushee information and PIS schedules.
export function createAdminExportActions({ apiBase, getApiPrefix, axios, toast, download }) {
    // Fetch export data, build and download its CSV, and show the result.
    async function runExport(endpoint, buildCsv, filename, successMessage, failureMessage) {
        try {
            const response = await axios.get(endpoint());

            if (response.data.status === "success") {
                const data = response.data.payload;
                const csvContent = buildCsv(data);
                download(csvContent, filename);

                toast.success(successMessage(data.length), {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            } else {
                toast.error(failureMessage, {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch (error) {
            // Endpoint lookup, CSV creation, and download share the existing error toast.
            toast.error(`Export error: ${error.message}`, {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        }
    }

    // Download rushee personal information as CSV.
    const exportRusheePersonalInfo = async () => {
        await runExport(
            /* Return the personal-information export endpoint. */ () => `${apiBase}/export-rushee-info`,
            buildRusheePersonalInfoCsv,
            "Rushee_Personal_Info",
            /* Describe the number of exported personal-information records. */ (count) => `Exported personal info for ${count} rushees`,
            "Failed to fetch rushee personal info",
        );
    };

    // Download rushee number mappings as CSV.
    const exportRusheeNumbers = async () => {
        await runExport(
            /* Return the rushee-number export endpoint. */ () => `${apiBase}/export-rushee-numbers`,
            buildRusheeNumbersCsv,
            "Rushee_Numbers",
            /* Describe the number of exported rushee numbers. */ (count) => `Exported ${count} rushee numbers`,
            "Failed to fetch rushee numbers",
        );
    };

    // Download the chronological PIS appointment schedule as CSV.
    const exportPISSchedule = async () => {
        await runExport(
            /* Return the PIS timeslot endpoint from the current API prefix. */ () => `${getApiPrefix()}/rushee/get-timeslots`,
            buildPisScheduleCsv,
            "PIS_Schedule",
            /* Describe the number of exported PIS appointments. */ (count) => `Exported ${count} PIS appointments`,
            "Failed to fetch PIS timeslots",
        );
    };

    // Download the PIS schedule with assigned brothers as CSV.
    const exportPISWithBrothers = async () => {
        await runExport(
            /* Return the PIS assignment export endpoint. */ () => `${apiBase}/pis-availability/export-csv`,
            buildPisScheduleWithBrothersCsv,
            "PIS_Schedule_With_Brothers",
            /* Describe the number of appointments exported with brother assignments. */
            (count) => `Exported ${count} PIS appointments with brother assignments`,
            "Failed to export",
        );
    };

    return {
        exportRusheePersonalInfo,
        exportRusheeNumbers,
        exportPISSchedule,
        exportPISWithBrothers,
    };
}
