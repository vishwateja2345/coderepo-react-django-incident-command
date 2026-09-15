import { useCallback, useEffect, useMemo, useState } from "react";
import { incidentsApi } from "./incidents.api.js";
import { respondersApi } from "../responders/responders.api.js";
import { workflowsApi } from "../workflows/workflows.api.js";
import { Avatar, StatusBadge, UrgencyBadge } from "../../shared/components/Badge.jsx";
import { ConfirmDialog, EmptyState, ErrorBanner, Spinner } from "../../shared/components/Feedback.jsx";
import { Icon } from "../../shared/components/Icon.jsx";
import { formatDateTime } from "../../shared/utils/format.js";
import { notify } from "../../shared/utils/toast.js";

const TIMELINE_ICONS = {
    triggered: "zap",
    escalated: "zap",
    acknowledged: "check",
    resolved: "check_circle",
    note: "note",
    status_update: "megaphone",
    assigned: "user",
};

function assigneeLabel(incident) {
    return incident.assigneeName || "Unassigned";
}

export function IncidentDetail({ currentResponder, incidentId, onBack, onDataChanged, onListRefresh }) {
    const [incident, setIncident] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [tab, setTab] = useState("timeline");

    const [workflow, setWorkflow] = useState(null);
    const [workflowLoading, setWorkflowLoading] = useState(true);
    const [workflowError, setWorkflowError] = useState("");
    const [workflowBusyOrder, setWorkflowBusyOrder] = useState(null);

    const [noteMessage, setNoteMessage] = useState("");
    const [customerFacing, setCustomerFacing] = useState(false);
    const [noteBusy, setNoteBusy] = useState(false);

    const [showAssignPicker, setShowAssignPicker] = useState(false);
    const [responders, setResponders] = useState([]);
    const [respondersLoading, setRespondersLoading] = useState(false);
    const [respondersError, setRespondersError] = useState("");
    const [selectedResponderId, setSelectedResponderId] = useState("");
    const [assignBusy, setAssignBusy] = useState(false);

    const [actionBusy, setActionBusy] = useState("");
    const [confirmResolve, setConfirmResolve] = useState(false);

    const loadIncident = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const nextIncident = await incidentsApi.get(incidentId);
            setIncident(nextIncident);
            setSelectedResponderId(nextIncident.assigneeId || "");
        } catch (requestError) {
            if (requestError.code === "INCIDENT_NOT_FOUND") {
                notify("That incident is no longer available.", "info");
                onListRefresh?.();
                onBack();
                return;
            }
            setError(requestError.message || "Could not load incident details.");
        } finally {
            setLoading(false);
        }
    }, [incidentId, onBack, onListRefresh]);

    const loadWorkflow = useCallback(async ({ silent = false } = {}) => {
        if (!silent) {
            setWorkflowLoading(true);
            setWorkflowError("");
        }

        try {
            const nextWorkflow = await workflowsApi.getIncidentWorkflow(incidentId);
            setWorkflowError("");
            setWorkflow(nextWorkflow || null);
        } catch (requestError) {
            if (requestError.code !== "INCIDENT_NOT_FOUND") {
                setWorkflowError(requestError.message || "Could not load the runbook.");
            }
        } finally {
            if (!silent) setWorkflowLoading(false);
        }
    }, [incidentId]);

    const loadResponders = useCallback(async () => {
        setRespondersLoading(true);
        setRespondersError("");

        try {
            const nextResponders = await respondersApi.list();
            setResponders(Array.isArray(nextResponders) ? nextResponders : []);
        } catch (requestError) {
            setRespondersError(requestError.message || "Could not load responders.");
        } finally {
            setRespondersLoading(false);
        }
    }, []);

    useEffect(() => {
        loadIncident();
        loadWorkflow();
    }, [loadIncident, loadWorkflow]);

    useEffect(() => {
        if (!workflow && tab === "runbook") setTab("timeline");
    }, [tab, workflow]);

    const timelineEntries = useMemo(() => {
        const entries = Array.isArray(incident?.timeline) ? [...incident.timeline] : [];
        return entries.sort((left, right) => new Date(left.at).getTime() - new Date(right.at).getTime());
    }, [incident?.timeline]);

    const assignee = useMemo(() => {
        return responders.find((responder) => responder._id === incident?.assigneeId) || (incident?.assigneeId === currentResponder._id ? currentResponder : null);
    }, [currentResponder, incident?.assigneeId, responders]);

    const refreshAfterMutation = useCallback(async ({ includeWorkflow = false } = {}) => {
        await loadIncident();
        if (includeWorkflow) await loadWorkflow({ silent: true });
        onListRefresh?.();
        onDataChanged?.();
    }, [loadIncident, loadWorkflow, onDataChanged, onListRefresh]);

    const handleNoteSubmit = useCallback(async (event) => {
        event.preventDefault();
        if (!noteMessage.trim()) return;

        setNoteBusy(true);
        try {
            await incidentsApi.addNote(incidentId, noteMessage.trim(), customerFacing);
            notify(customerFacing ? "Status update posted" : "Note added", "success");
            setNoteMessage("");
            setCustomerFacing(false);
            await refreshAfterMutation();
        } catch (requestError) {
            notify(requestError.message || "Could not add note.", "error");
        } finally {
            setNoteBusy(false);
        }
    }, [customerFacing, incidentId, noteMessage, refreshAfterMutation]);

    const handleAssignClick = useCallback(() => {
        setShowAssignPicker(true);
        setSelectedResponderId(incident?.assigneeId || "");
        if (!responders.length && !respondersLoading) loadResponders();
    }, [incident?.assigneeId, loadResponders, responders.length, respondersLoading]);

    const handleAssignSubmit = useCallback(async (event) => {
        event.preventDefault();
        if (!selectedResponderId) return;

        setAssignBusy(true);
        try {
            await incidentsApi.assign(incidentId, selectedResponderId);
            notify("Assignee updated", "success");
            setShowAssignPicker(false);
            await refreshAfterMutation();
        } catch (requestError) {
            notify(requestError.message || "Could not update the assignee.", "error");
        } finally {
            setAssignBusy(false);
        }
    }, [incidentId, refreshAfterMutation, selectedResponderId]);

    const handleAcknowledge = useCallback(async () => {
        setActionBusy("acknowledge");
        try {
            await incidentsApi.acknowledge(incidentId);
            notify("Incident acknowledged", "success");
            await refreshAfterMutation();
        } catch (requestError) {
            notify(requestError.message || "Could not acknowledge the incident.", "error");
        } finally {
            setActionBusy("");
        }
    }, [incidentId, refreshAfterMutation]);

    const handleEscalate = useCallback(async () => {
        setActionBusy("escalate");
        try {
            await incidentsApi.escalate(incidentId);
            notify("Incident escalated", "success");
            await refreshAfterMutation();
        } catch (requestError) {
            notify(requestError.message || "Could not escalate the incident.", "error");
        } finally {
            setActionBusy("");
        }
    }, [incidentId, refreshAfterMutation]);

    const handleResolve = useCallback(async () => {
        setActionBusy("resolve");
        try {
            await incidentsApi.resolve(incidentId);
            notify("Incident resolved", "success");
            setConfirmResolve(false);
            await refreshAfterMutation({ includeWorkflow: true });
        } catch (requestError) {
            notify(requestError.message || "Could not resolve the incident.", "error");
        } finally {
            setActionBusy("");
        }
    }, [incidentId, refreshAfterMutation]);

    const handleToggleStep = useCallback(async (step) => {
        if (!workflow?._id) return;

        setWorkflowBusyOrder(step.order);
        try {
            await workflowsApi.toggleStep(workflow._id, step.order, !step.done);
            notify(step.done ? "Runbook step reopened" : "Runbook step completed", "success");
            await refreshAfterMutation({ includeWorkflow: true });
        } catch (requestError) {
            notify(requestError.message || "Could not update the runbook step.", "error");
        } finally {
            setWorkflowBusyOrder(null);
        }
    }, [refreshAfterMutation, workflow]);

    if (loading) return <Spinner label="Loading incident details" />;
    if (error) return <ErrorBanner message={error} onRetry={loadIncident} />;
    if (!incident) return null;

    const workflowSteps = Array.isArray(workflow?.steps) ? workflow.steps : [];
    const completedSteps = workflowSteps.filter((step) => step.done).length;
    const progressWidth = workflowSteps.length ? `${(completedSteps / workflowSteps.length) * 100}%` : "0%";

    return (
        <>
            <div className="page-header">
                <button aria-label="Back to incidents" className="icon-button" type="button" onClick={onBack}>
                    <Icon name="chevron_left" />
                </button>
                <div>
                    <h2>{incident.title}</h2>
                    <p className="subtitle">{incident.serviceName} · Opened {formatDateTime(incident.createdAt)}</p>
                </div>
            </div>

            <div className="detail-grid">
                <div className="card">
                    <div className="card-body">
                        <div className="detail-section">
                            <h3>Description</h3>
                            <p>{incident.description || "No additional context has been added yet."}</p>
                        </div>

                        <div className="detail-section">
                            <div className="tabs" role="tablist" aria-label="Incident detail tabs">
                                <button aria-selected={tab === "timeline"} className={tab === "timeline" ? "active" : ""} role="tab" type="button" onClick={() => setTab("timeline")}>
                                    Timeline
                                </button>
                                {workflow ? (
                                    <button aria-selected={tab === "runbook"} className={tab === "runbook" ? "active" : ""} role="tab" type="button" onClick={() => setTab("runbook")}>
                                        Runbook
                                    </button>
                                ) : null}
                            </div>
                            {workflowError ? <ErrorBanner message={workflowError} onRetry={() => loadWorkflow()} /> : null}
                        </div>

                        {tab === "timeline" ? (
                            <div className="detail-section">
                                {timelineEntries.length ? (
                                    <div className="timeline">
                                        {timelineEntries.map((entry, index) => (
                                            <div key={`${entry.type}-${entry.at}-${index}`} className="timeline-entry">
                                                <div className={`timeline-dot type-${entry.type}`}>
                                                    <Icon name={TIMELINE_ICONS[entry.type] || "info"} size={14} />
                                                </div>
                                                <div className="timeline-content">
                                                    <div>{entry.message}</div>
                                                    <div className="timeline-meta">
                                                        {formatDateTime(entry.at)} · {entry.actorName || "System"}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <EmptyState description="Timeline updates will appear here as responders work the incident." icon="clock" title="No timeline activity" />
                                )}

                                <form onSubmit={handleNoteSubmit}>
                                    <div className="field">
                                        <label htmlFor="incident-note">Add a note</label>
                                        <textarea
                                            id="incident-note"
                                            placeholder="Share findings, next steps, or a customer update."
                                            value={noteMessage}
                                            onChange={(event) => setNoteMessage(event.target.value)}
                                        />
                                    </div>
                                    <label className="checkbox-field" htmlFor="incident-status-update">
                                        <input
                                            id="incident-status-update"
                                            checked={customerFacing}
                                            type="checkbox"
                                            onChange={(event) => setCustomerFacing(event.target.checked)}
                                        />
                                        Post as customer-facing status update
                                    </label>
                                    <button className="button primary" disabled={noteBusy || !noteMessage.trim()} type="submit">
                                        {noteBusy ? "Posting…" : "Add note"}
                                    </button>
                                </form>
                            </div>
                        ) : null}

                        {tab === "runbook" ? (
                            <div className="detail-section">
                                {workflowLoading ? <Spinner label="Loading runbook" /> : null}
                                {!workflowLoading && !workflow ? <EmptyState description="This incident does not have a runbook attached." icon="workflows" title="No runbook" /> : null}
                                {!workflowLoading && workflow ? (
                                    <>
                                        <div className="field">
                                            <label>{workflow.templateName || "Incident runbook"}</label>
                                            <div className="progress-bar" aria-label="Runbook completion progress">
                                                <span style={{ width: progressWidth }} />
                                            </div>
                                            <p className="hint">{completedSteps} of {workflowSteps.length} steps complete</p>
                                        </div>
                                        <div className="checklist">
                                            {workflowSteps.map((step) => (
                                                <label key={step.order} className={`checklist-item ${step.done ? "done" : ""}`}>
                                                    <input
                                                        className="checklist-checkbox"
                                                        checked={Boolean(step.done)}
                                                        disabled={workflowBusyOrder === step.order}
                                                        type="checkbox"
                                                        onChange={() => handleToggleStep(step)}
                                                    />
                                                    <span>
                                                        <span className="checklist-title">{step.title}</span>
                                                        {step.description ? <span className="checklist-desc">{step.description}</span> : null}
                                                        {step.doneAt ? <span className="checklist-meta">Completed {formatDateTime(step.doneAt)} by {step.doneByName || "Responder"}</span> : null}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                </div>

                <aside className="card">
                    <div className="card-body">
                        <div className="detail-section">
                            <h3>Details</h3>
                            <div className="kv-list">
                                <div className="kv-row">
                                    <span className="kv-label">Status</span>
                                    <span className="kv-value"><StatusBadge kind="incident" status={incident.status} /></span>
                                </div>
                                <div className="kv-row">
                                    <span className="kv-label">Urgency</span>
                                    <span className="kv-value"><UrgencyBadge urgency={incident.urgency} /></span>
                                </div>
                                <div className="kv-row">
                                    <span className="kv-label">Service</span>
                                    <span className="kv-value">{incident.serviceName}</span>
                                </div>
                                <div className="kv-row">
                                    <span className="kv-label">Escalation level</span>
                                    <span className="kv-value">{incident.currentLevel ? `Level ${incident.currentLevel}` : "—"}</span>
                                </div>
                                <div className="kv-row">
                                    <span className="kv-label">Opened</span>
                                    <span className="kv-value">{formatDateTime(incident.createdAt)}</span>
                                </div>
                                {incident.acknowledgedAt ? (
                                    <div className="kv-row">
                                        <span className="kv-label">Acknowledged</span>
                                        <span className="kv-value">{formatDateTime(incident.acknowledgedAt)}</span>
                                    </div>
                                ) : null}
                                {incident.resolvedAt ? (
                                    <div className="kv-row">
                                        <span className="kv-label">Resolved</span>
                                        <span className="kv-value">{formatDateTime(incident.resolvedAt)}</span>
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        <div className="detail-section">
                            <h3>Assignee</h3>
                            <div className="responder-card">
                                <Avatar color={assignee?.avatarColor || "#5b8cff"} name={assigneeLabel(incident)} size="medium" />
                                <div className="responder-meta">
                                    <strong>{assigneeLabel(incident)}</strong>
                                    <span>{incident.assigneeName ? assignee?.title || "Assigned responder" : "No responder is assigned yet."}</span>
                                </div>
                            </div>
                            <button className="button ghost small" type="button" onClick={handleAssignClick}>
                                {incident.assigneeName ? "Reassign" : "Assign responder"}
                            </button>
                            {showAssignPicker ? (
                                <form onSubmit={handleAssignSubmit}>
                                    {respondersError ? <ErrorBanner message={respondersError} onRetry={loadResponders} /> : null}
                                    <div className="field">
                                        <label htmlFor="incident-assignee">Responder</label>
                                        <select
                                            id="incident-assignee"
                                            disabled={respondersLoading || assignBusy}
                                            value={selectedResponderId}
                                            onChange={(event) => setSelectedResponderId(event.target.value)}
                                        >
                                            <option value="">Select a responder</option>
                                            {responders.map((responder) => (
                                                <option key={responder._id} value={responder._id}>
                                                    {responder.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <button className="button primary small" disabled={assignBusy || respondersLoading || !selectedResponderId} type="submit">
                                        {assignBusy ? "Saving…" : "Save assignee"}
                                    </button>{" "}
                                    <button className="button ghost small" disabled={assignBusy} type="button" onClick={() => setShowAssignPicker(false)}>
                                        Cancel
                                    </button>
                                </form>
                            ) : null}
                        </div>

                        <div className="detail-section">
                            <h3>Actions</h3>
                            {incident.status === "triggered" ? (
                                <button className="button primary small" disabled={Boolean(actionBusy)} type="button" onClick={handleAcknowledge}>
                                    {actionBusy === "acknowledge" ? "Acknowledging…" : "Acknowledge"}
                                </button>
                            ) : null}{" "}
                            {incident.status === "triggered" ? (
                                <button className="button ghost small" disabled={Boolean(actionBusy)} type="button" onClick={handleEscalate}>
                                    {actionBusy === "escalate" ? "Escalating…" : "Escalate"}
                                </button>
                            ) : null}{" "}
                            {incident.status !== "resolved" ? (
                                <button className="button small" disabled={Boolean(actionBusy)} type="button" onClick={() => setConfirmResolve(true)}>
                                    Resolve
                                </button>
                            ) : null}
                        </div>
                    </div>
                </aside>
            </div>

            {confirmResolve ? (
                <ConfirmDialog
                    busy={actionBusy === "resolve"}
                    confirmLabel="Resolve incident"
                    description="This will mark the incident as resolved and stop further escalation."
                    title="Resolve incident?"
                    onClose={() => {
                        if (actionBusy !== "resolve") setConfirmResolve(false);
                    }}
                    onConfirm={handleResolve}
                />
            ) : null}
        </>
    );
}
