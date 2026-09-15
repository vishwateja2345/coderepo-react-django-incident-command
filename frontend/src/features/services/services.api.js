import { del, get, patch, post } from "../../shared/api/client.js";

export const servicesApi = {
    list: () => get("/services"),
    get: (serviceId) => get(`/services/${serviceId}`),
    create: (values) => post("/services", values),
    update: (serviceId, values) => patch(`/services/${serviceId}`, values),
    remove: (serviceId) => del(`/services/${serviceId}`),
    rotateKey: (serviceId) => post(`/services/${serviceId}/rotate-key`),
};
