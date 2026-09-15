import { useCallback, useEffect, useMemo, useState } from "react";
import { alertsApi } from "./alerts.api.js";
import { servicesApi } from "../services/services.api.js";
import { EmptyState, ErrorBanner, Spinner } from "../../shared/components/Feedback.jsx";
import { formatRelativeTime } from "../../shared/utils/format.js";

const STATUS_FILTERS = [
    { value: "all", label: "All" },
    { value: "open", label: "Open" },
    { value: "triaged", label: "Triaged" },
];

function severityBadgeClass(severity) {
    if (severity === "critical") return "badge urgency-high";
    if (severity === "warning") return "badge status-acknowledged";
    return "badge neutral";
}

function severityLabel(severity) {
    return severity ? `${severity.charAt(0).toUpperCase()}${severity.slice(1)}` : "Unknown";
}

export function AlertsPage({ navigate, navRevision }) {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [services, setServices] = useState([]);
    const [serviceFilter, setServiceFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");

    const loadAlerts = useCallback(async ({ silent = false } = {}) => {
        if (!silent) {
            setLoading(true);
            setError("");
        }

        try {
            const nextAlerts = await alertsApi.list({
                ...(serviceFilter !== "all" ? { serviceId: serviceFilter } : {}),
                ...(statusFilter !== "all" ? { status: statusFilter } : {}),
            });
            setAlerts(Array.isArray(nextAlerts) ? nextAlerts : []);
        } catch (requestError) {
            if (!silent) setError(requestError.message || "Could not load alerts.");
        } finally {
            if (!silent) setLoading(false);
        }
    }, [serviceFilter, statusFilter]);

    const loadServices = useCallback(async () => {
        try {
            const nextServices = await servicesApi.list();
            setServices(Array.isArray(nextServices) ? nextServices : []);
        } catch {
            setServices([]);
        }
    }, []);

    useEffect(() => {
        loadServices();
    }, [loadServices]);

    useEffect(() => {
        loadAlerts();
    }, [loadAlerts, navRevision]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            loadAlerts({ silent: true });
        }, 15000);

        return () => window.clearInterval(timer);
    }, [loadAlerts]);

    const serviceFilters = useMemo(() => [{ value: "all", label: "All services" }, ...services.map((service) => ({ value: service._id, label: service.name }))], [services]);

    return (
        <>
            <div className="page-header">
                <div>
                    <h2>Alerts</h2>
                    <p className="subtitle">Raw monitoring events are grouped and deduplicated into incidents automatically so responders can focus on action.</p>
                </div>
            </div>

            <div className="page-toolbar">
                <div className="chip-group" aria-label="Filter alerts by service">
                    {serviceFilters.map((filter) => (
                        <button
                            key={filter.value}
                            className={`chip ${serviceFilter === filter.value ? "active" : ""}`}
                            type="button"
                            onClick={() => setServiceFilter(filter.value)}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>
                <div className="spacer" />
                <div className="chip-group" aria-label="Filter alerts by status">
                    {STATUS_FILTERS.map((filter) => (
                        <button
                            key={filter.value}
                            className={`chip ${statusFilter === filter.value ? "active" : ""}`}
                            type="button"
                            onClick={() => setStatusFilter(filter.value)}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? <Spinner label="Loading alerts" /> : null}
            {!loading && error ? <ErrorBanner message={error} onRetry={() => loadAlerts()} /> : null}
            {!loading && !error && !alerts.length ? (
                <EmptyState description="Incoming monitoring events will show up here once they are received." icon="alerts" title="No alerts" />
            ) : null}
            {!loading && !error && alerts.length ? (
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th scope="col">Severity</th>
                                <th scope="col">Summary</th>
                                <th scope="col">Service</th>
                                <th scope="col">Source</th>
                                <th scope="col">Occurrences</th>
                                <th scope="col">Received</th>
                                <th scope="col">Incident</th>
                            </tr>
                        </thead>
                        <tbody>
                            {alerts.map((alert) => (
                                <tr key={alert._id}>
                                    <td><span className={severityBadgeClass(alert.severity)}>{severityLabel(alert.severity)}</span></td>
                                    <td>{alert.summary}</td>
                                    <td>{alert.serviceName}</td>
                                    <td>{alert.source}</td>
                                    <td>
                                        {alert.occurrenceCount}
                                        {alert.occurrenceCount > 1 ? <> <span className="badge neutral">×{alert.occurrenceCount}</span></> : null}
                                    </td>
                                    <td>{formatRelativeTime(alert.receivedAt)}</td>
                                    <td>
                                        {alert.incidentId ? (
                                            <button
                                                className="button ghost small"
                                                title="Opens the Incidents section"
                                                type="button"
                                                onClick={() => navigate("incidents")}
                                            >
                                                View incident
                                            </button>
                                        ) : (
                                            <span className="kv-label">—</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : null}
        </>
    );
}
