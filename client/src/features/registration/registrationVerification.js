import axios from "axios"

const api = import.meta.env.VITE_API_PREFIX;

export function verifyGTID(gtid) {

    // check length
    if (gtid.length != 9) {
        return false;
    }

    // verify its all numbers
    if (!/^[0-9]+$/.test(gtid)) {
        return false
    }

    return true;

}

/**
 *
 * Checks if a Rushee's Basic Info is valid or not
 *
 * @param String gtid
 * @param String email
 * @returns Status and Error JSON
 */
export async function verifyInfo(gtid, email, phone, isNewGTID) {

    // verify gtid is 9 digits
    // check length
    console.log(gtid.length)
    if (gtid.length != 9) {
        return {
            "status": "error",
            "message": "GTID Must be 9 digits long"
        };
    }

    if (phone.length != 14) {
        return {
            "status": "error",
            "message": "Phone Number must be 10 digits long"
        };
    }

    // verify its all numbers
    if (!/^[0-9]+$/.test(gtid)) {
        return {
            "status": "error",
            "message": "GTID must be comprised of all digits"
        };
    }

    const valid_email_regex = /^[^\s@]+@gatech\.edu$/;

    // verify valid email
    if (!valid_email_regex.test(email)) {
        return {
            "status": "error",
            "message": "Email must be a valid Georgia Tech Email Address"
        };
    }

    // verify if GTID exists already

    if (!isNewGTID) {
        return {
            status: "success",
        };
    }

    try {
        const response = await axios.get(`${api}/rushee/does-rushee-exist/${gtid}`);

        if (response.data.status === "success") {
            return {
                status: "success",
            };
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
