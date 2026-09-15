import { get, patch, post } from "../../shared/api/client.js";

export const incidentsApi = {
    list: (filters = {}) => {
        const params = new URLSearchParams();
        if (filters.serviceId) params.set("serviceId", filters.serviceId);
        if (filters.status) params.set("status", filters.status);
        if (filters.assigneeId) params.set("assigneeId", filters.assigneeId);
        const query = params.toString();
        return get(`/incidents${query ? `?${query}` : ""}`);
    },
    get: (incidentId) => get(`/incidents/${incidentId}`),
    create: (values) => post("/incidents", values),
    update: (incidentId, values) => patch(`/incidents/${incidentId}`, values),
    acknowledge: (incidentId) => post(`/incidents/${incidentId}/acknowledge`),
    assign: (incidentId, responderId) => post(`/incidents/${incidentId}/assign`, { responderId }),
    escalate: (incidentId) => post(`/incidents/${incidentId}/escalate`),
    addNote: (incidentId, message, customerFacing) => post(`/incidents/${incidentId}/notes`, { message, customerFacing }),
    resolve: (incidentId) => post(`/incidents/${incidentId}/resolve`),
    getWorkflow: (incidentId) => get(`/incidents/${incidentId}/workflow`),
};
