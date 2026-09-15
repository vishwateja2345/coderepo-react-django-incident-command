import { useCallback, useEffect, useMemo, useState } from "react";
import { escalationsApi } from "./escalations.api.js";
import { respondersApi } from "../responders/responders.api.js";
import { oncallApi } from "../oncall/oncall.api.js";
import { Icon } from "../../shared/components/Icon.jsx";
import { Modal } from "../../shared/components/Modal.jsx";
import { ConfirmDialog, EmptyState, ErrorBanner, Spinner } from "../../shared/components/Feedback.jsx";
import { notify } from "../../shared/utils/toast.js";

function createEmptyPolicyForm() {
    return {
        name: "",
        description: "",
        levels: [{ targetType: "responder", targetId: "", timeoutMinutes: "15" }],
    };
}

function buildPolicyForm(policy) {
    return {
        name: policy?.name || "",
        description: policy?.description || "",
        levels: (policy?.levels || []).map((level) => ({
            targetType: level.targetType || "responder",
            targetId: level.targetId || "",
            timeoutMinutes: String(level.timeoutMinutes || 15),
        })),
    };
}

function getFieldErrors(error) {
    return error?.details?.fieldErrors || {};
}

function getFormErrors(error) {
    return error?.details?.formErrors || [];
}

function getFieldError(fieldErrors, field) {
    return fieldErrors?.[field]?.[0] || "";
}

function parseLevelErrors(fieldErrors) {
    const rows = {};
    const general = [];

    Object.entries(fieldErrors || {}).forEach(([key, messages]) => {
        const match = key.match(/^levels\[(\d+)\]\.(.+)$/);
        if (match) {
            const index = Number(match[1]);
            const field = match[2];
            rows[index] = rows[index] || {};
            rows[index][field] = messages;
            return;
        }
        if (key === "levels" || key.startsWith("levels[")) general.push(...messages);
    });

    return { rows, general };
}

function isForbidden(error) {
    return error?.code === "FORBIDDEN";
}

function notifyMutationError(error, fallback = "Something went wrong.") {
    notify(isForbidden(error) ? "Your permissions changed. Refresh and try again." : error?.message || fallback, "error");
}

function LevelEditor({ canMoveDown, index, level, responders, rowErrors, schedules, onChange, onMove, onRemove }) {
    const targets = level.targetType === "schedule" ? schedules : responders;

    return (
        <li>
            <div>
                <div className="field-row">
                    <div className="field">
                        <label htmlFor={`policy-level-type-${index}`}>Target type</label>
                        <select
                            id={`policy-level-type-${index}`}
                            value={level.targetType}
                            onChange={(event) => onChange(index, "targetType", event.target.value)}
                        >
                            <option value="responder">Responder</option>
                            <option value="schedule">Schedule</option>
                        </select>
                        {rowErrors?.targetType?.[0] && <p className="field-error">{rowErrors.targetType[0]}</p>}
                    </div>

                    <div className="field">
                        <label htmlFor={`policy-level-target-${index}`}>Target</label>
                        <select id={`policy-level-target-${index}`} value={level.targetId} onChange={(event) => onChange(index, "targetId", event.target.value)}>
                            <option value="">Select a target</option>
                            {targets.map((target) => (
                                <option key={target._id} value={target._id}>
                                    {target.name}
                                </option>
                            ))}
                        </select>
                        {rowErrors?.targetId?.[0] && <p className="field-error">{rowErrors.targetId[0]}</p>}
                    </div>
                </div>

                <div className="field">
                    <label htmlFor={`policy-level-timeout-${index}`}>Timeout in minutes</label>
                    <input
                        id={`policy-level-timeout-${index}`}
                        max="1440"
                        min="1"
                        type="number"
                        value={level.timeoutMinutes}
                        onChange={(event) => onChange(index, "timeoutMinutes", event.target.value)}
                    />
                    {rowErrors?.timeoutMinutes?.[0] && <p className="field-error">{rowErrors.timeoutMinutes[0]}</p>}
                </div>
            </div>

            <div>
                <button aria-label={`Move level ${index + 1} up`} className="icon-button" disabled={index === 0} type="button" onClick={() => onMove(index, -1)}>
                    <Icon name="chevron_up" size={18} />
                </button>
                <button aria-label={`Move level ${index + 1} down`} className="icon-button" disabled={!canMoveDown} type="button" onClick={() => onMove(index, 1)}>
                    <Icon name="chevron_down" size={18} />
                </button>
                <button aria-label={`Remove level ${index + 1}`} className="icon-button" type="button" onClick={() => onRemove(index)}>
                    <Icon name="trash" size={18} />
                </button>
            </div>
        </li>
    );
}

