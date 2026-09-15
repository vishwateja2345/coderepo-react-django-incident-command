import { useCallback, useEffect, useMemo, useState } from "react";
import { servicesApi } from "./services.api.js";
import { escalationsApi } from "../escalations/escalations.api.js";
import { respondersApi } from "../responders/responders.api.js";
import { workflowsApi } from "../workflows/workflows.api.js";
import { Icon } from "../../shared/components/Icon.jsx";
import { Modal } from "../../shared/components/Modal.jsx";
import { ConfirmDialog, EmptyState, ErrorBanner, Spinner } from "../../shared/components/Feedback.jsx";
import { StatusBadge } from "../../shared/components/Badge.jsx";
import { notify } from "../../shared/utils/toast.js";
import { formatDateTime } from "../../shared/utils/format.js";

const EMPTY_SERVICE_FORM = {
    name: "",
    description: "",
    ownerId: "",
    defaultUrgency: "high",
    escalationPolicyId: "",
    workflowTemplateId: "",
};

function getFieldErrors(error) {
    return error?.details?.fieldErrors || {};
}

function getFormErrors(error) {
    return error?.details?.formErrors || [];
}

function getFieldError(fieldErrors, field) {
    return fieldErrors?.[field]?.[0] || "";
}

function isForbidden(error) {
    return error?.code === "FORBIDDEN";
}

function notifyMutationError(error, fallback = "Something went wrong.") {
    notify(isForbidden(error) ? "Your permissions changed. Refresh and try again." : error?.message || fallback, "error");
}

function ServiceFormFields({ form, fieldErrors, owners, policies, templates, onChange }) {
    return (
        <>
            <div className="field">
                <label htmlFor="service-name">Name</label>
                <input
                    id="service-name"
                    required
                    type="text"
                    value={form.name}
                    onChange={(event) => onChange("name", event.target.value)}
                />
                {getFieldError(fieldErrors, "name") && <p className="field-error">{getFieldError(fieldErrors, "name")}</p>}
            </div>

            <div className="field">
                <label htmlFor="service-description">Description</label>
                <textarea
                    id="service-description"
                    value={form.description}
                    onChange={(event) => onChange("description", event.target.value)}
                />
                {getFieldError(fieldErrors, "description") && <p className="field-error">{getFieldError(fieldErrors, "description")}</p>}
            </div>

            <div className="field-row">
                <div className="field">
                    <label htmlFor="service-owner">Owner</label>
                    <select id="service-owner" required value={form.ownerId} onChange={(event) => onChange("ownerId", event.target.value)}>
                        <option value="">Select an owner</option>
                        {owners.map((owner) => (
                            <option key={owner._id} value={owner._id}>
                                {owner.name}
                            </option>
                        ))}
                    </select>
                    {getFieldError(fieldErrors, "ownerId") && <p className="field-error">{getFieldError(fieldErrors, "ownerId")}</p>}
                </div>

                <div className="field">
                    <label htmlFor="service-urgency">Default urgency</label>
                    <select
                        id="service-urgency"
                        value={form.defaultUrgency}
                        onChange={(event) => onChange("defaultUrgency", event.target.value)}
                    >
                        <option value="high">High</option>
                        <option value="low">Low</option>
                    </select>
                    {getFieldError(fieldErrors, "defaultUrgency") && <p className="field-error">{getFieldError(fieldErrors, "defaultUrgency")}</p>}
                </div>
            </div>

            <div className="field-row">
                <div className="field">
                    <label htmlFor="service-policy">Escalation policy</label>
                    <select
                        id="service-policy"
                        value={form.escalationPolicyId}
                        onChange={(event) => onChange("escalationPolicyId", event.target.value)}
                    >
                        <option value="">None</option>
                        {policies.map((policy) => (
                            <option key={policy._id} value={policy._id}>
                                {policy.name}
                            </option>
                        ))}
                    </select>
                    {getFieldError(fieldErrors, "escalationPolicyId") && <p className="field-error">{getFieldError(fieldErrors, "escalationPolicyId")}</p>}
                </div>

                <div className="field">
                    <label htmlFor="service-runbook">Runbook template</label>
                    <select
                        id="service-runbook"
                        value={form.workflowTemplateId}
                        onChange={(event) => onChange("workflowTemplateId", event.target.value)}
                    >
                        <option value="">None</option>
                        {templates.map((template) => (
                            <option key={template._id} value={template._id}>
                                {template.name}
                            </option>
                        ))}
                    </select>
                    {getFieldError(fieldErrors, "workflowTemplateId") && <p className="field-error">{getFieldError(fieldErrors, "workflowTemplateId")}</p>}
                </div>
            </div>
        </>
    );
}

