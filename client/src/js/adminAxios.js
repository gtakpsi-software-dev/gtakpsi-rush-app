import axios from "axios";
import { auth } from "../firebase";

/**
 * Get an axios instance configured with Firebase auth token for admin API calls
 */
export async function getAdminAxios() {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("Not authenticated");
    }
    
    const token = await user.getIdToken();
    
    return axios.create({
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

/**
 * Make an admin GET request with auth token
 */
export async function adminGet(url) {
    const instance = await getAdminAxios();
    return instance.get(url);
}

/**
 * Make an admin POST request with auth token
 */
export async function adminPost(url, data) {
    const instance = await getAdminAxios();
    return instance.post(url, data);
}

/**
 * Make an admin PUT request with auth token
 */
export async function adminPut(url, data) {
    const instance = await getAdminAxios();
    return instance.put(url, data);
}

