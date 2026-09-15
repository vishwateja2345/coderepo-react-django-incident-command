import { initials } from "../utils/format.js";

const INCIDENT_STATUS_LABEL = { triggered: "Triggered", acknowledged: "Acknowledged", resolved: "Resolved" };
const SERVICE_STATUS_LABEL = {
    operational: "Operational",
    degraded_performance: "Degraded performance",
    partial_outage: "Partial outage",
    major_outage: "Major outage",
};
const URGENCY_LABEL = { high: "High urgency", low: "Low urgency" };

export function StatusBadge({ status, kind = "incident" }) {
    const label = kind === "incident" ? INCIDENT_STATUS_LABEL[status] : SERVICE_STATUS_LABEL[status];
    return <span className={`badge status-${status}`}>{label || status}</span>;
}

export function UrgencyBadge({ urgency }) {
    return <span className={`badge urgency-${urgency}`}>{URGENCY_LABEL[urgency] || urgency}</span>;
}

export function Avatar({ name, color = "#5b8cff", size = "medium" }) {
    return (
        <span className={`avatar avatar-${size}`} style={{ "--avatar-color": color }} title={name}>
            <span>{initials(name)}</span>
        </span>
    );
}