function PolicyForm({ error, form, levelErrors, responders, schedules, onAddLevel, onChange, onLevelChange, onMoveLevel, onRemoveLevel }) {
    return (
        <>
            {getFormErrors(error).length > 0 && <div className="form-error-banner">{getFormErrors(error).join(" ")}</div>}

            <div className="field">
                <label htmlFor="policy-name">Name</label>
                <input id="policy-name" required type="text" value={form.name} onChange={(event) => onChange("name", event.target.value)} />
                {getFieldError(getFieldErrors(error), "name") && <p className="field-error">{getFieldError(getFieldErrors(error), "name")}</p>}
            </div>

            <div className="field">
                <label htmlFor="policy-description">Description</label>
                <textarea id="policy-description" value={form.description} onChange={(event) => onChange("description", event.target.value)} />
                {getFieldError(getFieldErrors(error), "description") && <p className="field-error">{getFieldError(getFieldErrors(error), "description")}</p>}
            </div>

            <div className="detail-section">
                <h3>Escalation levels</h3>
                {levelErrors.general.length > 0 && <div className="form-error-banner">{levelErrors.general.join(" ")}</div>}
                <ol className="step-list">
                    {form.levels.map((level, index) => (
                        <LevelEditor
                            canMoveDown={index < form.levels.length - 1}
                            index={index}
                            key={`level-${index}`}
                            level={level}
                            responders={responders}
                            rowErrors={levelErrors.rows[index]}
                            schedules={schedules}
                            onChange={onLevelChange}
                            onMove={onMoveLevel}
                            onRemove={onRemoveLevel}
                        />
                    ))}
                </ol>
                <div>
                    <button className="button ghost" type="button" onClick={onAddLevel}>
                        <Icon name="add" size={16} />
                        Add level
                    </button>
                </div>
            </div>
        </>
    );
}

