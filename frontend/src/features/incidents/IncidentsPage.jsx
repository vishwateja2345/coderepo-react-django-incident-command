import { useCallback, useEffect, useMemo, useState } from "react";
import { incidentsApi } from "./incidents.api.js";
import { IncidentDetail } from "./IncidentDetail.jsx";
import { servicesApi } from "../services/services.api.js";
import { Avatar, StatusBadge, UrgencyBadge } from "../../shared/components/Badge.jsx";
import { EmptyState, ErrorBanner, Spinner } from "../../shared/components/Feedback.jsx";
import { Icon } from "../../shared/components/Icon.jsx";
import { Modal } from "../../shared/components/Modal.jsx";
import { formatDuration, formatRelativeTime } from "../../shared/utils/format.js";
import { notify } from "../../shared/utils/toast.js";

const STATUS_FILTERS = [
    { value: "all", label: "All" },
    { value: "triggered", label: "Triggered" },
    { value: "acknowledged", label: "Acknowledged" },
    { value: "resolved", label: "Resolved" },
];

const EMPTY_FORM = {
    title: "",
    description: "",
    serviceId: "",
    urgency: "",
};

function getFieldError(fieldErrors, fieldName) {
    const messages = fieldErrors?.[fieldName];
    return Array.isArray(messages) ? messages.join(" ") : "";
}

function AssigneeCell({ incident }) {
    if (!incident.assigneeName) return <span className="kv-label">Unassigned</span>;

    return (
        <>
            <Avatar color="#5b8cff" name={incident.assigneeName} size="small" /> {incident.assigneeName}
        </>
    );
}

