import axios from "axios";
import { auth } from "../../firebase";

// Create an Axios instance with the current Firebase token and optional API-key header.
export async function getAdminAxios() {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("Not authenticated");
    }

    // Get the current user's token for each admin request. Never cache it in
    // shared defaults or expose it to rendered UI or stored state.
    const token = await user.getIdToken();
    const apiKey = import.meta.env.VITE_API_KEY;

    const headers = {
        Authorization: `Bearer ${token}`,
    };

    if (apiKey) {
        headers['X-API-Key'] = apiKey;
    }

    return axios.create({
        headers,
    });
}

// Send an authenticated admin GET request.
export async function adminGet(url) {
    const instance = await getAdminAxios();
    return instance.get(url);
}

// Send an authenticated admin POST request.
export async function adminPost(url, data) {
    const instance = await getAdminAxios();
    return instance.post(url, data);
}

// Send an authenticated admin PUT request.
export async function adminPut(url, data) {
    const instance = await getAdminAxios();
    return instance.put(url, data);
}
