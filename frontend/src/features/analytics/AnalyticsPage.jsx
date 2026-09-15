import { useEffect, useMemo, useState } from "react";
import { analyticsApi } from "./analytics.api.js";
import { EmptyState, ErrorBanner, Spinner } from "../../shared/components/Feedback.jsx";
import { formatDay, formatDuration } from "../../shared/utils/format.js";
import { notify } from "../../shared/utils/toast.js";

function createCardState() {
    return { loading: true, error: "", data: null };
}

function getMessage(error, fallback) {
    return error?.message || fallback;
}

function formatAveragePair(row) {
    return `Avg ack ${formatDuration(row.avgMttaSeconds)} · Avg resolve ${formatDuration(row.avgMttrSeconds)}`;
}

function ChartCard({ title, state, emptyTitle, emptyDescription, retryLabel, children }) {
    return (
        <div className="card">
            <div className="card-header">
                <h3>{title}</h3>
            </div>
            <div className="card-body">
                {state.loading ? (
                    <Spinner label={`Loading ${retryLabel}`} />
                ) : state.error ? (
                    <ErrorBanner message={state.error} onRetry={state.onRetry} />
                ) : state.isEmpty ? (
                    <EmptyState description={emptyDescription} icon="analytics" title={emptyTitle} />
                ) : children}
            </div>
        </div>
    );
}

function Sparkline({ buckets }) {
    const width = 300;
    const height = 80;
    const padding = 12;
    const counts = buckets.map((bucket) => bucket.incidentCount || 0);
    const maxCount = Math.max(...counts, 1);
    const points = buckets.map((bucket, index) => {
        const x = buckets.length === 1 ? width / 2 : (index * (width - padding * 2)) / (buckets.length - 1) + padding;
        const y = height - padding - ((bucket.incidentCount || 0) / maxCount) * (height - padding * 2);
        return { x, y, value: bucket.incidentCount || 0 };
    });

    return (
        <svg aria-label="Incident trend" className="sparkline" role="img" viewBox={`0 0 ${width} ${height}`}>
            <polyline
                fill="none"
                points={points.map((point) => `${point.x},${point.y}`).join(" ")}
                stroke="var(--accent)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
            />
            {points.map((point, index) => (
                <circle cx={point.x} cy={point.y} fill="var(--accent)" key={`trend-point-${index}`} r="3.5">
                    <title>{point.value} incidents</title>
                </circle>
            ))}
        </svg>
    );
}