function IncidentCreateModal({ busy, fieldErrors, formError, formValues, services, servicesError, servicesLoading, onChange, onClose, onSubmit }) {
    return (
        <Modal label="Open a new incident" onClose={onClose}>
            <div className="modal-header">
                <h2>Open a new incident</h2>
            </div>
            <form onSubmit={onSubmit}>
                <div className="modal-body">
                    {formError ? <p className="form-error-banner" role="alert">{formError}</p> : null}
                    {servicesError ? <ErrorBanner message={servicesError} /> : null}
                    <div className="field">
                        <label htmlFor="incident-title">Title</label>
                        <input
                            data-autofocus
                            id="incident-title"
                            name="title"
                            required
                            type="text"
                            value={formValues.title}
                            onChange={(event) => onChange("title", event.target.value)}
                        />
                        {getFieldError(fieldErrors, "title") ? <p className="field-error">{getFieldError(fieldErrors, "title")}</p> : null}
                    </div>
                    <div className="field">
                        <label htmlFor="incident-description">Description</label>
                        <textarea
                            id="incident-description"
                            name="description"
                            value={formValues.description}
                            onChange={(event) => onChange("description", event.target.value)}
                        />
                        {getFieldError(fieldErrors, "description") ? <p className="field-error">{getFieldError(fieldErrors, "description")}</p> : null}
                    </div>
                    <div className="field-row">
                        <div className="field">
                            <label htmlFor="incident-service">Service</label>
                            <select
                                id="incident-service"
                                name="serviceId"
                                required
                                value={formValues.serviceId}
                                onChange={(event) => onChange("serviceId", event.target.value)}
                            >
                                <option value="">{servicesLoading ? "Loading services…" : "Select a service"}</option>
                                {services.map((service) => (
                                    <option key={service._id} value={service._id}>
                                        {service.name}
                                    </option>
                                ))}
                            </select>
                            {getFieldError(fieldErrors, "serviceId") ? <p className="field-error">{getFieldError(fieldErrors, "serviceId")}</p> : null}
                        </div>
                        <div className="field">
                            <label htmlFor="incident-urgency">Urgency</label>
                            <select
                                id="incident-urgency"
                                name="urgency"
                                value={formValues.urgency}
                                onChange={(event) => onChange("urgency", event.target.value)}
                            >
                                <option value="">Use service default</option>
                                <option value="high">High</option>
                                <option value="low">Low</option>
                            </select>
                            {getFieldError(fieldErrors, "urgency") ? <p className="field-error">{getFieldError(fieldErrors, "urgency")}</p> : null}
                        </div>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="button ghost" type="button" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="button primary" disabled={busy || servicesLoading} type="submit">
                        {busy ? "Opening…" : "Open incident"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

export function IncidentsPage({ currentResponder, navRevision, onDataChanged }) {
    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedIncidentId, setSelectedIncidentId] = useState("");

    const [createOpen, setCreateOpen] = useState(false);
    const [createBusy, setCreateBusy] = useState(false);
    const [createForm, setCreateForm] = useState(EMPTY_FORM);
    const [createFieldErrors, setCreateFieldErrors] = useState({});
    const [createFormError, setCreateFormError] = useState("");
    const [services, setServices] = useState([]);
    const [servicesLoading, setServicesLoading] = useState(false);
    const [servicesError, setServicesError] = useState("");

    const loadIncidents = useCallback(async ({ silent = false } = {}) => {
        if (!silent) {
            setLoading(true);
            setError("");
        }

        try {
            const nextIncidents = await incidentsApi.list(statusFilter === "all" ? {} : { status: statusFilter });
            setIncidents(Array.isArray(nextIncidents) ? nextIncidents : []);
        } catch (requestError) {
            if (!silent) setError(requestError.message || "Could not load incidents.");
        } finally {
            if (!silent) setLoading(false);
        }
    }, [statusFilter]);

    const loadServices = useCallback(async () => {
        setServicesLoading(true);
        setServicesError("");
        try {
            const nextServices = await servicesApi.list();
            setServices(Array.isArray(nextServices) ? nextServices : []);
        } catch (requestError) {
            setServicesError(requestError.message || "Could not load services.");
        } finally {
            setServicesLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!selectedIncidentId) loadIncidents();
    }, [loadIncidents, navRevision, selectedIncidentId]);

    useEffect(() => {
        if (!selectedIncidentId) {
            const timer = window.setInterval(() => {
                loadIncidents({ silent: true });
            }, 15000);

            return () => window.clearInterval(timer);
        }

        return undefined;
    }, [loadIncidents, selectedIncidentId]);


    const filteredIncidents = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return incidents;
        return incidents.filter((incident) => incident.title?.toLowerCase().includes(query));
    }, [incidents, searchQuery]);

    const openCreateModal = useCallback(() => {
        setCreateForm(EMPTY_FORM);
        setCreateFieldErrors({});
        setCreateFormError("");
        setCreateOpen(true);
        if (!services.length && !servicesLoading) loadServices();
    }, [loadServices, services.length, servicesLoading]);

    const closeCreateModal = useCallback(() => {
        if (createBusy) return;
        setCreateOpen(false);
    }, [createBusy]);

    const handleCreateChange = useCallback((field, value) => {
        setCreateForm((current) => ({ ...current, [field]: value }));
        setCreateFieldErrors((current) => ({ ...current, [field]: undefined }));
        setCreateFormError("");
    }, []);

    const handleCreateSubmit = useCallback(async (event) => {
        event.preventDefault();
        setCreateBusy(true);
        setCreateFieldErrors({});
        setCreateFormError("");

        try {
            const payload = {
                serviceId: createForm.serviceId,
                title: createForm.title,
                description: createForm.description,
                ...(createForm.urgency ? { urgency: createForm.urgency } : {}),
            };
            const created = await incidentsApi.create(payload);
            notify("Incident opened", "success");
            setCreateOpen(false);
            setSelectedIncidentId(created._id);
            loadIncidents({ silent: true });
            onDataChanged?.();
        } catch (requestError) {
            setCreateFieldErrors(requestError.details?.fieldErrors || {});
            setCreateFormError(requestError.details?.formErrors?.join(" ") || requestError.message || "Could not open incident.");
            notify(requestError.message || "Could not open incident.", "error");
        } finally {
            setCreateBusy(false);
        }
    }, [createForm, loadIncidents, onDataChanged]);

    const handleDetailBack = useCallback(() => {
        setSelectedIncidentId("");
        loadIncidents({ silent: true });
    }, [loadIncidents]);

    if (selectedIncidentId) {
        return <IncidentDetail currentResponder={currentResponder} incidentId={selectedIncidentId} onBack={handleDetailBack} onDataChanged={onDataChanged} onListRefresh={() => loadIncidents({ silent: true })} />;
    }

    return (
        <>
            <div className="page-header">
                <div>
                    <h2>Incidents</h2>
                    <p className="subtitle">Track active incidents, coordinate response, and keep your timeline up to date.</p>
                </div>
                <div className="page-header-actions">
                    <button className="button primary" type="button" onClick={openCreateModal}>
                        <Icon name="add" size={18} />
                        New incident
                    </button>
                </div>
            </div>

            <div className="page-toolbar">
                <div className="chip-group" aria-label="Filter incidents by status">
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
                <div className="spacer" />
                <label className="search-box" htmlFor="incident-search">
                    <Icon name="search" size={16} />
                    <input
                        id="incident-search"
                        placeholder="Search incident titles"
                        type="search"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                    />
                </label>
            </div>

            {loading ? <Spinner label="Loading incidents" /> : null}
            {!loading && error ? <ErrorBanner message={error} onRetry={() => loadIncidents()} /> : null}
            {!loading && !error && !filteredIncidents.length ? (
                <EmptyState
                    description={searchQuery ? "No incidents match your current search." : "Open incidents will appear here as your team responds."}
                    icon="incidents"
                    title="No incidents"
                />
            ) : null}
            {!loading && !error && filteredIncidents.length ? (
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th scope="col">Status</th>
                                <th scope="col">Title</th>
                                <th scope="col">Service</th>
                                <th scope="col">Urgency</th>
                                <th scope="col">Assignee</th>
                                <th scope="col">Opened</th>
                                <th scope="col">MTTA</th>
                                <th scope="col">MTTR</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredIncidents.map((incident) => (
                                <tr
                                    key={incident._id}
                                    className="clickable"
                                    tabIndex={0}
                                    onClick={() => setSelectedIncidentId(incident._id)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            setSelectedIncidentId(incident._id);
                                        }
                                    }}
                                >
                                    <td><StatusBadge kind="incident" status={incident.status} /></td>
                                    <td>{incident.title}</td>
                                    <td>{incident.serviceName}</td>
                                    <td><UrgencyBadge urgency={incident.urgency} /></td>
                                    <td><AssigneeCell incident={incident} /></td>
                                    <td>{formatRelativeTime(incident.createdAt)}</td>
                                    <td>{incident.status === "resolved" ? formatDuration(incident.mttaSeconds) : "—"}</td>
                                    <td>{incident.status === "resolved" ? formatDuration(incident.mttrSeconds) : "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : null}

            {createOpen ? (
                <IncidentCreateModal
                    busy={createBusy}
                    fieldErrors={createFieldErrors}
                    formError={createFormError}
                    formValues={createForm}
                    services={services}
                    servicesError={servicesError}
                    servicesLoading={servicesLoading}
                    onChange={handleCreateChange}
                    onClose={closeCreateModal}
                    onSubmit={handleCreateSubmit}
                />
            ) : null}
        </>
    );
}
