import { get } from "../../shared/api/client.js";

function buildRangeQuery(range = {}) {
    const params = new URLSearchParams();
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);
    const query = params.toString();
    return query ? `?${query}` : "";
}

export const analyticsApi = {
    summary: (range) => get(`/analytics/summary${buildRangeQuery(range)}`),
    byService: (range) => get(`/analytics/by-service${buildRangeQuery(range)}`),
    byResponder: (range) => get(`/analytics/by-responder${buildRangeQuery(range)}`),
    trend: (range) => get(`/analytics/trend${buildRangeQuery(range)}`),
};
