import { del, get, patch, post } from "../../shared/api/client.js";

export const escalationsApi = {
    list: () => get("/escalation-policies"),
    get: (policyId) => get(`/escalation-policies/${policyId}`),
    create: (values) => post("/escalation-policies", values),
    update: (policyId, values) => patch(`/escalation-policies/${policyId}`, values),
    remove: (policyId) => del(`/escalation-policies/${policyId}`),
};