function ServiceDetailGrid({ service, policyName, templateName, onCopyKey }) {
    return (
        <div className="detail-grid">
            <div className="detail-section">
                <h3>Overview</h3>
                <div className="kv-list">
                    <div className="kv-row">
                        <span className="kv-label">Owner</span>
                        <span className="kv-value">{service.ownerName || "—"}</span>
                    </div>
                    <div className="kv-row">
                        <span className="kv-label">Default urgency</span>
                        <span className="kv-value">{service.defaultUrgency === "low" ? "Low" : "High"}</span>
                    </div>
                    <div className="kv-row">
                        <span className="kv-label">Open incidents</span>
                        <span className="kv-value">{service.openIncidentCount ?? 0}</span>
                    </div>
                    <div className="kv-row">
                        <span className="kv-label">Created</span>
                        <span className="kv-value">{formatDateTime(service.createdAt)}</span>
                    </div>
                </div>
                <p>{service.description || "No description provided."}</p>
                <div className="integration-key">
                    <Icon name="key" size={16} />
                    <span>{service.integrationKey}</span>
                    <button
                        aria-label="Copy integration key"
                        className="icon-button"
                        title="Copy integration key"
                        type="button"
                        onClick={onCopyKey}
                    >
                        <Icon name="copy" size={18} />
                    </button>
                </div>
            </div>

            <div className="detail-section">
                <h3>Attached automation</h3>
                <div className="kv-list">
                    <div className="kv-row">
                        <span className="kv-label">Escalation policy</span>
                        <span className="kv-value">{policyName || "None"}</span>
                    </div>
                    <div className="kv-row">
                        <span className="kv-label">Runbook template</span>
                        <span className="kv-value">{templateName || "None"}</span>
                    </div>
                    <div className="kv-row">
                        <span className="kv-label">Ingestion endpoint</span>
                        <span className="kv-value">POST /api/v1/events/{service.integrationKey}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function ServicesPage({ currentResponder, navRevision, onDataChanged }) {
    const isAdmin = currentResponder.role === "admin";
    const [services, setServices] = useState([]);
    const [owners, setOwners] = useState([]);
    const [policies, setPolicies] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedServiceId, setSelectedServiceId] = useState(null);
    const [selectedService, setSelectedService] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState("");
    const [createForm, setCreateForm] = useState(EMPTY_SERVICE_FORM);
    const [createError, setCreateError] = useState(null);
    const [createBusy, setCreateBusy] = useState(false);
    const [createdService, setCreatedService] = useState(null);
    const [editForm, setEditForm] = useState(EMPTY_SERVICE_FORM);
    const [editError, setEditError] = useState(null);
    const [saveBusy, setSaveBusy] = useState(false);
    const [rotateTarget, setRotateTarget] = useState(null);
    const [rotateBusy, setRotateBusy] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteBusy, setDeleteBusy] = useState(false);

    const ownerMap = useMemo(() => Object.fromEntries(owners.map((owner) => [owner._id, owner.name])), [owners]);
    const policyMap = useMemo(() => Object.fromEntries(policies.map((policy) => [policy._id, policy.name])), [policies]);
    const templateMap = useMemo(() => Object.fromEntries(templates.map((template) => [template._id, template.name])), [templates]);

    const loadPage = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [serviceList, responderList, policyList, templateList] = await Promise.all([
                servicesApi.list(),
                respondersApi.list(),
                escalationsApi.list(),
                workflowsApi.listTemplates(),
            ]);
            setServices(serviceList);
            setOwners(responderList);
            setPolicies(policyList);
            setTemplates(templateList);
        } catch (loadError) {
            setError(loadError.message || "Unable to load services.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPage();
    }, [loadPage, navRevision]);

    const loadServiceDetail = useCallback(async (serviceId) => {
        setDetailLoading(true);
        setDetailError("");
        try {
            const service = await servicesApi.get(serviceId);
            setSelectedService(service);
            setEditForm({
                name: service.name || "",
                description: service.description || "",
                ownerId: service.ownerId || "",
                defaultUrgency: service.defaultUrgency || "high",
                escalationPolicyId: service.escalationPolicyId || "",
                workflowTemplateId: service.workflowTemplateId || "",
            });
        } catch (loadError) {
            setDetailError(loadError.message || "Unable to load service details.");
        } finally {
            setDetailLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!selectedServiceId) return undefined;
        loadServiceDetail(selectedServiceId);
        return undefined;
    }, [loadServiceDetail, selectedServiceId]);

    const resetCreateModal = useCallback(() => {
        setIsCreateOpen(false);
        setCreateForm(EMPTY_SERVICE_FORM);
        setCreateError(null);
        setCreateBusy(false);
        setCreatedService(null);
    }, []);

    const closeDetailModal = useCallback(() => {
        setSelectedServiceId(null);
        setSelectedService(null);
        setDetailError("");
        setEditError(null);
        setSaveBusy(false);
    }, []);

    const handleCopyKey = useCallback(async (integrationKey) => {
        try {
            if (!navigator?.clipboard?.writeText) throw new Error("Clipboard access is unavailable in this browser.");
            await navigator.clipboard.writeText(integrationKey);
            notify("Integration key copied", "success");
        } catch (copyError) {
            notify(copyError.message || "Unable to copy the integration key.", "error");
        }
    }, []);

    const handleCreateChange = useCallback((field, value) => {
        setCreateForm((current) => ({ ...current, [field]: value }));
    }, []);

    const handleEditChange = useCallback((field, value) => {
        setEditForm((current) => ({ ...current, [field]: value }));
    }, []);

    const handleCreateSubmit = useCallback(async (event) => {
        event.preventDefault();
        setCreateBusy(true);
        setCreateError(null);
        try {
            const created = await servicesApi.create({
                name: createForm.name,
                description: createForm.description,
                ownerId: createForm.ownerId,
                defaultUrgency: createForm.defaultUrgency,
                escalationPolicyId: createForm.escalationPolicyId || null,
                workflowTemplateId: createForm.workflowTemplateId || null,
            });
            setCreatedService(created);
            setServices((current) => [created, ...current]);
            onDataChanged();
            notify("Service created", "success");
        } catch (submitError) {
            setCreateError(submitError);
            notifyMutationError(submitError, "Unable to create service.");
        } finally {
            setCreateBusy(false);
        }
    }, [createForm, onDataChanged]);

    const handleSaveService = useCallback(async (event) => {
        event.preventDefault();
        if (!selectedService) return;
        setSaveBusy(true);
        setEditError(null);
        try {
            const updated = await servicesApi.update(selectedService._id, {
                name: editForm.name,
                description: editForm.description,
                ownerId: editForm.ownerId,
                defaultUrgency: editForm.defaultUrgency,
                escalationPolicyId: editForm.escalationPolicyId || null,
                workflowTemplateId: editForm.workflowTemplateId || null,
            });
            setSelectedService(updated);
            setServices((current) => current.map((service) => (service._id === updated._id ? updated : service)));
            onDataChanged();
            notify("Service updated", "success");
        } catch (submitError) {
            setEditError(submitError);
            notifyMutationError(submitError, "Unable to update service.");
        } finally {
            setSaveBusy(false);
        }
    }, [editForm, onDataChanged, selectedService]);

    const confirmRotateKey = useCallback(async () => {
        if (!rotateTarget) return;
        setRotateBusy(true);
        try {
            const updated = await servicesApi.rotateKey(rotateTarget._id);
            setServices((current) => current.map((service) => (service._id === updated._id ? updated : service)));
            if (selectedService?._id === updated._id) {
                setSelectedService(updated);
                setEditForm({
                    name: updated.name || "",
                    description: updated.description || "",
                    ownerId: updated.ownerId || "",
                    defaultUrgency: updated.defaultUrgency || "high",
                    escalationPolicyId: updated.escalationPolicyId || "",
                    workflowTemplateId: updated.workflowTemplateId || "",
                });
            }
            onDataChanged();
            setRotateTarget(null);
            notify("Integration key rotated", "success");
        } catch (rotateError) {
            notifyMutationError(rotateError, "Unable to rotate the integration key.");
        } finally {
            setRotateBusy(false);
        }
    }, [onDataChanged, rotateTarget, selectedService]);

    const confirmDeleteService = useCallback(async () => {
        if (!deleteTarget) return;
        setDeleteBusy(true);
        try {
            await servicesApi.remove(deleteTarget._id);
            setServices((current) => current.filter((service) => service._id !== deleteTarget._id));
            if (selectedServiceId === deleteTarget._id) closeDetailModal();
            onDataChanged();
            setDeleteTarget(null);
            notify("Service deleted", "success");
        } catch (deleteError) {
            notifyMutationError(deleteError, "Unable to delete service.");
        } finally {
            setDeleteBusy(false);
        }
    }, [closeDetailModal, deleteTarget, onDataChanged, selectedServiceId]);

    const emptyAction = isAdmin ? (
        <button className="button primary" type="button" onClick={() => setIsCreateOpen(true)}>
            <Icon name="add" size={16} />
            New service
        </button>
    ) : null;

    return (
        <>
            <div className="page-header">
                <div>
                    <h2>Services</h2>
                    <p className="subtitle">Service ownership, alert ingestion, and attached incident automation.</p>
                </div>
                {isAdmin && (
                    <div className="page-header-actions">
                        <button className="button primary" type="button" onClick={() => setIsCreateOpen(true)}>
                            <Icon name="add" size={16} />
                            New service
                        </button>
                    </div>
                )}
            </div>

            <div className="detail-section">
                <div className="card">
                    <div className="card-body">
                        <p>
                            Monitoring tools send alerts to the Alert triage ingestion endpoint at{" "}
                            <strong>POST /api/v1/events/{"{integrationKey}"}</strong>. Copy a service key below when wiring up the alerts inbox that the
                            rest of the team is building.
                        </p>
                    </div>
                </div>
            </div>

            {loading && <Spinner label="Loading services" />}
            {!loading && error && <ErrorBanner message={error} onRetry={loadPage} />}
            {!loading && !error && services.length === 0 && (
                <EmptyState
                    action={emptyAction}
                    description={isAdmin ? "Create your first monitored service to start receiving alerts." : "No services have been configured yet."}
                    icon="services"
                    title="No services yet"
                />
            )}

            {!loading && !error && services.length > 0 && (
                <div className="card-grid">
                    {services.map((service) => (
                        <div
                            aria-label={`Open ${service.name}`}
                            className="card"
                            key={service._id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedServiceId(service._id)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    setSelectedServiceId(service._id);
                                }
                            }}
                        >
                            <div className="card-header">
                                <h3>{service.name}</h3>
                                <div className="page-header-actions">
                                    <StatusBadge kind="service" status={service.status} />
                                </div>
                            </div>
                            <div className="card-body">
                                <div className="detail-section">
                                    <p>{service.description || "No description provided."}</p>
                                    <div className="kv-list">
                                        <div className="kv-row">
                                            <span className="kv-label">Owner</span>
                                            <span className="kv-value">{service.ownerName || "—"}</span>
                                        </div>
                                        <div className="kv-row">
                                            <span className="kv-label">Open incidents</span>
                                            <span className="kv-value">{service.openIncidentCount ?? 0}</span>
                                        </div>
                                    </div>
                                    <div className="integration-key" onClick={(event) => event.stopPropagation()}>
                                        <Icon name="key" size={16} />
                                        <span>{service.integrationKey}</span>
                                        <button
                                            aria-label="Copy integration key"
                                            className="icon-button"
                                            title="Copy integration key"
                                            type="button"
                                            onClick={() => handleCopyKey(service.integrationKey)}
                                        >
                                            <Icon name="copy" size={18} />
                                        </button>
                                        {isAdmin && (
                                            <button
                                                className="button ghost small"
                                                type="button"
                                                onClick={() => setRotateTarget(service)}
                                            >
                                                Rotate
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isCreateOpen && (
                <Modal label="Create service" onClose={resetCreateModal}>
                    <div className="modal-header">
                        <h2>{createdService ? "Integration key ready" : "New service"}</h2>
                        <button aria-label="Close" className="icon-button" type="button" onClick={resetCreateModal}>
                            <Icon name="close" />
                        </button>
                    </div>

                    {createdService ? (
                        <>
                            <div className="modal-body">
                                <p>
                                    <strong>{createdService.name}</strong> is ready. Share this integration key with the monitoring tool that will send
                                    alerts for the service.
                                </p>
                                <div className="integration-key">
                                    <Icon name="key" size={16} />
                                    <span>{createdService.integrationKey}</span>
                                    <button
                                        aria-label="Copy integration key"
                                        className="icon-button"
                                        title="Copy integration key"
                                        type="button"
                                        onClick={() => handleCopyKey(createdService.integrationKey)}
                                    >
                                        <Icon name="copy" size={18} />
                                    </button>
                                </div>
                                <p>Ingestion endpoint: POST /api/v1/events/{createdService.integrationKey}</p>
                            </div>
                            <div className="modal-footer">
                                <button
                                    className="button ghost"
                                    type="button"
                                    onClick={() => {
                                        setCreateForm(EMPTY_SERVICE_FORM);
                                        setCreatedService(null);
                                    }}
                                >
                                    Create another
                                </button>
                                <button autoFocus className="button primary" type="button" onClick={resetCreateModal}>
                                    Done
                                </button>
                            </div>
                        </>
                    ) : (
                        <form onSubmit={handleCreateSubmit}>
                            <div className="modal-body">
                                {getFormErrors(createError).length > 0 && <div className="form-error-banner">{getFormErrors(createError).join(" ")}</div>}
                                <ServiceFormFields
                                    fieldErrors={getFieldErrors(createError)}
                                    form={createForm}
                                    owners={owners}
                                    policies={policies}
                                    templates={templates}
                                    onChange={handleCreateChange}
                                />
                            </div>
                            <div className="modal-footer">
                                <button className="button ghost" type="button" onClick={resetCreateModal}>
                                    Cancel
                                </button>
                                <button autoFocus className="button primary" disabled={createBusy} type="submit">
                                    {createBusy ? "Creating…" : "Create service"}
                                </button>
                            </div>
                        </form>
                    )}
                </Modal>
            )}

            {selectedServiceId && (
                <Modal label={selectedService?.name || "Service details"} onClose={closeDetailModal}>
                    <div className="modal-header">
                        <h2>{selectedService?.name || "Service details"}</h2>
                        <button aria-label="Close" className="icon-button" type="button" onClick={closeDetailModal}>
                            <Icon name="close" />
                        </button>
                    </div>

                    {detailLoading && (
                        <div className="modal-body">
                            <Spinner label="Loading service details" />
                        </div>
                    )}

                    {!detailLoading && detailError && (
                        <div className="modal-body">
                            <ErrorBanner message={detailError} onRetry={() => loadServiceDetail(selectedServiceId)} />
                        </div>
                    )}

                    {!detailLoading && !detailError && selectedService && !isAdmin && (
                        <>
                            <div className="modal-body">
                                <ServiceDetailGrid
                                    policyName={policyMap[selectedService.escalationPolicyId] || ""}
                                    service={selectedService}
                                    templateName={templateMap[selectedService.workflowTemplateId] || ""}
                                    onCopyKey={() => handleCopyKey(selectedService.integrationKey)}
                                />
                            </div>
                            <div className="modal-footer">
                                <button autoFocus className="button primary" type="button" onClick={closeDetailModal}>
                                    Close
                                </button>
                            </div>
                        </>
                    )}

                    {!detailLoading && !detailError && selectedService && isAdmin && (
                        <form onSubmit={handleSaveService}>
                            <div className="modal-body">
                                <StatusBadge kind="service" status={selectedService.status} />
                                {getFormErrors(editError).length > 0 && <div className="form-error-banner">{getFormErrors(editError).join(" ")}</div>}
                                <ServiceFormFields
                                    fieldErrors={getFieldErrors(editError)}
                                    form={editForm}
                                    owners={owners}
                                    policies={policies}
                                    templates={templates}
                                    onChange={handleEditChange}
                                />
                                <ServiceDetailGrid
                                    policyName={policyMap[editForm.escalationPolicyId] || ""}
                                    service={{
                                        ...selectedService,
                                        ...editForm,
                                        ownerName: ownerMap[editForm.ownerId] || selectedService.ownerName,
                                        integrationKey: selectedService.integrationKey,
                                    }}
                                    templateName={templateMap[editForm.workflowTemplateId] || ""}
                                    onCopyKey={() => handleCopyKey(selectedService.integrationKey)}
                                />
                            </div>
                            <div className="modal-footer">
                                <button className="button danger" type="button" onClick={() => setDeleteTarget(selectedService)}>
                                    Delete
                                </button>
                                <button className="button ghost" type="button" onClick={closeDetailModal}>
                                    Cancel
                                </button>
                                <button className="button ghost" type="button" onClick={() => setRotateTarget(selectedService)}>
                                    Rotate key
                                </button>
                                <button autoFocus className="button primary" disabled={saveBusy} type="submit">
                                    {saveBusy ? "Saving…" : "Save changes"}
                                </button>
                            </div>
                        </form>
                    )}
                </Modal>
            )}

            {rotateTarget && (
                <ConfirmDialog
                    busy={rotateBusy}
                    confirmLabel="Rotate key"
                    description={`Rotate the integration key for ${rotateTarget.name}? Monitoring tools using the current key will stop working immediately.`}
                    title="Rotate integration key"
                    tone="danger"
                    onClose={() => !rotateBusy && setRotateTarget(null)}
                    onConfirm={confirmRotateKey}
                />
            )}

            {deleteTarget && (
                <ConfirmDialog
                    busy={deleteBusy}
                    confirmLabel="Delete service"
                    description={`Delete ${deleteTarget.name}? Existing integrations will stop sending alerts to this service.`}
                    title="Delete service"
                    tone="danger"
                    onClose={() => !deleteBusy && setDeleteTarget(null)}
                    onConfirm={confirmDeleteService}
                />
            )}
        </>
    );
}
