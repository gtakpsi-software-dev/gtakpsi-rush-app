import axios from "axios";

function addApiKeyInterceptor(instance) {
    // Both client variants must apply the same key gate when a request is sent.
    instance.interceptors.request.use(
        (config) => {
            const apiKey = import.meta.env.VITE_API_KEY;
            if (apiKey) {
                config.headers['X-API-Key'] = apiKey;
            }
            return config;
        },
        (error) => Promise.reject(error)
    );
    return instance;
}

const apiClient = addApiKeyInterceptor(axios.create({
    baseURL: import.meta.env.VITE_API_PREFIX || '',
}));

export default apiClient;
