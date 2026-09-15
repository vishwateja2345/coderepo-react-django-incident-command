import { get } from "../../shared/api/client.js";

export const alertsApi = {
    list: (filters = {}) => {
        const params = new URLSearchParams();
        if (filters.serviceId) params.set("serviceId", filters.serviceId);
        if (filters.status) params.set("status", filters.status);
        const query = params.toString();
        return get(`/alerts${query ? `?${query}` : ""}`);
    },
    get: (eventId) => get(`/alerts/${eventId}`),
};
