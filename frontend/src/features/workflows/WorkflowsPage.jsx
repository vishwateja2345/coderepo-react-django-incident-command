import { useCallback, useEffect, useMemo, useState } from "react";
import { workflowsApi } from "./workflows.api.js";
import { servicesApi } from "../services/services.api.js";
import { Modal } from "../../shared/components/Modal.jsx";
import { ConfirmDialog, EmptyState, ErrorBanner, Spinner } from "../../shared/components/Feedback.jsx";
import { Icon } from "../../shared/components/Icon.jsx";
import { notify } from "../../shared/utils/toast.js";

const EMPTY_STEP = () => ({ title: "", description: "" });
const DEFAULT_FORM = { name: "", serviceId: "", steps: [EMPTY_STEP()] };

function createBlankErrors() {
    return { form: [], fields: {}, steps: {} };
}

function normalizeTemplate(template) {
    return {
        _id: template._id,
        name: template.name || "",
        serviceId: template.serviceId || null,
        steps: Array.isArray(template.steps) && template.steps.length
            ? template.steps.map((step) => ({ title: step.title || "", description: step.description || "" }))
            : [EMPTY_STEP()],
    };
}

function buildPayload(form) {
    return {
        name: form.name.trim(),
        serviceId: form.serviceId || null,
        steps: form.steps.map((step) => ({
            title: step.title.trim(),
            description: step.description.trim(),
        })),
    };
}

function getMessage(error, fallback) {
    return error?.message || fallback;
}

function normalizeWorkflowErrors(error) {
    const next = createBlankErrors();
    const formErrors = error?.details?.formErrors;
    const fieldErrors = error?.details?.fieldErrors;

    if (Array.isArray(formErrors)) next.form = formErrors;

    if (fieldErrors && typeof fieldErrors === "object") {
        Object.entries(fieldErrors).forEach(([field, messages]) => {
            const joined = Array.isArray(messages) ? messages.join(" ") : String(messages || "");
            const stepFieldMatch = field.match(/^steps\[(\d+)\]\.(.+)$/);
            const stepRowMatch = field.match(/^steps\[(\d+)\]$/);

            if (stepFieldMatch) {
                const index = Number(stepFieldMatch[1]);
                const stepField = stepFieldMatch[2];
                next.steps[index] = { ...(next.steps[index] || {}), [stepField]: joined };
                return;
            }

            if (stepRowMatch) {
                const index = Number(stepRowMatch[1]);
                next.steps[index] = { ...(next.steps[index] || {}), _error: joined };
                return;
            }

            next.fields[field] = joined;
        });
    }

    return next;
}

