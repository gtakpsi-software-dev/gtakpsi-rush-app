import {
    buildRusheePersonalInfoCsv,
    buildRusheeNumbersCsv,
    buildPisScheduleCsv,
    buildPisScheduleWithBrothersCsv,
} from "./exportCsv.js";

export function createAdminExportActions({ apiBase, getApiPrefix, axios, toast, download }) {
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

    const exportRusheePersonalInfo = async () => {
        await runExport(
            () => `${apiBase}/export-rushee-info`,
            buildRusheePersonalInfoCsv,
            "Rushee_Personal_Info",
            (count) => `Exported personal info for ${count} rushees`,
            "Failed to fetch rushee personal info",
        );
    };

    const exportRusheeNumbers = async () => {
        await runExport(
            () => `${apiBase}/export-rushee-numbers`,
            buildRusheeNumbersCsv,
            "Rushee_Numbers",
            (count) => `Exported ${count} rushee numbers`,
            "Failed to fetch rushee numbers",
        );
    };

    const exportPISSchedule = async () => {
        await runExport(
            () => `${getApiPrefix()}/rushee/get-timeslots`,
            buildPisScheduleCsv,
            "PIS_Schedule",
            (count) => `Exported ${count} PIS appointments`,
            "Failed to fetch PIS timeslots",
        );
    };

    const exportPISWithBrothers = async () => {
        await runExport(
            () => `${apiBase}/pis-availability/export-csv`,
            buildPisScheduleWithBrothersCsv,
            "PIS_Schedule_With_Brothers",
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