export function EscalationsPage({ currentResponder, navRevision, onDataChanged }) {
    const isAdmin = currentResponder.role === "admin";
    const [policies, setPolicies] = useState([]);
    const [responders, setResponders] = useState([]);
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createForm, setCreateForm] = useState(createEmptyPolicyForm);
    const [createError, setCreateError] = useState(null);
    const [createBusy, setCreateBusy] = useState(false);
    const [selectedPolicyId, setSelectedPolicyId] = useState(null);
    const [selectedPolicy, setSelectedPolicy] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState("");
    const [editForm, setEditForm] = useState(createEmptyPolicyForm);
    const [editError, setEditError] = useState(null);
    const [saveBusy, setSaveBusy] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteBusy, setDeleteBusy] = useState(false);

    const loadPage = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [policyList, responderList, scheduleList] = await Promise.all([
                escalationsApi.list(),
                respondersApi.list(),
                oncallApi.list(),
            ]);
            setPolicies(policyList);
            setResponders(responderList);
            setSchedules(scheduleList);
        } catch (loadError) {
            setError(loadError.message || "Unable to load escalation policies.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPage();
    }, [loadPage, navRevision]);

    const loadPolicyDetail = useCallback(async (policyId) => {
        setDetailLoading(true);
        setDetailError("");
        try {
            const policy = await escalationsApi.get(policyId);
            setSelectedPolicy(policy);
            setEditForm(buildPolicyForm(policy));
        } catch (loadError) {
            setDetailError(loadError.message || "Unable to load escalation policy details.");
        } finally {
            setDetailLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!selectedPolicyId) return undefined;
        loadPolicyDetail(selectedPolicyId);
        return undefined;
    }, [loadPolicyDetail, selectedPolicyId]);

    const resetCreateModal = useCallback(() => {
        setIsCreateOpen(false);
        setCreateForm(createEmptyPolicyForm());
        setCreateError(null);
        setCreateBusy(false);
    }, []);

    const closeDetailModal = useCallback(() => {
        setSelectedPolicyId(null);
        setSelectedPolicy(null);
        setEditForm(createEmptyPolicyForm());
        setEditError(null);
        setDetailError("");
    }, []);

    const updateField = useCallback((setter) => (field, value) => {
        setter((current) => ({ ...current, [field]: value }));
    }, []);

    const updateLevelField = useCallback((setter) => (index, field, value) => {
        setter((current) => ({
            ...current,
            levels: current.levels.map((level, levelIndex) => {
                if (levelIndex !== index) return level;
                const nextLevel = { ...level, [field]: value };
                if (field === "targetType") nextLevel.targetId = "";
                return nextLevel;
            }),
        }));
    }, []);

    const moveLevel = useCallback((setter) => (index, direction) => {
        setter((current) => {
            const levels = [...current.levels];
            const nextIndex = index + direction;
            if (nextIndex < 0 || nextIndex >= levels.length) return current;
            [levels[index], levels[nextIndex]] = [levels[nextIndex], levels[index]];
            return { ...current, levels };
        });
    }, []);

    const removeLevel = useCallback((setter) => (index) => {
        setter((current) => ({ ...current, levels: current.levels.filter((_, levelIndex) => levelIndex !== index) }));
    }, []);

    const addLevel = useCallback((setter) => () => {
        setter((current) => ({
            ...current,
            levels: [...current.levels, { targetType: "responder", targetId: "", timeoutMinutes: "15" }],
        }));
    }, []);

    const buildPayload = useCallback((form) => ({
        name: form.name,
        description: form.description,
        levels: form.levels.map((level) => ({
            targetType: level.targetType,
            targetId: level.targetId,
            timeoutMinutes: Number(level.timeoutMinutes),
        })),
    }), []);

    const ensureLevels = useCallback((levels) => {
        if (levels.length > 0) return true;
        notify("Add at least one escalation level.", "error");
        return false;
    }, []);

    const handleCreateSubmit = useCallback(async (event) => {
        event.preventDefault();
        if (!ensureLevels(createForm.levels)) return;
        setCreateBusy(true);
        setCreateError(null);
        try {
            const created = await escalationsApi.create(buildPayload(createForm));
            setPolicies((current) => [created, ...current]);
            onDataChanged();
            notify("Escalation policy created", "success");
            resetCreateModal();
        } catch (submitError) {
            setCreateError(submitError);
            notifyMutationError(submitError, "Unable to create the escalation policy.");
        } finally {
            setCreateBusy(false);
        }
    }, [buildPayload, createForm, ensureLevels, onDataChanged, resetCreateModal]);

    const handleSavePolicy = useCallback(async (event) => {
        event.preventDefault();
        if (!selectedPolicy || !ensureLevels(editForm.levels)) return;
        setSaveBusy(true);
        setEditError(null);
        try {
            const updated = await escalationsApi.update(selectedPolicy._id, buildPayload(editForm));
            setSelectedPolicy(updated);
            setPolicies((current) => current.map((policy) => (policy._id === updated._id ? updated : policy)));
            onDataChanged();
            notify("Escalation policy updated", "success");
        } catch (submitError) {
            setEditError(submitError);
            notifyMutationError(submitError, "Unable to update the escalation policy.");
        } finally {
            setSaveBusy(false);
        }
    }, [buildPayload, editForm, ensureLevels, onDataChanged, selectedPolicy]);

    const confirmDeletePolicy = useCallback(async () => {
        if (!deleteTarget) return;
        setDeleteBusy(true);
        try {
            await escalationsApi.remove(deleteTarget._id);
            setPolicies((current) => current.filter((policy) => policy._id !== deleteTarget._id));
            if (selectedPolicyId === deleteTarget._id) closeDetailModal();
            onDataChanged();
            setDeleteTarget(null);
            notify("Escalation policy deleted", "success");
        } catch (deleteError) {
            notifyMutationError(deleteError, "Unable to delete the escalation policy.");
        } finally {
            setDeleteBusy(false);
        }
    }, [closeDetailModal, deleteTarget, onDataChanged, selectedPolicyId]);

    const updateCreateField = updateField(setCreateForm);
    const updateEditField = updateField(setEditForm);
    const createLevelChange = updateLevelField(setCreateForm);
    const editLevelChange = updateLevelField(setEditForm);
    const createMoveLevel = moveLevel(setCreateForm);
    const editMoveLevel = moveLevel(setEditForm);
    const createRemoveLevel = removeLevel(setCreateForm);
    const editRemoveLevel = removeLevel(setEditForm);
    const addCreateLevel = addLevel(setCreateForm);
    const addEditLevel = addLevel(setEditForm);
    const createLevelErrors = useMemo(() => parseLevelErrors(getFieldErrors(createError)), [createError]);
    const editLevelErrors = useMemo(() => parseLevelErrors(getFieldErrors(editError)), [editError]);

    const emptyAction = isAdmin ? (
        <button className="button primary" type="button" onClick={() => setIsCreateOpen(true)}>
            <Icon name="add" size={16} />
            New policy
        </button>
    ) : null;

    return (
        <>
            <div className="page-header">
                <div>
                    <h2>Escalation Policies</h2>
                    <p className="subtitle">Define ordered responder levels and how long each level waits before escalating.</p>
                </div>
                {isAdmin && (
                    <div className="page-header-actions">
                        <button className="button primary" type="button" onClick={() => setIsCreateOpen(true)}>
                            <Icon name="add" size={16} />
                            New policy
                        </button>
                    </div>
                )}
            </div>

            {loading && <Spinner label="Loading escalation policies" />}
            {!loading && error && <ErrorBanner message={error} onRetry={loadPage} />}
            {!loading && !error && policies.length === 0 && (
                <EmptyState
                    action={emptyAction}
                    description={isAdmin ? "Create a policy so incidents can notify the right people in order." : "No escalation policies are available yet."}
                    icon="escalations"
                    title="No escalation policies yet"
                />
            )}

            {!loading && !error && policies.length > 0 && (
                <div className="card-grid">
                    {policies.map((policy) => (
                        <div
                            aria-label={`Open ${policy.name}`}
                            className="card"
                            key={policy._id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedPolicyId(policy._id)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    setSelectedPolicyId(policy._id);
                                }
                            }}
                        >
                            <div className="card-header">
                                <h3>{policy.name}</h3>
                                {isAdmin && (
                                    <div className="page-header-actions" onClick={(event) => event.stopPropagation()}>
                                        <button className="icon-button" title="Edit policy" type="button" onClick={() => setSelectedPolicyId(policy._id)}>
                                            <Icon name="edit" size={18} />
                                        </button>
                                        <button className="icon-button" title="Delete policy" type="button" onClick={() => setDeleteTarget(policy)}>
                                            <Icon name="trash" size={18} />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="card-body">
                                <div className="detail-section">
                                    <p>{policy.description || "No description provided."}</p>
                                    <ol className="step-list">
                                        {policy.levels.map((level) => (
                                            <li key={`${policy._id}-${level.order}`}>
                                                <span>
                                                    Level {level.order}: {level.targetName} — escalate after {level.timeoutMinutes}m
                                                </span>
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isCreateOpen && (
                <Modal label="Create escalation policy" onClose={resetCreateModal}>
                    <div className="modal-header">
                        <h2>New policy</h2>
                        <button aria-label="Close" className="icon-button" type="button" onClick={resetCreateModal}>
                            <Icon name="close" />
                        </button>
                    </div>
                    <form onSubmit={handleCreateSubmit}>
                        <div className="modal-body">
                            <PolicyForm
                                error={createError}
                                form={createForm}
                                levelErrors={createLevelErrors}
                                responders={responders}
                                schedules={schedules}
                                onAddLevel={addCreateLevel}
                                onChange={updateCreateField}
                                onLevelChange={createLevelChange}
                                onMoveLevel={createMoveLevel}
                                onRemoveLevel={createRemoveLevel}
                            />
                        </div>
                        <div className="modal-footer">
                            <button className="button ghost" type="button" onClick={resetCreateModal}>
                                Cancel
                            </button>
                            <button autoFocus className="button primary" disabled={createBusy} type="submit">
                                {createBusy ? "Creating…" : "Create policy"}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {selectedPolicyId && (
                <Modal label={selectedPolicy?.name || "Escalation policy"} onClose={closeDetailModal}>
                    <div className="modal-header">
                        <h2>{selectedPolicy?.name || "Escalation policy"}</h2>
                        <button aria-label="Close" className="icon-button" type="button" onClick={closeDetailModal}>
                            <Icon name="close" />
                        </button>
                    </div>

                    {detailLoading && (
                        <div className="modal-body">
                            <Spinner label="Loading escalation policy details" />
                        </div>
                    )}

                    {!detailLoading && detailError && (
                        <div className="modal-body">
                            <ErrorBanner message={detailError} onRetry={() => loadPolicyDetail(selectedPolicyId)} />
                        </div>
                    )}

                    {!detailLoading && !detailError && selectedPolicy && !isAdmin && (
                        <>
                            <div className="modal-body">
                                <div className="detail-section">
                                    <h3>Overview</h3>
                                    <p>{selectedPolicy.description || "No description provided."}</p>
                                </div>
                                <div className="detail-section">
                                    <h3>Levels</h3>
                                    <ol className="step-list">
                                        {selectedPolicy.levels.map((level) => (
                                            <li key={`${selectedPolicy._id}-${level.order}`}>
                                                <span>
                                                    Level {level.order}: {level.targetName} — escalate after {level.timeoutMinutes}m
                                                </span>
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button autoFocus className="button primary" type="button" onClick={closeDetailModal}>
                                    Close
                                </button>
                            </div>
                        </>
                    )}

                    {!detailLoading && !detailError && selectedPolicy && isAdmin && (
                        <form onSubmit={handleSavePolicy}>
                            <div className="modal-body">
                                <PolicyForm
                                    error={editError}
                                    form={editForm}
                                    levelErrors={editLevelErrors}
                                    responders={responders}
                                    schedules={schedules}
                                    onAddLevel={addEditLevel}
                                    onChange={updateEditField}
                                    onLevelChange={editLevelChange}
                                    onMoveLevel={editMoveLevel}
                                    onRemoveLevel={editRemoveLevel}
                                />
                            </div>
                            <div className="modal-footer">
                                <button className="button danger" type="button" onClick={() => setDeleteTarget(selectedPolicy)}>
                                    Delete
                                </button>
                                <button className="button ghost" type="button" onClick={closeDetailModal}>
                                    Cancel
                                </button>
                                <button autoFocus className="button primary" disabled={saveBusy} type="submit">
                                    {saveBusy ? "Saving…" : "Save changes"}
                                </button>
                            </div>
                        </form>
                    )}
                </Modal>
            )}

            {deleteTarget && (
                <ConfirmDialog
                    busy={deleteBusy}
                    confirmLabel="Delete policy"
                    description={`Delete ${deleteTarget.name}? Services using it will need another escalation policy.`}
                    title="Delete escalation policy"
                    tone="danger"
                    onClose={() => !deleteBusy && setDeleteTarget(null)}
                    onConfirm={confirmDeletePolicy}
                />
            )}
        </>
    );
}
