import { useCallback, useEffect, useMemo, useState } from "react";
import { incidentsApi } from "../incidents/incidents.api.js";
import { oncallApi } from "../oncall/oncall.api.js";
import { analyticsApi } from "../analytics/analytics.api.js";
import { statuspageApi } from "../statuspage/statuspage.api.js";
import { Avatar, StatusBadge, UrgencyBadge } from "../../shared/components/Badge.jsx";
import { EmptyState, ErrorBanner, Spinner } from "../../shared/components/Feedback.jsx";
import { formatDuration, formatRelativeTime } from "../../shared/utils/format.js";

function getFirstName(name) {
    return name?.trim()?.split(/\s+/)?.[0] || "there";
}

function StatCard({ error, label, loading, meta, value }) {
    return (
        <div className="stat-card">
            <div className="stat-label">{label}</div>
            {loading ? <Spinner label={`Loading ${label}`} /> : error ? <ErrorBanner message={error} /> : <div className="stat-value">{value}</div>}
            {!loading && !error ? <div className="stat-meta">{meta}</div> : null}
        </div>
    );
}

export function DashboardPage({ currentResponder, navigate, navRevision }) {
    const [incidentsState, setIncidentsState] = useState({ loading: true, error: "", data: [] });
    const [onCallState, setOnCallState] = useState({ loading: true, error: "", data: [] });
    const [analyticsState, setAnalyticsState] = useState({ loading: true, error: "", data: null });
    const [statusState, setStatusState] = useState({ loading: true, error: "", data: null });

    const loadIncidents = useCallback(async () => {
        setIncidentsState((current) => ({ ...current, loading: true, error: "" }));
        try {
            const data = await incidentsApi.list();
            setIncidentsState({ loading: false, error: "", data: Array.isArray(data) ? data : [] });
        } catch (requestError) {
            setIncidentsState({ loading: false, error: requestError.message || "Could not load incidents.", data: [] });
        }
    }, []);

    const loadOnCall = useCallback(async () => {
        setOnCallState((current) => ({ ...current, loading: true, error: "" }));
        try {
            const data = await oncallApi.list();
            setOnCallState({ loading: false, error: "", data: Array.isArray(data) ? data : [] });
        } catch (requestError) {
            setOnCallState({ loading: false, error: requestError.message || "Could not load on-call schedules.", data: [] });
        }
    }, []);

    const loadAnalytics = useCallback(async () => {
        setAnalyticsState((current) => ({ ...current, loading: true, error: "" }));
        try {
            const data = await analyticsApi.summary();
            setAnalyticsState({ loading: false, error: "", data: data || null });
        } catch (requestError) {
            setAnalyticsState({ loading: false, error: requestError.message || "Could not load analytics.", data: null });
        }
    }, []);

    const loadStatusOverview = useCallback(async () => {
        setStatusState((current) => ({ ...current, loading: true, error: "" }));
        try {
            const data = await statuspageApi.overview();
            setStatusState({ loading: false, error: "", data: data || null });
        } catch (requestError) {
            setStatusState({ loading: false, error: requestError.message || "Could not load service health.", data: null });
        }
    }, []);

    useEffect(() => {
        loadIncidents();
        loadOnCall();
        loadAnalytics();
        loadStatusOverview();
    }, [loadAnalytics, loadIncidents, loadOnCall, loadStatusOverview, navRevision]);

    const openIncidents = useMemo(() => incidentsState.data.filter((incident) => incident.status !== "resolved"), [incidentsState.data]);
    const highUrgencyOpenIncidents = useMemo(() => openIncidents.filter((incident) => incident.urgency === "high"), [openIncidents]);
    const recentIncidents = useMemo(() => incidentsState.data.slice(0, 6), [incidentsState.data]);
    const serviceRows = statusState.data?.services || [];
    const servicesAtRisk = serviceRows.filter((service) => service.status !== "operational").length;

    return (
        <>
            <div className="page-header">
                <div>
                    <h2>Welcome back, {getFirstName(currentResponder.name)}</h2>
                    <p className="subtitle">Keep an eye on active incidents, on-call coverage, and service health from one place.</p>
                </div>
            </div>

            <div className="card-grid">
                <StatCard
                    error={incidentsState.error}
                    label="Open incidents"
                    loading={incidentsState.loading}
                    meta={openIncidents.length ? `${openIncidents.length} currently need attention` : "Nothing active right now"}
                    value={openIncidents.length}
                />
                <StatCard
                    error={incidentsState.error}
                    label="Critical open incidents"
                    loading={incidentsState.loading}
                    meta={highUrgencyOpenIncidents.length ? "High urgency incidents are active" : "No high urgency incidents"}
                    value={highUrgencyOpenIncidents.length}
                />
                <StatCard
                    error={statusState.error}
                    label="Services at risk"
                    loading={statusState.loading}
                    meta={servicesAtRisk ? "Operational status is degraded" : "All services are operational"}
                    value={servicesAtRisk}
                />
                <StatCard
                    error={analyticsState.error}
                    label="Avg time to acknowledge"
                    loading={analyticsState.loading}
                    meta="Based on the last 90 days"
                    value={formatDuration(analyticsState.data?.avgMttaSeconds)}
                />
                <StatCard
                    error={analyticsState.error}
                    label="Avg time to resolve"
                    loading={analyticsState.loading}
                    meta="Based on the last 90 days"
                    value={formatDuration(analyticsState.data?.avgMttrSeconds)}
                />
            </div>

            <div className="detail-grid">
                <div>
                    <div className="detail-section">
                        <div className="card">
                            <div className="card-header">
                                <h3>Currently on-call</h3>
                            </div>
                            <div className="card-body">
                                {onCallState.loading ? <Spinner label="Loading on-call coverage" /> : null}
                                {!onCallState.loading && onCallState.error ? <ErrorBanner message={onCallState.error} onRetry={loadOnCall} /> : null}
                                {!onCallState.loading && !onCallState.error && !onCallState.data.length ? (
                                    <EmptyState description="Create an on-call schedule to show who is covering each service." icon="oncall" title="No schedules" />
                                ) : null}
                                {!onCallState.loading && !onCallState.error && onCallState.data.length ? (
                                    <div className="checklist">
                                        {onCallState.data.map((schedule) => (
                                            <div key={schedule._id} className="responder-card">
                                                <Avatar color="#5b8cff" name={schedule.currentResponderName || "Unassigned"} size="medium" />
                                                <div className="responder-meta">
                                                    <strong>{schedule.currentResponderName || "Unassigned"}</strong>
                                                    <span>{schedule.name}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <h3>Recent incidents</h3>
                            <div className="page-header-actions">
                                <button className="button ghost small" type="button" onClick={() => navigate("incidents")}>
                                    View all
                                </button>
                            </div>
                        </div>
                        <div className="card-body">
                            {incidentsState.loading ? <Spinner label="Loading recent incidents" /> : null}
                            {!incidentsState.loading && incidentsState.error ? <ErrorBanner message={incidentsState.error} onRetry={loadIncidents} /> : null}
                            {!incidentsState.loading && !incidentsState.error && !recentIncidents.length ? (
                                <EmptyState description="New incidents will appear here once they are opened." icon="incidents" title="No incidents yet" />
                            ) : null}
                            {!incidentsState.loading && !incidentsState.error && recentIncidents.length ? (
                                <div className="table-wrap">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th scope="col">Status</th>
                                                <th scope="col">Title</th>
                                                <th scope="col">Service</th>
                                                <th scope="col">Urgency</th>
                                                <th scope="col">Opened</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {recentIncidents.map((incident) => (
                                                <tr key={incident._id}>
                                                    <td><StatusBadge kind="incident" status={incident.status} /></td>
                                                    <td>{incident.title}</td>
                                                    <td>{incident.serviceName}</td>
                                                    <td><UrgencyBadge urgency={incident.urgency} /></td>
                                                    <td>{formatRelativeTime(incident.createdAt)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>

                <div>
                    <div className="card">
                        <div className="card-header">
                            <h3>Service health</h3>
                            <div className="page-header-actions">
                                <button className="button ghost small" type="button" onClick={() => navigate("statuspage")}>
                                    View status page
                                </button>
                            </div>
                        </div>
                        <div className="card-body">
                            {statusState.loading ? <Spinner label="Loading service health" /> : null}
                            {!statusState.loading && statusState.error ? <ErrorBanner message={statusState.error} onRetry={loadStatusOverview} /> : null}
                            {!statusState.loading && !statusState.error && !serviceRows.length ? (
                                <EmptyState description="Active services will appear here once they are configured." icon="statuspage" title="No services" />
                            ) : null}
                            {!statusState.loading && !statusState.error && serviceRows.length ? (
                                <div className="kv-list">
                                    {serviceRows.map((service) => (
                                        <div key={service.serviceId} className="kv-row">
                                            <div>
                                                <div>{service.serviceName}</div>
                                                <div className="stat-meta">{service.openIncidentCount} open incident{service.openIncidentCount === 1 ? "" : "s"}</div>
                                            </div>
                                            <div className="kv-value">
                                                <StatusBadge kind="service" status={service.status} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
