import axios from "axios";
import { auth } from "../../firebase";

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

export async function adminGet(url) {
    const instance = await getAdminAxios();
    return instance.get(url);
}

export async function adminPost(url, data) {
    const instance = await getAdminAxios();
    return instance.post(url, data);
}

export async function adminPut(url, data) {
    const instance = await getAdminAxios();
    return instance.put(url, data);
}
