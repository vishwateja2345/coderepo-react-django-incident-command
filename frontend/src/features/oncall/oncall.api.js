import { del, get, patch, post } from "../../shared/api/client.js";

export const oncallApi = {
    list: () => get("/schedules"),
    get: (scheduleId) => get(`/schedules/${scheduleId}`),
    create: (values) => post("/schedules", values),
    update: (scheduleId, values) => patch(`/schedules/${scheduleId}`, values),
    remove: (scheduleId) => del(`/schedules/${scheduleId}`),
    oncallNow: (scheduleId) => get(`/schedules/${scheduleId}/oncall-now`),
    shifts: (scheduleId) => get(`/schedules/${scheduleId}/shifts`),
    listOverrides: (scheduleId) => get(`/schedules/${scheduleId}/overrides`),
    addOverride: (scheduleId, values) => post(`/schedules/${scheduleId}/overrides`, values),
    removeOverride: (scheduleId, overrideId) => del(`/schedules/${scheduleId}/overrides/${overrideId}`),
};
