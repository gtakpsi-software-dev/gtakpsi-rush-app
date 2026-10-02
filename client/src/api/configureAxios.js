import axios from "axios";

const apiKey = import.meta.env.VITE_API_KEY;

if (apiKey) {
    // Older request paths use global Axios, so configure it before the app renders.
    axios.defaults.headers.common['X-API-Key'] = apiKey;
    console.log('API key configured for axios requests');
} else {
    console.warn('VITE_API_KEY not set - API requests may be rejected');
}

export default axios;