export function AnalyticsPage({ navRevision }) {
    const [fromInput, setFromInput] = useState("");
    const [toInput, setToInput] = useState("");
    const [rangeError, setRangeError] = useState("");
    const [appliedRange, setAppliedRange] = useState({});
    const [reloadKey, setReloadKey] = useState(0);
    const [summaryState, setSummaryState] = useState(createCardState);
    const [serviceState, setServiceState] = useState(createCardState);
    const [responderState, setResponderState] = useState(createCardState);
    const [trendState, setTrendState] = useState(createCardState);

    const range = useMemo(() => {
        if (!appliedRange.from || !appliedRange.to) return {};
        return { from: appliedRange.from, to: appliedRange.to };
    }, [appliedRange]);

    useEffect(() => {
        let cancelled = false;

        setSummaryState({ loading: true, error: "", data: null });
        analyticsApi.summary(range)
            .then((data) => {
                if (cancelled) return;
                setSummaryState({ loading: false, error: "", data });
            })
            .catch((error) => {
                if (cancelled) return;
                setSummaryState({ loading: false, error: getMessage(error, "Unable to load summary metrics."), data: null });
            });

        setServiceState({ loading: true, error: "", data: null });
        analyticsApi.byService(range)
            .then((data) => {
                if (cancelled) return;
                setServiceState({ loading: false, error: "", data: Array.isArray(data) ? data : [] });
            })
            .catch((error) => {
                if (cancelled) return;
                setServiceState({ loading: false, error: getMessage(error, "Unable to load service analytics."), data: null });
            });

        setResponderState({ loading: true, error: "", data: null });
        analyticsApi.byResponder(range)
            .then((data) => {
                if (cancelled) return;
                setResponderState({ loading: false, error: "", data: Array.isArray(data) ? data : [] });
            })
            .catch((error) => {
                if (cancelled) return;
                setResponderState({ loading: false, error: getMessage(error, "Unable to load responder analytics."), data: null });
            });

        setTrendState({ loading: true, error: "", data: null });
        analyticsApi.trend(range)
            .then((data) => {
                if (cancelled) return;
                setTrendState({ loading: false, error: "", data: Array.isArray(data) ? data : [] });
            })
            .catch((error) => {
                if (cancelled) return;
                setTrendState({ loading: false, error: getMessage(error, "Unable to load trend analytics."), data: null });
            });

        return () => {
            cancelled = true;
        };
    }, [range.from, range.to, navRevision, reloadKey]);

    const handleApply = (event) => {
        event.preventDefault();
        setRangeError("");

        if ((fromInput && !toInput) || (!fromInput && toInput)) {
            setRangeError("Choose both a start date and an end date.");
            notify("Choose both a start date and an end date.", "error");
            return;
        }

        if (fromInput && toInput && new Date(fromInput) > new Date(toInput)) {
            setRangeError("The start date must be before the end date.");
            notify("The start date must be before the end date.", "error");
            return;
        }

        if (!fromInput && !toInput) {
            setAppliedRange({});
            setReloadKey((value) => value + 1);
            return;
        }

        setAppliedRange({ from: new Date(fromInput).toISOString(), to: new Date(toInput).toISOString() });
        setReloadKey((value) => value + 1);
    };

    const serviceRows = Array.isArray(serviceState.data) ? serviceState.data : [];
    const responderRows = Array.isArray(responderState.data) ? responderState.data : [];
    const trendRows = Array.isArray(trendState.data) ? trendState.data : [];
    const serviceMax = Math.max(...serviceRows.map((row) => row.incidentCount || 0), 1);
    const responderMax = Math.max(...responderRows.map((row) => row.incidentCount || 0), 1);

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Analytics</h2>
                    <p className="subtitle">Review acknowledgment, resolution, and ownership trends after incidents close.</p>
                </div>
            </div>

            <form className="page-toolbar" onSubmit={handleApply}>
                <div className="field" style={{ minWidth: 170 }}>
                    <label htmlFor="analytics-from">From</label>
                    <input id="analytics-from" type="date" value={fromInput} onChange={(event) => setFromInput(event.target.value)} />
                </div>
                <div className="field" style={{ minWidth: 170 }}>
                    <label htmlFor="analytics-to">To</label>
                    <input id="analytics-to" type="date" value={toInput} onChange={(event) => setToInput(event.target.value)} />
                </div>
                <div style={{ alignSelf: "end" }}>
                    <button className="button primary" type="submit">Apply</button>
                </div>
            </form>
            {rangeError && <div className="form-error-banner" role="alert" style={{ marginBottom: 18 }}>{rangeError}</div>}

            {summaryState.loading ? (
                <Spinner label="Loading analytics summary" />
            ) : summaryState.error ? (
                <ErrorBanner message={summaryState.error} onRetry={() => setReloadKey((value) => value + 1)} />
            ) : (
                <div className="card-grid" style={{ marginBottom: 18 }}>
                    <div className="stat-card">
                        <span className="stat-label">Total incidents</span>
                        <span className="stat-value">{summaryState.data?.totalIncidents ?? 0}</span>
                        <span className="stat-meta">Across the selected reporting window.</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-label">Open</span>
                        <span className="stat-value">{summaryState.data?.openCount ?? 0}</span>
                        <span className="stat-meta">Incidents that remained unresolved in this range.</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-label">Resolved</span>
                        <span className="stat-value">{summaryState.data?.resolvedCount ?? 0}</span>
                        <span className="stat-meta">Incidents closed during this reporting window.</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-label">Avg time to acknowledge</span>
                        <span className="stat-value">{formatDuration(summaryState.data?.avgMttaSeconds)}</span>
                        <span className="stat-meta">Mean time from trigger to first acknowledgment.</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-label">Avg time to resolve</span>
                        <span className="stat-value">{formatDuration(summaryState.data?.avgMttrSeconds)}</span>
                        <span className="stat-meta">Mean time from trigger to resolution.</span>
                    </div>
                </div>
            )}

            <div className="detail-grid">
                <ChartCard
                    emptyDescription="No incidents in this range have been grouped to a service yet."
                    emptyTitle="No service analytics"
                    retryLabel="service analytics"
                    state={{
                        ...serviceState,
                        isEmpty: !serviceState.loading && !serviceState.error && serviceRows.length === 0,
                        onRetry: () => setReloadKey((value) => value + 1),
                    }}
                    title="By service"
                >
                    <div className="bar-chart">
                        {serviceRows.map((row) => (
                            <div key={row.serviceId || row.serviceName}>
                                <div className="bar-row">
                                    <span title={row.serviceName}>{row.serviceName}</span>
                                    <span className="bar-track">
                                        <span className="bar-fill" style={{ width: `${((row.incidentCount || 0) / serviceMax) * 100}%` }} />
                                    </span>
                                    <span>{row.incidentCount}</span>
                                </div>
                                <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--quiet)", textAlign: "right" }}>
                                    {formatAveragePair(row)}
                                </div>
                            </div>
                        ))}
                    </div>
                </ChartCard>

                <ChartCard
                    emptyDescription="No incidents in this range were assigned to a responder."
                    emptyTitle="No responder analytics"
                    retryLabel="responder analytics"
                    state={{
                        ...responderState,
                        isEmpty: !responderState.loading && !responderState.error && responderRows.length === 0,
                        onRetry: () => setReloadKey((value) => value + 1),
                    }}
                    title="By responder"
                >
                    <div className="bar-chart">
                        {responderRows.map((row) => (
                            <div key={row.responderId || row.responderName}>
                                <div className="bar-row">
                                    <span title={row.responderName}>{row.responderName}</span>
                                    <span className="bar-track">
                                        <span className="bar-fill" style={{ width: `${((row.incidentCount || 0) / responderMax) * 100}%` }} />
                                    </span>
                                    <span>{row.incidentCount}</span>
                                </div>
                                <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--quiet)", textAlign: "right" }}>
                                    {formatAveragePair(row)}
                                </div>
                            </div>
                        ))}
                    </div>
                </ChartCard>
            </div>

            <div className="card" style={{ marginTop: 18 }}>
                <div className="card-header">
                    <h3>Trend</h3>
                </div>
                <div className="card-body">
                    {trendState.loading ? (
                        <Spinner label="Loading trend analytics" />
                    ) : trendState.error ? (
                        <ErrorBanner message={trendState.error} onRetry={() => setReloadKey((value) => value + 1)} />
                    ) : trendRows.length === 0 || trendRows.every((bucket) => (bucket.incidentCount || 0) === 0) ? (
                        <EmptyState description="No incidents fell into the selected weekly buckets." icon="analytics" title="No incidents in this range" />
                    ) : (
                        <div style={{ display: "grid", gap: 18 }}>
                            <div>
                                <Sparkline buckets={trendRows} />
                            </div>
                            <div className="table-wrap">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Bucket</th>
                                            <th>Incidents</th>
                                            <th>Avg ack</th>
                                            <th>Avg resolve</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {trendRows.map((bucket, index) => (
                                            <tr key={`${bucket.bucketStart}-${index}`}>
                                                <td>{formatDay(bucket.bucketStart)}–{formatDay(bucket.bucketEnd)}</td>
                                                <td>{bucket.incidentCount || 0}</td>
                                                <td>{formatDuration(bucket.avgMttaSeconds)}</td>
                                                <td>{formatDuration(bucket.avgMttrSeconds)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
