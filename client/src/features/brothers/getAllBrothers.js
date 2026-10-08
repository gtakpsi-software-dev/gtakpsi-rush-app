import { db, getDocs, collection, query, orderBy } from "../../firebase";
import { loadBrotherDirectory } from "./loadBrotherDirectory";

// Load the alphabetized brother directory using the configured Firestore instance.
export async function getAllBrothers() {
    return loadBrotherDirectory({
        db,
        collection,
        query,
        orderBy,
        getDocs,
        // Report directory-loading errors to the console.
        logError: (...args) => console.error(...args),
    });
}
