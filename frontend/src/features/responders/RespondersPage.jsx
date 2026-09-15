import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar } from "../../shared/components/Badge.jsx";
import { EmptyState, ErrorBanner, Spinner } from "../../shared/components/Feedback.jsx";
import { Icon } from "../../shared/components/Icon.jsx";
import { Modal } from "../../shared/components/Modal.jsx";
import { notify } from "../../shared/utils/toast.js";
import { respondersApi } from "./responders.api.js";

const EMPTY_ADD_FORM = {
    name: "",
    email: "",
    password: "",
    title: "",
    phone: "",
    role: "responder",
};

function createEditForm(responder, isSelf) {
    return {
        name: responder?.name || "",
        title: responder?.title || "",
        phone: responder?.phone || "",
        role: isSelf ? "responder" : responder?.role || "responder",
        active: isSelf ? true : responder?.active ?? true,
    };
}

function getMessage(error, fallback) {
    return error?.message || fallback;
}

function normalizeErrors(error) {
    return {
        form: Array.isArray(error?.details?.formErrors) ? error.details.formErrors : [],
        fields: error?.details?.fieldErrors && typeof error.details.fieldErrors === "object" ? error.details.fieldErrors : {},
    };
}

function fieldError(errors, name) {
    const value = errors.fields?.[name];
    return Array.isArray(value) ? value.join(" ") : value || "";
}

