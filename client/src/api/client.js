import axios from "axios";

// Add the configured shared API key to requests from this Axios instance.
function addApiKeyInterceptor(instance) {
    // The dedicated instance needs its own key hook alongside global Axios defaults.
    instance.interceptors.request.use(
        (config) => {
            // Attach the API-key header when the frontend configuration supplies one.
            const apiKey = import.meta.env.VITE_API_KEY;
            if (apiKey) {
                config.headers['X-API-Key'] = apiKey;
            }
            return config;
        },
        /* Propagate interceptor failures to the request caller. */ (error) => Promise.reject(error)
    );
    return instance;
}

const apiClient = addApiKeyInterceptor(axios.create({
    baseURL: import.meta.env.VITE_API_PREFIX || '',
}));

export default apiClient;
