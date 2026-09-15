import { get, patch, post } from "../../shared/api/client.js";

export const respondersApi = {
    list: (includeInactive = false) => get(`/responders${includeInactive ? "?all=true" : ""}`),
    get: (responderId) => get(`/responders/${responderId}`),
    create: (values) => post("/responders", values),
    update: (responderId, values) => patch(`/responders/${responderId}`, values),
};
