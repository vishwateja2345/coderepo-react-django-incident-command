import { del, get, patch, post } from "../../shared/api/client.js";

export const workflowsApi = {
    listTemplates: (serviceId) => get(`/workflow-templates${serviceId ? `?serviceId=${serviceId}` : ""}`),
    getTemplate: (templateId) => get(`/workflow-templates/${templateId}`),
    createTemplate: (values) => post("/workflow-templates", values),
    updateTemplate: (templateId, values) => patch(`/workflow-templates/${templateId}`, values),
    removeTemplate: (templateId) => del(`/workflow-templates/${templateId}`),
    getIncidentWorkflow: (incidentId) => get(`/incidents/${incidentId}/workflow`),
    toggleStep: (instanceId, order, done) => patch(`/workflow-instances/${instanceId}/steps/${order}`, { done }),
};
