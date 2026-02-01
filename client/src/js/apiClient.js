import axios from "axios";

/**
 * Configured axios instance that includes the API key header on all requests.
 * Use this instead of importing axios directly throughout the app.
 * 
 * Usage:
 *   import api from '../js/apiClient';
 *   api.get('/some-endpoint');
 *   api.post('/some-endpoint', data);
 */

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_PREFIX || '',
});

// Add API key to every request
apiClient.interceptors.request.use(
    (config) => {
        const apiKey = import.meta.env.VITE_API_KEY;
        if (apiKey) {
            config.headers['X-API-Key'] = apiKey;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default apiClient;

/**
 * Helper to create an axios instance with both API key and custom headers
 * Useful for requests that need additional auth (like Firebase token)
 */
export function createApiInstance(additionalHeaders = {}) {
    const instance = axios.create({
        baseURL: import.meta.env.VITE_API_PREFIX || '',
        headers: additionalHeaders,
    });
    
    instance.interceptors.request.use(
        (config) => {
            const apiKey = import.meta.env.VITE_API_KEY;
            if (apiKey) {
                config.headers['X-API-Key'] = apiKey;
            }
            return config;
        },
        (error) => {
            return Promise.reject(error);
        }
    );
    
    return instance;
}