function ResponderModal({
    busy,
    errors,
    mode,
    responder,
    values,
    onChange,
    onClose,
    onSubmit,
}) {
    const isCreate = mode === "create";
    const isSelf = mode === "self";

    return (
        <Modal label={isCreate ? "Add responder" : `Edit ${responder?.name || "responder"}`} onClose={onClose}>
            <form onSubmit={onSubmit}>
                <div className="modal-header">
                    <h2>{isCreate ? "Add responder" : isSelf ? "Edit your profile" : `Edit ${responder?.name}`}</h2>
                    <button aria-label="Close" className="icon-button" type="button" onClick={onClose}>
                        <Icon name="close" size={18} />
                    </button>
                </div>
                <div className="modal-body">
                    {errors.form.length > 0 && <div className="form-error-banner" role="alert">{errors.form.join(" ")}</div>}
                    <div className="field-row">
                        <div className="field">
                            <label htmlFor="responder-name">Name</label>
                            <input
                                data-autofocus
                                id="responder-name"
                                required
                                value={values.name}
                                onChange={(event) => onChange({ ...values, name: event.target.value })}
                            />
                            {fieldError(errors, "name") && <div className="field-error">{fieldError(errors, "name")}</div>}
                        </div>
                        {isCreate && (
                            <div className="field">
                                <label htmlFor="responder-email">Email</label>
                                <input
                                    id="responder-email"
                                    required
                                    type="email"
                                    value={values.email}
                                    onChange={(event) => onChange({ ...values, email: event.target.value })}
                                />
                                {fieldError(errors, "email") && <div className="field-error">{fieldError(errors, "email")}</div>}
                            </div>
                        )}
                    </div>
                    {isCreate && (
                        <div className="field">
                            <label htmlFor="responder-password">Password</label>
                            <input
                                id="responder-password"
                                minLength={8}
                                required
                                type="password"
                                value={values.password}
                                onChange={(event) => onChange({ ...values, password: event.target.value })}
                            />
                            <div className="hint">Minimum 8 characters.</div>
                            {fieldError(errors, "password") && <div className="field-error">{fieldError(errors, "password")}</div>}
                        </div>
                    )}
                    <div className="field-row">
                        <div className="field">
                            <label htmlFor="responder-title">Title</label>
                            <input id="responder-title" value={values.title} onChange={(event) => onChange({ ...values, title: event.target.value })} />
                            {fieldError(errors, "title") && <div className="field-error">{fieldError(errors, "title")}</div>}
                        </div>
                        <div className="field">
                            <label htmlFor="responder-phone">Phone</label>
                            <input id="responder-phone" value={values.phone} onChange={(event) => onChange({ ...values, phone: event.target.value })} />
                            {fieldError(errors, "phone") && <div className="field-error">{fieldError(errors, "phone")}</div>}
                        </div>
                    </div>
                    {(isCreate || !isSelf) && (
                        <div className="field-row">
                            <div className="field">
                                <label htmlFor="responder-role">Role</label>
                                <select id="responder-role" value={values.role} onChange={(event) => onChange({ ...values, role: event.target.value })}>
                                    <option value="responder">Responder</option>
                                    <option value="admin">Admin</option>
                                </select>
                                {fieldError(errors, "role") && <div className="field-error">{fieldError(errors, "role")}</div>}
                            </div>
                            {!isSelf && !isCreate && (
                                <label className="checkbox-field" htmlFor="responder-active" style={{ alignSelf: "end", paddingBottom: 8 }}>
                                    <input
                                        checked={Boolean(values.active)}
                                        id="responder-active"
                                        type="checkbox"
                                        onChange={(event) => onChange({ ...values, active: event.target.checked })}
                                    />
                                    Active responder
                                </label>
                            )}
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <button className="button ghost" disabled={busy} type="button" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="button primary" disabled={busy} type="submit">
                        {busy ? "Saving…" : isCreate ? "Add responder" : "Save changes"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

export function RespondersPage({ currentResponder, navRevision, onDataChanged }) {
    const isAdmin = currentResponder.role === "admin";
    const [responders, setResponders] = useState([]);
    const [showInactive, setShowInactive] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [modalState, setModalState] = useState({ open: false, mode: "create", responder: null });
    const [formValues, setFormValues] = useState(EMPTY_ADD_FORM);
    const [formErrors, setFormErrors] = useState({ form: [], fields: {} });
    const [submitting, setSubmitting] = useState(false);

    const loadResponders = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const data = await respondersApi.list(showInactive);
            setResponders(Array.isArray(data) ? data : []);
        } catch (requestError) {
            setError(getMessage(requestError, "Unable to load responders right now."));
        } finally {
            setLoading(false);
        }
    }, [showInactive]);

    useEffect(() => {
        loadResponders();
    }, [loadResponders, navRevision]);

    const sortedResponders = useMemo(() => {
        return [...responders].sort((a, b) => {
            if (a.active !== b.active) return a.active ? -1 : 1;
            return (a.name || "").localeCompare(b.name || "");
        });
    }, [responders]);

    const closeModal = () => {
        setModalState({ open: false, mode: "create", responder: null });
        setFormValues(EMPTY_ADD_FORM);
        setFormErrors({ form: [], fields: {} });
    };

    const openCreateModal = () => {
        setModalState({ open: true, mode: "create", responder: null });
        setFormValues(EMPTY_ADD_FORM);
        setFormErrors({ form: [], fields: {} });
    };

    const openEditModal = (responder) => {
        const isSelf = responder._id === currentResponder._id;
        setModalState({ open: true, mode: isSelf ? "self" : "admin-edit", responder });
        setFormValues(createEditForm(responder, isSelf));
        setFormErrors({ form: [], fields: {} });
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setFormErrors({ form: [], fields: {} });

        try {
            if (modalState.mode === "create") {
                const created = await respondersApi.create({
                    name: formValues.name.trim(),
                    email: formValues.email.trim(),
                    password: formValues.password,
                    title: formValues.title.trim(),
                    phone: formValues.phone.trim(),
                    role: formValues.role,
                });
                notify("Responder added.", "success");
                closeModal();
                if (!showInactive || created.active !== false) {
                    setResponders((current) => [...current, created]);
                } else {
                    await loadResponders();
                }
                onDataChanged();
                return;
            }

            const isSelf = modalState.mode === "self";
            const payload = {
                name: formValues.name.trim(),
                title: formValues.title.trim(),
                phone: formValues.phone.trim(),
            };

            if (!isSelf) {
                payload.role = formValues.role;
                payload.active = Boolean(formValues.active);
            }

            const updated = await respondersApi.update(modalState.responder._id, payload);
            setResponders((current) => current.map((item) => (item._id === updated._id ? updated : item)));
            if (updated._id === currentResponder._id) Object.assign(currentResponder, updated);
            notify("Responder updated.", "success");
            closeModal();
            if (!showInactive && updated.active === false) {
                await loadResponders();
            }
            onDataChanged();
        } catch (requestError) {
            const nextErrors = normalizeErrors(requestError);
            if (requestError.code === "EMAIL_IN_USE") nextErrors.form = [requestError.message];
            else if (!nextErrors.form.length) nextErrors.form = [requestError.message || "Please review the highlighted fields."];
            setFormErrors(nextErrors);
            notify(requestError.message || "Unable to save responder changes.", "error");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Team</h2>
                    <p className="subtitle">Manage who can respond to incidents, own services, and administer the workspace.</p>
                </div>
                {isAdmin && (
                    <div className="page-header-actions">
                        <button className="button primary" type="button" onClick={openCreateModal}>
                            <Icon name="add" size={16} />
                            Add responder
                        </button>
                    </div>
                )}
            </div>

            <div className="page-toolbar">
                <label className="checkbox-field" htmlFor="show-inactive-responders">
                    <input
                        checked={showInactive}
                        id="show-inactive-responders"
                        type="checkbox"
                        onChange={(event) => setShowInactive(event.target.checked)}
                    />
                    Show inactive responders
                </label>
            </div>

            {loading ? (
                <Spinner label="Loading responders" />
            ) : error ? (
                <ErrorBanner message={error} onRetry={loadResponders} />
            ) : sortedResponders.length === 0 ? (
                <EmptyState
                    action={isAdmin ? <button className="button primary" type="button" onClick={openCreateModal}>Add the first responder</button> : null}
                    description={showInactive ? "No responders match the current filter." : "No active responders are available."}
                    icon="users"
                    title="No responders found"
                />
            ) : (
                <div className="card-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
                    {sortedResponders.map((responder) => {
                        const isSelf = responder._id === currentResponder._id;
                        const canOpen = isSelf || isAdmin;
                        const cardContent = (
                            <>
                                <Avatar color={responder.avatarColor} name={responder.name} size="large" />
                                <div className="responder-meta" style={{ flex: 1 }}>
                                    <strong>{responder.name}</strong>
                                    <span>{responder.title || "No title"}</span>
                                    <div style={{ marginTop: 8, display: "grid", gap: 4, fontSize: 12.5, color: "var(--muted)" }}>
                                        <span>{responder.email}</span>
                                        <span>{responder.phone || "No phone on file"}</span>
                                    </div>
                                </div>
                                <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                                    <span className="badge neutral">{responder.role === "admin" ? "Admin" : "Responder"}</span>
                                    {!responder.active && <span className="badge neutral">Inactive</span>}
                                </div>
                            </>
                        );

                        if (!canOpen) {
                            return (
                                <div className="responder-card" key={responder._id} style={{ opacity: responder.active ? 1 : 0.6 }}>
                                    {cardContent}
                                </div>
                            );
                        }

                        return (
                            <button
                                className="responder-card"
                                key={responder._id}
                                style={{ width: "100%", textAlign: "left", opacity: responder.active ? 1 : 0.6 }}
                                type="button"
                                onClick={() => openEditModal(responder)}
                            >
                                {cardContent}
                            </button>
                        );
                    })}
                </div>
            )}

            {modalState.open && (
                <ResponderModal
                    busy={submitting}
                    errors={formErrors}
                    mode={modalState.mode}
                    responder={modalState.responder}
                    values={formValues}
                    onChange={setFormValues}
                    onClose={closeModal}
                    onSubmit={handleSubmit}
                />
            )}
        </div>
    );
}