function RunbookFormModal({ busy, isEditing, services, submitError, formErrors, values, onChange, onClose, onSubmit }) {
    return (
        <Modal label={isEditing ? "Edit runbook" : "New runbook"} onClose={onClose}>
            <form onSubmit={onSubmit}>
                <div className="modal-header">
                    <h2>{isEditing ? "Edit runbook" : "New runbook"}</h2>
                    <button aria-label="Close" className="icon-button" type="button" onClick={onClose}>
                        <Icon name="close" size={18} />
                    </button>
                </div>
                <div className="modal-body">
                    {submitError && <div className="form-error-banner" role="alert">{submitError}</div>}
                    {formErrors.form.length > 0 && <div className="form-error-banner" role="alert">{formErrors.form.join(" ")}</div>}
                    <div className="field">
                        <label htmlFor="runbook-name">Name</label>
                        <input
                            data-autofocus
                            id="runbook-name"
                            name="name"
                            required
                            value={values.name}
                            onChange={(event) => onChange({ ...values, name: event.target.value })}
                        />
                        {formErrors.fields.name && <div className="field-error">{formErrors.fields.name}</div>}
                    </div>
                    <div className="field">
                        <label htmlFor="runbook-service">Service scope</label>
                        <select
                            id="runbook-service"
                            name="serviceId"
                            value={values.serviceId}
                            onChange={(event) => onChange({ ...values, serviceId: event.target.value })}
                        >
                            <option value="">All services (global)</option>
                            {services.map((service) => (
                                <option key={service._id} value={service._id}>{service.name}</option>
                            ))}
                        </select>
                        {formErrors.fields.serviceId && <div className="field-error">{formErrors.fields.serviceId}</div>}
                    </div>

                    <div className="detail-section" style={{ marginBottom: 0 }}>
                        <h3>Checklist steps</h3>
                        <div className="card-grid" style={{ gridTemplateColumns: "1fr" }}>
                            {values.steps.map((step, index) => {
                                const stepErrors = formErrors.steps[index] || {};
                                const disableRemove = values.steps.length === 1;
                                return (
                                    <div className="card" key={`step-${index}`}>
                                        <div className="card-header">
                                            <h3>Step {index + 1}</h3>
                                            <div className="page-header-actions" style={{ marginLeft: "auto" }}>
                                                <button
                                                    aria-label={`Move step ${index + 1} up`}
                                                    className="button ghost small"
                                                    disabled={index === 0}
                                                    type="button"
                                                    onClick={() => {
                                                        if (index === 0) return;
                                                        const nextSteps = [...values.steps];
                                                        [nextSteps[index - 1], nextSteps[index]] = [nextSteps[index], nextSteps[index - 1]];
                                                        onChange({ ...values, steps: nextSteps });
                                                    }}
                                                >
                                                    <Icon name="chevron_up" size={16} />
                                                    Up
                                                </button>
                                                <button
                                                    aria-label={`Move step ${index + 1} down`}
                                                    className="button ghost small"
                                                    disabled={index === values.steps.length - 1}
                                                    type="button"
                                                    onClick={() => {
                                                        if (index === values.steps.length - 1) return;
                                                        const nextSteps = [...values.steps];
                                                        [nextSteps[index + 1], nextSteps[index]] = [nextSteps[index], nextSteps[index + 1]];
                                                        onChange({ ...values, steps: nextSteps });
                                                    }}
                                                >
                                                    <Icon name="chevron_down" size={16} />
                                                    Down
                                                </button>
                                                <button
                                                    aria-label={`Remove step ${index + 1}`}
                                                    className="button ghost small"
                                                    disabled={disableRemove}
                                                    type="button"
                                                    onClick={() => {
                                                        if (disableRemove) return;
                                                        onChange({ ...values, steps: values.steps.filter((_, stepIndex) => stepIndex !== index) });
                                                    }}
                                                >
                                                    <Icon name="trash" size={16} />
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                        <div className="card-body" style={{ display: "grid", gap: 14 }}>
                                            {stepErrors._error && <div className="form-error-banner" role="alert">{stepErrors._error}</div>}
                                            <div className="field">
                                                <label htmlFor={`step-title-${index}`}>Title</label>
                                                <input
                                                    id={`step-title-${index}`}
                                                    required
                                                    value={step.title}
                                                    onChange={(event) => {
                                                        const nextSteps = values.steps.map((item, stepIndex) => (
                                                            stepIndex === index ? { ...item, title: event.target.value } : item
                                                        ));
                                                        onChange({ ...values, steps: nextSteps });
                                                    }}
                                                />
                                                {stepErrors.title && <div className="field-error">{stepErrors.title}</div>}
                                            </div>
                                            <div className="field">
                                                <label htmlFor={`step-description-${index}`}>Description</label>
                                                <textarea
                                                    id={`step-description-${index}`}
                                                    value={step.description}
                                                    onChange={(event) => {
                                                        const nextSteps = values.steps.map((item, stepIndex) => (
                                                            stepIndex === index ? { ...item, description: event.target.value } : item
                                                        ));
                                                        onChange({ ...values, steps: nextSteps });
                                                    }}
                                                />
                                                {stepErrors.description && <div className="field-error">{stepErrors.description}</div>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {formErrors.fields.steps && <div className="field-error">{formErrors.fields.steps}</div>}
                        <div>
                            <button
                                className="button ghost"
                                type="button"
                                onClick={() => onChange({ ...values, steps: [...values.steps, EMPTY_STEP()] })}
                            >
                                <Icon name="add" size={16} />
                                Add step
                            </button>
                        </div>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="button ghost" disabled={busy} type="button" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="button primary" disabled={busy} type="submit">
                        {busy ? "Saving…" : isEditing ? "Save changes" : "Create runbook"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

export function WorkflowsPage({ currentResponder, navRevision, onDataChanged }) {
    const isAdmin = currentResponder.role === "admin";
    const [templates, setTemplates] = useState([]);
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [editorState, setEditorState] = useState({ open: false, templateId: null });
    const [formValues, setFormValues] = useState(DEFAULT_FORM);
    const [formErrors, setFormErrors] = useState(createBlankErrors());
    const [submitError, setSubmitError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const loadTemplates = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [templateRows, serviceRows] = await Promise.all([workflowsApi.listTemplates(), servicesApi.list()]);
            setTemplates(Array.isArray(templateRows) ? templateRows.map(normalizeTemplate) : []);
            setServices(Array.isArray(serviceRows) ? serviceRows : []);
        } catch (requestError) {
            setError(getMessage(requestError, "Unable to load runbooks right now."));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTemplates();
    }, [loadTemplates, navRevision]);

    const servicesById = useMemo(
        () => Object.fromEntries(services.map((service) => [String(service._id), service.name || "Unnamed service"])),
        [services],
    );

    const openCreate = () => {
        setEditorState({ open: true, templateId: null });
        setFormValues(DEFAULT_FORM);
        setFormErrors(createBlankErrors());
        setSubmitError("");
    };

    const openEdit = (template) => {
        setEditorState({ open: true, templateId: template._id });
        setFormValues({
            name: template.name || "",
            serviceId: template.serviceId || "",
            steps: Array.isArray(template.steps) && template.steps.length
                ? template.steps.map((step) => ({ title: step.title || "", description: step.description || "" }))
                : [EMPTY_STEP()],
        });
        setFormErrors(createBlankErrors());
        setSubmitError("");
    };

    const closeEditor = () => {
        setEditorState({ open: false, templateId: null });
        setFormValues(DEFAULT_FORM);
        setFormErrors(createBlankErrors());
        setSubmitError("");
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setSubmitError("");
        setFormErrors(createBlankErrors());

        try {
            const payload = buildPayload(formValues);
            const saved = editorState.templateId
                ? await workflowsApi.updateTemplate(editorState.templateId, payload)
                : await workflowsApi.createTemplate(payload);
            const normalized = normalizeTemplate(saved);
            setTemplates((current) => {
                if (!editorState.templateId) return [...current, normalized].sort((a, b) => a.name.localeCompare(b.name));
                return current
                    .map((template) => (template._id === editorState.templateId ? normalized : template))
                    .sort((a, b) => a.name.localeCompare(b.name));
            });
            notify(editorState.templateId ? "Runbook updated." : "Runbook created.", "success");
            onDataChanged();
            closeEditor();
        } catch (requestError) {
            const nextErrors = normalizeWorkflowErrors(requestError);
            const bannerMessage = nextErrors.form[0] || (requestError.code === "FORBIDDEN" ? requestError.message : "Please review the highlighted fields.");
            setFormErrors(nextErrors);
            setSubmitError(bannerMessage);
            notify(requestError.message || "Unable to save the runbook.", "error");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await workflowsApi.removeTemplate(deleteTarget._id);
            setTemplates((current) => current.filter((template) => template._id !== deleteTarget._id));
            setDeleteTarget(null);
            notify("Runbook deleted.", "success");
            onDataChanged();
        } catch (requestError) {
            notify(requestError.message || "Unable to delete the runbook.", "error");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Runbooks</h2>
                    <p className="subtitle">Reusable checklists automatically attached to new incidents for services that reference them.</p>
                </div>
                {isAdmin && (
                    <div className="page-header-actions">
                        <button className="button primary" type="button" onClick={openCreate}>
                            <Icon name="add" size={16} />
                            New runbook
                        </button>
                    </div>
                )}
            </div>

            {loading ? (
                <Spinner label="Loading runbooks" />
            ) : error ? (
                <ErrorBanner message={error} onRetry={loadTemplates} />
            ) : templates.length === 0 ? (
                <EmptyState
                    action={isAdmin ? <button className="button primary" type="button" onClick={openCreate}>Create your first runbook</button> : null}
                    description={isAdmin ? "Create reusable incident checklists for your services." : "No runbooks have been created yet."}
                    icon="workflows"
                    title="No runbooks yet"
                />
            ) : (
                <div className="card-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
                    {templates.map((template) => {
                        const serviceName = template.serviceId ? servicesById[String(template.serviceId)] || "Unknown service" : "Global";
                        return (
                            <div className="card" key={template._id}>
                                <div className="card-header">
                                    <div>
                                        <h3>{template.name}</h3>
                                    </div>
                                    <span className="badge neutral">{serviceName}</span>
                                    {isAdmin && (
                                        <div className="page-header-actions" style={{ marginLeft: "auto" }}>
                                            <button aria-label={`Edit ${template.name}`} className="icon-button" type="button" onClick={() => openEdit(template)}>
                                                <Icon name="edit" size={18} />
                                            </button>
                                            <button aria-label={`Delete ${template.name}`} className="icon-button" type="button" onClick={() => setDeleteTarget(template)}>
                                                <Icon name="trash" size={18} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="card-body">
                                    <ol className="step-list">
                                        {template.steps.map((step, index) => (
                                            <li key={`${template._id}-step-${index}`}>{step.title || `Step ${index + 1}`}</li>
                                        ))}
                                    </ol>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {editorState.open && isAdmin && (
                <RunbookFormModal
                    busy={submitting}
                    formErrors={formErrors}
                    isEditing={Boolean(editorState.templateId)}
                    services={services}
                    submitError={submitError}
                    values={formValues}
                    onChange={setFormValues}
                    onClose={closeEditor}
                    onSubmit={handleSubmit}
                />
            )}

            {deleteTarget && (
                <ConfirmDialog
                    busy={deleting}
                    confirmLabel="Delete runbook"
                    description="Removing this runbook is safe. Any in-progress incident checklist keeps its existing snapshot of these steps."
                    title={`Delete ${deleteTarget.name}?`}
                    tone="danger"
                    onClose={() => (deleting ? null : setDeleteTarget(null))}
                    onConfirm={handleDelete}
                />
            )}
        </div>
    );
}
