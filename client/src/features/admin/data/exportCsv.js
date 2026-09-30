export function buildRusheePersonalInfoCsv(rushees) {
    const csvHeaders = [
        "First Name", "Last Name", "GTID", "Email", "Phone Number",
        "Housing", "Major", "Class", "Pronouns", "Exposure",
    ];
    // Keep the original field-specific escaping so downloaded CSV content does not change.
    const csvRows = [
        csvHeaders.join(","),
        ...rushees.map(r =>
            [
                `"${(r.first_name || '').replace(/"/g, '""')}"`,
                `"${(r.last_name || '').replace(/"/g, '""')}"`,
                `"${r.gtid || ''}"`,
                `"${r.email || ''}"`,
                `"${r.phone_number || ''}"`,
                `"${(r.housing || '').replace(/"/g, '""')}"`,
                `"${(r.major || '').replace(/"/g, '""')}"`,
                `"${r.class || ''}"`,
                `"${(r.pronouns || '').replace(/"/g, '""')}"`,
                `"${(r.exposure || '').replace(/"/g, '""')}"`
            ].join(",")
        )
    ];

    const csvContent = csvRows.join("\n");
    return csvContent;
}

export function buildRusheeNumbersCsv(mappings) {
    const csvHeaders = ["Rushee Number", "Name", "GTID"];
    const csvRows = [
        csvHeaders.join(","),
        ...mappings.map(m => `"${m.rushee_number}","${m.name}","${m.gtid}"`)
    ];

    const csvContent = csvRows.join("\n");
    return csvContent;
}

export function buildPisScheduleCsv(timeslots) {
    const csvHeaders = ["Date", "Time", "Rushee Name", "Flexible"];

    const processedSlots = timeslots.map(slot => {
        const jsDate = new Date(parseInt(slot.time.$date.$numberLong));
        const date = jsDate.toLocaleDateString();
        const time = jsDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
        const rusheeName = `${slot.rushee_first_name} ${slot.rushee_last_name}`;
        const flexWindow = slot.flex_window ? "Yes" : "No";

        const csvRow = [
            `"${date}"`,
            `"${time}"`,
            `"${rusheeName}"`,
            `"${flexWindow}"`
        ].join(",");

        return { originalDate: jsDate, csvRow };
    });

    // Sort rendered rows while leaving the server response array in its original order.
    processedSlots.sort((a, b) => a.originalDate - b.originalDate);

    const csvRows = [csvHeaders.join(","), ...processedSlots.map(slot => slot.csvRow)];
    const csvContent = csvRows.join("\n");
    return csvContent;
}

export function buildPisScheduleWithBrothersCsv(data) {
    const csvHeaders = ["Rushee", "Date", "Time", "Brother 1", "Brother 2"];

    const processedData = data.map(item => {
        let jsDate;
        if (item.timeslot && item.timeslot.$date && item.timeslot.$date.$numberLong) {
            jsDate = new Date(parseInt(item.timeslot.$date.$numberLong));
        } else {
            jsDate = new Date(item.timeslot);
        }
        const date = jsDate.toLocaleDateString();
        const time = jsDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

        const brother1 = item.brother_1 === "none none" ? "" : item.brother_1;
        const brother2 = item.brother_2 === "none none" ? "" : item.brother_2;

        const csvRow = [
            `"${item.rushee_name}"`,
            `"${date}"`,
            `"${time}"`,
            `"${brother1}"`,
            `"${brother2}"`
        ].join(",");

        return { originalDate: jsDate, csvRow };
    });

    // Keep the download chronological without mutating the assignment response.
    processedData.sort((a, b) => a.originalDate - b.originalDate);

    const csvRows = [csvHeaders.join(","), ...processedData.map(d => d.csvRow)];
    const csvContent = csvRows.join("\n");
    return csvContent;
}
