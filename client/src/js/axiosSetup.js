import axios from "axios";

/**
 * Configure axios defaults to include API key on all requests.
 * This file should be imported early in the app (e.g., in main.jsx)
 * to ensure all axios requests include the API key.
 */

const apiKey = import.meta.env.VITE_API_KEY;

if (apiKey) {
    // Add API key to all axios requests globally
    axios.defaults.headers.common['X-API-Key'] = apiKey;
    console.log('API key configured for axios requests');
} else {
    console.warn('VITE_API_KEY not set - API requests may be rejected');
}

export default axios;
