import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { statuspageApi } from "./statuspage.api.js";
import { StatusBadge } from "../../shared/components/Badge.jsx";
import { EmptyState, ErrorBanner, Spinner } from "../../shared/components/Feedback.jsx";
import { Icon } from "../../shared/components/Icon.jsx";
import { formatDateTime } from "../../shared/utils/format.js";

const STATUS_PRIORITY = {
    major_outage: 0,
    partial_outage: 1,
    degraded_performance: 2,
    operational: 3,
};

function getMessage(error, fallback) {
    return error?.message || fallback;
}

export function StatusPagePage({ navRevision }) {
    const mountedRef = useRef(true);
    const [overview, setOverview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const refreshOverview = useCallback(async (showSpinner = false) => {
        if (showSpinner) setLoading(true);
        else setRefreshing(true);
        setError("");
        try {
            const data = await statuspageApi.overview();
            if (!mountedRef.current) return;
            setOverview(data);
        } catch (requestError) {
            if (!mountedRef.current) return;
            setError(getMessage(requestError, "Unable to load the status page overview."));
        } finally {
            if (!mountedRef.current) return;
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        refreshOverview(true);
        const intervalId = window.setInterval(() => {
            refreshOverview(false);
        }, 20000);

        return () => window.clearInterval(intervalId);
    }, [refreshOverview, navRevision]);

    const services = useMemo(() => {
        const rows = Array.isArray(overview?.services) ? [...overview.services] : [];
        return rows.sort((a, b) => {
            const priority = (STATUS_PRIORITY[a.status] ?? 99) - (STATUS_PRIORITY[b.status] ?? 99);
            if (priority !== 0) return priority;
            return (a.serviceName || "").localeCompare(b.serviceName || "");
        });
    }, [overview]);

    const impactedServices = services.filter((service) => service.status !== "operational");
    const allOperational = services.length > 0 && impactedServices.length === 0;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Status Page</h2>
                    <p className="subtitle">The stakeholder-facing summary of current service health and active incident impact.</p>
                </div>
                <div className="page-header-actions">
                    <span style={{ color: "var(--quiet)", fontSize: 12.5 }}>
                        Updated {overview?.updatedAt ? formatDateTime(overview.updatedAt) : "—"}
                    </span>
                    <button
                        aria-label="Refresh status page"
                        className="icon-button"
                        disabled={refreshing}
                        title="Refresh"
                        type="button"
                        onClick={() => refreshOverview(false)}
                    >
                        <Icon name="refresh" size={18} />
                    </button>
                </div>
            </div>

            {loading ? (
                <Spinner label="Loading status page" />
            ) : error ? (
                <ErrorBanner message={error} onRetry={() => refreshOverview(true)} />
            ) : !services.length ? (
                <EmptyState description="No active services are currently available for the public status page." icon="statuspage" title="No services to display" />
            ) : (
                <div style={{ display: "grid", gap: 18 }}>
                    <div
                        className="card"
                        style={allOperational
                            ? { borderColor: "var(--success)", background: "var(--success-container)" }
                            : { borderColor: "var(--warning)", background: "var(--warning-container)" }}
                    >
                        <div className="card-body" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <Icon name={allOperational ? "check_circle" : "error"} size={24} />
                            <div>
                                <h3>{allOperational ? "All systems operational" : `${impactedServices.length} impacted service${impactedServices.length === 1 ? "" : "s"}`}</h3>
                                <p style={{ color: "inherit", marginTop: 4 }}>
                                    {allOperational
                                        ? "Stakeholders can see that every monitored service is currently healthy."
                                        : "Stakeholders should expect active communication for degraded or unavailable services."}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="card-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
                        {services.map((service) => (
                            <div className="card" key={service.serviceId || service.serviceName}>
                                <div className="card-header">
                                    <h3>{service.serviceName}</h3>
                                </div>
                                <div className="card-body" style={{ display: "grid", gap: 12 }}>
                                    <StatusBadge kind="service" status={service.status} />
                                    {service.openIncidentCount > 0 && (
                                        <div style={{ color: "var(--muted)", fontSize: 13 }}>
                                            {service.openIncidentCount} open incident{service.openIncidentCount === 1 ? "" : "s"}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
