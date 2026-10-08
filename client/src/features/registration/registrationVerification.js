import axios from "axios";

const api = import.meta.env.VITE_API_PREFIX;

// Check that a GTID contains exactly nine digits.
export function verifyGTID(gtid) {
    if (gtid.length != 9) {
        return false;
    }

    if (!/^[0-9]+$/.test(gtid)) {
        return false;
    }

    return true;
}

// Validate GTID, phone, and Georgia Tech email, then check duplicates for new GTIDs.
export async function verifyInfo(gtid, email, phone, isNewGTID) {
    console.log(gtid.length);
    if (gtid.length != 9) {
        return {
            status: "error",
            message: "GTID Must be 9 digits long",
        };
    }

    if (phone.length != 14) {
        return {
            status: "error",
            message: "Phone Number must be 10 digits long",
        };
    }

    if (!/^[0-9]+$/.test(gtid)) {
        return {
            status: "error",
            message: "GTID must be comprised of all digits",
        };
    }

    const validEmailRegex = /^[^\s@]+@gatech\.edu$/;
    if (!validEmailRegex.test(email)) {
        return {
            status: "error",
            message: "Email must be a valid Georgia Tech Email Address",
        };
    }

    // Existing registrations still validate local fields, but skip duplicate lookup.
    if (!isNewGTID) {
        return { status: "success" };
    }

    try {
        const response = await axios.get(`${api}/rushee/does-rushee-exist/${gtid}`);

        if (response.data.status === "success") {
            return { status: "success" };
        } else if (response.data.message === "exists") {
            return {
                status: "error",
                message: `Rushee with GTID ${gtid} already exists in our system`,
            };
        } else {
            return {
                status: "error",
                message: "Some server-based network error occurred",
            };
        }
    } catch (error) {
        console.error(error);
        return {
            status: "error",
            message: "Some network error occurred",
        };
    }
}
