import { db, getDocs, collection, query, orderBy } from "../../firebase";
import { loadBrotherDirectory } from "./loadBrotherDirectory";

export async function getAllBrothers() {
    return loadBrotherDirectory({
        db,
        collection,
        query,
        orderBy,
        getDocs,
        logError: (...args) => console.error(...args),
    });
}
