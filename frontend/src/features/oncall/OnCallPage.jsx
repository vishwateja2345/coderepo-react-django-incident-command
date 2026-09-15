import { useCallback, useEffect, useMemo, useState } from "react";
import { oncallApi } from "./oncall.api.js";
import { respondersApi } from "../responders/responders.api.js";
import { Icon } from "../../shared/components/Icon.jsx";
import { Modal } from "../../shared/components/Modal.jsx";
import { Avatar } from "../../shared/components/Badge.jsx";
import { ConfirmDialog, EmptyState, ErrorBanner, Spinner } from "../../shared/components/Feedback.jsx";
import { notify } from "../../shared/utils/toast.js";
import { formatDay, formatTime } from "../../shared/utils/format.js";

const TIME_ZONES = [
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Phoenix",
    "America/Toronto",
    "America/Sao_Paulo",
    "Europe/London",
    "Europe/Berlin",
    "Europe/Paris",
    "Europe/Amsterdam",
    "Asia/Kolkata",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Asia/Dubai",
    "Australia/Sydney",
    "Pacific/Auckland",
];

function toDateTimeLocalValue(value) {
    if (!value) return "";
    const date = new Date(value);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
}

function createEmptyScheduleForm() {
    return {
        name: "",
        description: "",
        timeZone: "UTC",
        responderIds: [],
        rotationType: "weekly",
        shiftLengthHours: "168",
        handoffTime: "09:00",
        rotationStartAt: "",
    };
}

function createEmptyOverrideForm(responderId = "") {
    return {
        responderId,
        startAt: "",
        endAt: "",
        reason: "",
    };
}

function buildScheduleForm(schedule) {
    return {
        name: schedule?.name || "",
        description: schedule?.description || "",
        timeZone: schedule?.timeZone || "UTC",
        responderIds: schedule?.responderIds || schedule?.responders?.map((responder) => responder._id) || [],
        rotationType: schedule?.rotationType || "weekly",
        shiftLengthHours: String(schedule?.shiftLengthHours || 168),
        handoffTime: schedule?.handoffTime || "09:00",
        rotationStartAt: toDateTimeLocalValue(schedule?.rotationStartAt),
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

function isForbidden(error) {
    return error?.code === "FORBIDDEN";
}

function notifyMutationError(error, fallback = "Something went wrong.") {
    notify(isForbidden(error) ? "Your permissions changed. Refresh and try again." : error?.message || fallback, "error");
}

function ScheduleFormFields({ form, fieldErrors, responders, responderMap, onChange, onMoveResponder, onToggleResponder }) {
    return (
        <>
            <div className="field">
                <label htmlFor="schedule-name">Name</label>
                <input id="schedule-name" required type="text" value={form.name} onChange={(event) => onChange("name", event.target.value)} />
                {getFieldError(fieldErrors, "name") && <p className="field-error">{getFieldError(fieldErrors, "name")}</p>}
            </div>

            <div className="field">
                <label htmlFor="schedule-description">Description</label>
                <textarea id="schedule-description" value={form.description} onChange={(event) => onChange("description", event.target.value)} />
                {getFieldError(fieldErrors, "description") && <p className="field-error">{getFieldError(fieldErrors, "description")}</p>}
            </div>

            <div className="field-row">
                <div className="field">
                    <label htmlFor="schedule-time-zone">Time zone</label>
                    <select id="schedule-time-zone" value={form.timeZone} onChange={(event) => onChange("timeZone", event.target.value)}>
                        {TIME_ZONES.map((zone) => (
                            <option key={zone} value={zone}>
                                {zone}
                            </option>
                        ))}
                    </select>
                    {getFieldError(fieldErrors, "timeZone") && <p className="field-error">{getFieldError(fieldErrors, "timeZone")}</p>}
                </div>

                <div className="field">
                    <label htmlFor="schedule-rotation-type">Rotation type</label>
                    <select id="schedule-rotation-type" value={form.rotationType} onChange={(event) => onChange("rotationType", event.target.value)}>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="custom">Custom</option>
                    </select>
                    {getFieldError(fieldErrors, "rotationType") && <p className="field-error">{getFieldError(fieldErrors, "rotationType")}</p>}
                </div>
            </div>

            <div className="field-row">
                <div className="field">
                    <label htmlFor="schedule-shift-length">Shift length in hours</label>
                    <input
                        id="schedule-shift-length"
                        min="1"
                        type="number"
                        value={form.shiftLengthHours}
                        onChange={(event) => onChange("shiftLengthHours", event.target.value)}
                    />
                    {getFieldError(fieldErrors, "shiftLengthHours") && <p className="field-error">{getFieldError(fieldErrors, "shiftLengthHours")}</p>}
                </div>

                <div className="field">
                    <label htmlFor="schedule-handoff-time">Handoff time</label>
                    <input id="schedule-handoff-time" type="time" value={form.handoffTime} onChange={(event) => onChange("handoffTime", event.target.value)} />
                    {getFieldError(fieldErrors, "handoffTime") && <p className="field-error">{getFieldError(fieldErrors, "handoffTime")}</p>}
                </div>
            </div>

            <div className="field">
                <label htmlFor="schedule-rotation-start">Rotation start</label>
                <input
                    id="schedule-rotation-start"
                    type="datetime-local"
                    value={form.rotationStartAt}
                    onChange={(event) => onChange("rotationStartAt", event.target.value)}
                />
                {getFieldError(fieldErrors, "rotationStartAt") && <p className="field-error">{getFieldError(fieldErrors, "rotationStartAt")}</p>}
            </div>

            <fieldset className="field">
                <label>Responders</label>
                <div className="detail-section">
                    {responders.map((responder) => (
                        <label className="checkbox-field" htmlFor={`schedule-responder-${responder._id}`} key={responder._id}>
                            <input
                                checked={form.responderIds.includes(responder._id)}
                                id={`schedule-responder-${responder._id}`}
                                type="checkbox"
                                onChange={() => onToggleResponder(responder._id)}
                            />
                            <span>{responder.name}</span>
                        </label>
                    ))}
                </div>
                {getFieldError(fieldErrors, "responderIds") && <p className="field-error">{getFieldError(fieldErrors, "responderIds")}</p>}
            </fieldset>

            <div className="detail-section">
                <h3>Rotation order</h3>
                {form.responderIds.length === 0 ? (
                    <p>Select at least one responder to build the rotation.</p>
                ) : (
                    <ol className="step-list">
                        {form.responderIds.map((responderId, index) => (
                            <li key={`${responderId}-${index}`}>
                                <span>
                                    {index + 1}. {responderMap[responderId]?.name || "Unknown responder"}
                                </span>
                                <button
                                    aria-label={`Move ${responderMap[responderId]?.name || "responder"} earlier`}
                                    className="icon-button"
                                    disabled={index === 0}
                                    type="button"
                                    onClick={() => onMoveResponder(index, -1)}
                                >
                                    <Icon name="chevron_up" size={18} />
                                </button>
                                <button
                                    aria-label={`Move ${responderMap[responderId]?.name || "responder"} later`}
                                    className="icon-button"
                                    disabled={index === form.responderIds.length - 1}
                                    type="button"
                                    onClick={() => onMoveResponder(index, 1)}
                                >
                                    <Icon name="chevron_down" size={18} />
                                </button>
                            </li>
                        ))}
                    </ol>
                )}
            </div>
        </>
    );
}

function ShiftsTable({ shifts }) {
    if (shifts.length === 0) {
        return <EmptyState description="Add responders to this rotation to preview upcoming shifts." icon="clock" title="No upcoming shifts" />;
    }

    return (
        <div className="table-wrap">
            <table className="data-table">
                <thead>
                    <tr>
                        <th>Window</th>
                        <th>Responder</th>
                        <th>Type</th>
                    </tr>
                </thead>
                <tbody>
                    {shifts.map((shift) => (
                        <tr key={`${shift.startAt}-${shift.responderId}-${shift.isOverride}`}>
                            <td>
                                {formatDay(shift.startAt)} {formatTime(shift.startAt)} – {formatDay(shift.endAt)} {formatTime(shift.endAt)}
                            </td>
                            <td>{shift.responderName || "Unassigned"}</td>
                            <td>{shift.isOverride ? "(override)" : "Rotation"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function OverridesTable({ overrides, onRemove }) {
    if (overrides.length === 0) {
        return <EmptyState description="Use overrides for vacations, swaps, or temporary coverage changes." icon="refresh" title="No active overrides" />;
    }

    return (
        <div className="table-wrap">
            <table className="data-table">
                <thead>
                    <tr>
                        <th>Responder</th>
                        <th>Window</th>
                        <th>Reason</th>
                        <th />
                    </tr>
                </thead>
                <tbody>
                    {overrides.map((override) => (
                        <tr key={override._id}>
                            <td>{override.responderName}</td>
                            <td>
                                {formatDay(override.startAt)} {formatTime(override.startAt)} – {formatDay(override.endAt)} {formatTime(override.endAt)}
                            </td>
                            <td>{override.reason || "—"}</td>
                            <td>
                                <button className="button ghost small" type="button" onClick={() => onRemove(override)}>
                                    Remove
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function OverrideFormFields({ busy, fieldErrors, form, responders, onChange }) {
    return (
        <>
            <div className="field">
                <label htmlFor="override-responder">Responder</label>
                <select id="override-responder" value={form.responderId} onChange={(event) => onChange("responderId", event.target.value)}>
                    <option value="">Select a responder</option>
                    {responders.map((responder) => (
                        <option key={responder._id} value={responder._id}>
                            {responder.name}
                        </option>
                    ))}
                </select>
                {getFieldError(fieldErrors, "responderId") && <p className="field-error">{getFieldError(fieldErrors, "responderId")}</p>}
            </div>

            <div className="field-row">
                <div className="field">
                    <label htmlFor="override-start">Start</label>
                    <input id="override-start" type="datetime-local" value={form.startAt} onChange={(event) => onChange("startAt", event.target.value)} />
                    {getFieldError(fieldErrors, "startAt") && <p className="field-error">{getFieldError(fieldErrors, "startAt")}</p>}
                </div>

                <div className="field">
                    <label htmlFor="override-end">End</label>
                    <input id="override-end" type="datetime-local" value={form.endAt} onChange={(event) => onChange("endAt", event.target.value)} />
                    {getFieldError(fieldErrors, "endAt") && <p className="field-error">{getFieldError(fieldErrors, "endAt")}</p>}
                </div>
            </div>

            <div className="field">
                <label htmlFor="override-reason">Reason</label>
                <input id="override-reason" type="text" value={form.reason} onChange={(event) => onChange("reason", event.target.value)} />
                {getFieldError(fieldErrors, "reason") && <p className="field-error">{getFieldError(fieldErrors, "reason")}</p>}
            </div>

            <div>
                <button className="button primary" disabled={busy} type="submit">
                    {busy ? "Adding…" : "Add override"}
                </button>
            </div>
        </>
    );
}

export function OnCallPage({ currentResponder, navRevision, onDataChanged }) {
    const isAdmin = currentResponder.role === "admin";
    const [schedules, setSchedules] = useState([]);
    const [responders, setResponders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createForm, setCreateForm] = useState(createEmptyScheduleForm);
    const [createError, setCreateError] = useState(null);
    const [createBusy, setCreateBusy] = useState(false);
    const [selectedScheduleId, setSelectedScheduleId] = useState(null);
    const [selectedSchedule, setSelectedSchedule] = useState(null);
    const [scheduleForm, setScheduleForm] = useState(createEmptyScheduleForm);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState("");
    const [saveError, setSaveError] = useState(null);
    const [saveBusy, setSaveBusy] = useState(false);
    const [activeTab, setActiveTab] = useState("shifts");
    const [shifts, setShifts] = useState([]);
    const [overrides, setOverrides] = useState([]);
    const [overrideForm, setOverrideForm] = useState(createEmptyOverrideForm);
    const [overrideError, setOverrideError] = useState(null);
    const [overrideBusy, setOverrideBusy] = useState(false);
    const [removeOverrideTarget, setRemoveOverrideTarget] = useState(null);
    const [removeOverrideBusy, setRemoveOverrideBusy] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteBusy, setDeleteBusy] = useState(false);

    const responderMap = useMemo(() => Object.fromEntries(responders.map((responder) => [responder._id, responder])), [responders]);

    const loadPage = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [scheduleList, responderList] = await Promise.all([oncallApi.list(), respondersApi.list()]);
            setSchedules(scheduleList);
            setResponders(responderList);
        } catch (loadError) {
            setError(loadError.message || "Unable to load on-call schedules.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPage();
    }, [loadPage, navRevision]);

    const loadScheduleDetail = useCallback(async (scheduleId) => {
        setDetailLoading(true);
        setDetailError("");
        try {
            const [schedule, upcomingShifts, currentOverrides] = await Promise.all([
                oncallApi.get(scheduleId),
                oncallApi.shifts(scheduleId),
                oncallApi.listOverrides(scheduleId),
            ]);
            setSelectedSchedule(schedule);
            setScheduleForm(buildScheduleForm(schedule));
            setShifts(upcomingShifts);
            setOverrides(currentOverrides);
            setOverrideForm((current) => createEmptyOverrideForm(current.responderId || schedule.currentResponderId || responders[0]?._id || ""));
        } catch (loadError) {
            setDetailError(loadError.message || "Unable to load schedule details.");
        } finally {
            setDetailLoading(false);
        }
    }, [responders]);

    useEffect(() => {
        if (!selectedScheduleId) return undefined;
        loadScheduleDetail(selectedScheduleId);
        return undefined;
    }, [loadScheduleDetail, selectedScheduleId]);

    const resetCreateModal = useCallback(() => {
        setIsCreateOpen(false);
        setCreateForm(createEmptyScheduleForm());
        setCreateError(null);
        setCreateBusy(false);
    }, []);

    const closeDetailModal = useCallback(() => {
        setSelectedScheduleId(null);
        setSelectedSchedule(null);
        setScheduleForm(createEmptyScheduleForm());
        setSaveError(null);
        setDetailError("");
        setActiveTab("shifts");
        setShifts([]);
        setOverrides([]);
        setOverrideForm(createEmptyOverrideForm());
        setOverrideError(null);
    }, []);

    const updateCreateField = useCallback((field, value) => {
        setCreateForm((current) => ({ ...current, [field]: value }));
    }, []);

    const updateScheduleField = useCallback((field, value) => {
        setScheduleForm((current) => ({ ...current, [field]: value }));
    }, []);

    const updateOverrideField = useCallback((field, value) => {
        setOverrideForm((current) => ({ ...current, [field]: value }));
    }, []);

    const toggleResponder = useCallback((setter) => (responderId) => {
        setter((current) => ({
            ...current,
            responderIds: current.responderIds.includes(responderId)
                ? current.responderIds.filter((value) => value !== responderId)
                : [...current.responderIds, responderId],
        }));
    }, []);

    const moveResponder = useCallback((setter) => (index, direction) => {
        setter((current) => {
            const next = [...current.responderIds];
            const targetIndex = index + direction;
            if (targetIndex < 0 || targetIndex >= next.length) return current;
            [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
            return { ...current, responderIds: next };
        });
    }, []);

    const buildSchedulePayload = useCallback((form) => ({
        name: form.name,
        description: form.description,
        timeZone: form.timeZone,
        responderIds: form.responderIds,
        rotationType: form.rotationType,
        shiftLengthHours: Number(form.shiftLengthHours),
        handoffTime: form.handoffTime,
        rotationStartAt: form.rotationStartAt ? new Date(form.rotationStartAt).toISOString() : "",
    }), []);

    const refreshSelectedSchedule = useCallback(async (scheduleId) => {
        const [schedule, upcomingShifts, currentOverrides] = await Promise.all([
            oncallApi.get(scheduleId),
            oncallApi.shifts(scheduleId),
            oncallApi.listOverrides(scheduleId),
        ]);
        setSelectedSchedule(schedule);
        setSchedules((current) => current.map((item) => (item._id === schedule._id ? schedule : item)));
        setShifts(upcomingShifts);
        setOverrides(currentOverrides);
        return schedule;
    }, []);

    const handleCreateSubmit = useCallback(async (event) => {
        event.preventDefault();
        setCreateBusy(true);
        setCreateError(null);
        try {
            const created = await oncallApi.create(buildSchedulePayload(createForm));
            setSchedules((current) => [created, ...current]);
            onDataChanged();
            notify("On-call schedule created", "success");
            resetCreateModal();
        } catch (submitError) {
            setCreateError(submitError);
            notifyMutationError(submitError, "Unable to create the schedule.");
        } finally {
            setCreateBusy(false);
        }
    }, [buildSchedulePayload, createForm, onDataChanged, resetCreateModal]);

    const handleSaveSchedule = useCallback(async (event) => {
        event.preventDefault();
        if (!selectedSchedule) return;
        setSaveBusy(true);
        setSaveError(null);
        try {
            const updated = await oncallApi.update(selectedSchedule._id, buildSchedulePayload(scheduleForm));
            const refreshed = await refreshSelectedSchedule(updated._id);
            setScheduleForm(buildScheduleForm(refreshed));
            onDataChanged();
            notify("On-call schedule updated", "success");
        } catch (submitError) {
            setSaveError(submitError);
            notifyMutationError(submitError, "Unable to update the schedule.");
        } finally {
            setSaveBusy(false);
        }
    }, [buildSchedulePayload, onDataChanged, refreshSelectedSchedule, scheduleForm, selectedSchedule]);

    const handleAddOverride = useCallback(async (event) => {
        event.preventDefault();
        if (!selectedSchedule) return;
        setOverrideBusy(true);
        setOverrideError(null);
        try {
            await oncallApi.addOverride(selectedSchedule._id, {
                responderId: overrideForm.responderId,
                startAt: overrideForm.startAt ? new Date(overrideForm.startAt).toISOString() : "",
                endAt: overrideForm.endAt ? new Date(overrideForm.endAt).toISOString() : "",
                reason: overrideForm.reason,
            });
            const refreshed = await refreshSelectedSchedule(selectedSchedule._id);
            setOverrideForm(createEmptyOverrideForm(overrideForm.responderId || refreshed.currentResponderId || responders[0]?._id || ""));
            onDataChanged();
            notify("Override added", "success");
        } catch (submitError) {
            setOverrideError(submitError);
            notifyMutationError(submitError, "Unable to add the override.");
        } finally {
            setOverrideBusy(false);
        }
    }, [onDataChanged, overrideForm, refreshSelectedSchedule, responders, selectedSchedule]);

    const confirmRemoveOverride = useCallback(async () => {
        if (!selectedSchedule || !removeOverrideTarget) return;
        setRemoveOverrideBusy(true);
        try {
            await oncallApi.removeOverride(selectedSchedule._id, removeOverrideTarget._id);
            const refreshed = await refreshSelectedSchedule(selectedSchedule._id);
            setOverrideForm((current) => createEmptyOverrideForm(current.responderId || refreshed.currentResponderId || responders[0]?._id || ""));
            onDataChanged();
            setRemoveOverrideTarget(null);
            notify("Override removed", "success");
        } catch (removeError) {
            notifyMutationError(removeError, "Unable to remove the override.");
        } finally {
            setRemoveOverrideBusy(false);
        }
    }, [onDataChanged, refreshSelectedSchedule, removeOverrideTarget, responders, selectedSchedule]);

    const confirmDeleteSchedule = useCallback(async () => {
        if (!deleteTarget) return;
        setDeleteBusy(true);
        try {
            await oncallApi.remove(deleteTarget._id);
            setSchedules((current) => current.filter((schedule) => schedule._id !== deleteTarget._id));
            if (selectedScheduleId === deleteTarget._id) closeDetailModal();
            onDataChanged();
            setDeleteTarget(null);
            notify("On-call schedule deleted", "success");
        } catch (deleteError) {
            notifyMutationError(deleteError, "Unable to delete the schedule.");
        } finally {
            setDeleteBusy(false);
        }
    }, [closeDetailModal, deleteTarget, onDataChanged, selectedScheduleId]);

    const createToggleResponder = toggleResponder(setCreateForm);
    const editToggleResponder = toggleResponder(setScheduleForm);
    const createMoveResponder = moveResponder(setCreateForm);
    const editMoveResponder = moveResponder(setScheduleForm);

    const emptyAction = isAdmin ? (
        <button className="button primary" type="button" onClick={() => setIsCreateOpen(true)}>
            <Icon name="add" size={16} />
            New schedule
        </button>
    ) : null;

    return (
        <>
            <div className="page-header">
                <div>
                    <h2>On-Call Schedules</h2>
                    <p className="subtitle">Manage rotations, handoffs, and temporary overrides for responders.</p>
                </div>
                {isAdmin && (
                    <div className="page-header-actions">
                        <button className="button primary" type="button" onClick={() => setIsCreateOpen(true)}>
                            <Icon name="add" size={16} />
                            New schedule
                        </button>
                    </div>
                )}
            </div>

            {loading && <Spinner label="Loading on-call schedules" />}
            {!loading && error && <ErrorBanner message={error} onRetry={loadPage} />}
            {!loading && !error && schedules.length === 0 && (
                <EmptyState
                    action={emptyAction}
                    description={isAdmin ? "Create a rotation so the team always knows who owns the next page." : "No schedules are available yet."}
                    icon="oncall"
                    title="No on-call schedules yet"
                />
            )}

            {!loading && !error && schedules.length > 0 && (
                <div className="card-grid">
                    {schedules.map((schedule) => (
                        <div
                            aria-label={`Open ${schedule.name}`}
                            className="card"
                            key={schedule._id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedScheduleId(schedule._id)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    setSelectedScheduleId(schedule._id);
                                }
                            }}
                        >
                            <div className="card-header">
                                <h3>{schedule.name}</h3>
                            </div>
                            <div className="card-body">
                                <div className="detail-section">
                                    <p>{schedule.description || "No description provided."}</p>
                                    <div className="avatar-stack" aria-label={`${schedule.responders?.length || 0} responders in the rotation`}>
                                        {(schedule.responders || []).map((responder) => (
                                            <Avatar color={responderMap[responder._id]?.avatarColor} key={responder._id} name={responder.name} size="small" />
                                        ))}
                                    </div>
                                    <p>
                                        <strong>Currently on-call:</strong> {schedule.currentResponderName || "Unassigned"}
                                    </p>
                                    <div className="kv-list">
                                        <div className="kv-row">
                                            <span className="kv-label">Rotation</span>
                                            <span className="kv-value">{schedule.rotationType}</span>
                                        </div>
                                        <div className="kv-row">
                                            <span className="kv-label">Shift length</span>
                                            <span className="kv-value">{schedule.shiftLengthHours}h</span>
                                        </div>
                                        <div className="kv-row">
                                            <span className="kv-label">Time zone</span>
                                            <span className="kv-value">{schedule.timeZone}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isCreateOpen && (
                <Modal label="Create on-call schedule" onClose={resetCreateModal}>
                    <div className="modal-header">
                        <h2>New schedule</h2>
                        <button aria-label="Close" className="icon-button" type="button" onClick={resetCreateModal}>
                            <Icon name="close" />
                        </button>
                    </div>
                    <form onSubmit={handleCreateSubmit}>
                        <div className="modal-body">
                            {getFormErrors(createError).length > 0 && <div className="form-error-banner">{getFormErrors(createError).join(" ")}</div>}
                            <ScheduleFormFields
                                fieldErrors={getFieldErrors(createError)}
                                form={createForm}
                                responderMap={responderMap}
                                responders={responders}
                                onChange={updateCreateField}
                                onMoveResponder={createMoveResponder}
                                onToggleResponder={createToggleResponder}
                            />
                        </div>
                        <div className="modal-footer">
                            <button className="button ghost" type="button" onClick={resetCreateModal}>
                                Cancel
                            </button>
                            <button autoFocus className="button primary" disabled={createBusy} type="submit">
                                {createBusy ? "Creating…" : "Create schedule"}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {selectedScheduleId && (
                <Modal label={selectedSchedule?.name || "On-call schedule"} onClose={closeDetailModal}>
                    <div className="modal-header">
                        <h2>{selectedSchedule?.name || "On-call schedule"}</h2>
                        <button aria-label="Close" className="icon-button" type="button" onClick={closeDetailModal}>
                            <Icon name="close" />
                        </button>
                    </div>

                    {detailLoading && (
                        <div className="modal-body">
                            <Spinner label="Loading schedule details" />
                        </div>
                    )}

                    {!detailLoading && detailError && (
                        <div className="modal-body">
                            <ErrorBanner message={detailError} onRetry={() => loadScheduleDetail(selectedScheduleId)} />
                        </div>
                    )}

                    {!detailLoading && !detailError && selectedSchedule && (
                        <>
                            <div className="modal-body">
                                {isAdmin ? (
                                    <form id="schedule-edit-form" onSubmit={handleSaveSchedule}>
                                        {getFormErrors(saveError).length > 0 && <div className="form-error-banner">{getFormErrors(saveError).join(" ")}</div>}
                                        <ScheduleFormFields
                                            fieldErrors={getFieldErrors(saveError)}
                                            form={scheduleForm}
                                            responderMap={responderMap}
                                            responders={responders}
                                            onChange={updateScheduleField}
                                            onMoveResponder={editMoveResponder}
                                            onToggleResponder={editToggleResponder}
                                        />
                                    </form>
                                ) : (
                                    <div className="detail-section">
                                        <h3>Schedule</h3>
                                        <div className="kv-list">
                                            <div className="kv-row">
                                                <span className="kv-label">Description</span>
                                                <span className="kv-value">{selectedSchedule.description || "—"}</span>
                                            </div>
                                            <div className="kv-row">
                                                <span className="kv-label">Time zone</span>
                                                <span className="kv-value">{selectedSchedule.timeZone}</span>
                                            </div>
                                            <div className="kv-row">
                                                <span className="kv-label">Current on-call</span>
                                                <span className="kv-value">{selectedSchedule.currentResponderName || "Unassigned"}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="detail-section">
                                    <h3>Current coverage</h3>
                                    <div className="responder-card">
                                        <Avatar
                                            color={responderMap[selectedSchedule.currentResponderId]?.avatarColor}
                                            name={selectedSchedule.currentResponderName || "Unassigned"}
                                        />
                                        <div className="responder-meta">
                                            <strong>{selectedSchedule.currentResponderName || "Unassigned"}</strong>
                                            <span>
                                                Current on-call • {selectedSchedule.timeZone} • handoff at {selectedSchedule.handoffTime}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="detail-section">
                                    <div className="tabs" role="tablist" aria-label="Schedule details">
                                        <button
                                            aria-selected={activeTab === "shifts"}
                                            className={activeTab === "shifts" ? "active" : ""}
                                            type="button"
                                            onClick={() => setActiveTab("shifts")}
                                        >
                                            Upcoming shifts
                                        </button>
                                        <button
                                            aria-selected={activeTab === "overrides"}
                                            className={activeTab === "overrides" ? "active" : ""}
                                            type="button"
                                            onClick={() => setActiveTab("overrides")}
                                        >
                                            Overrides
                                        </button>
                                    </div>

                                    {activeTab === "shifts" && <ShiftsTable shifts={shifts} />}

                                    {activeTab === "overrides" && (
                                        <>
                                            <div className="detail-section">
                                                <h3>Existing overrides</h3>
                                                <OverridesTable overrides={overrides} onRemove={setRemoveOverrideTarget} />
                                            </div>

                                            <form onSubmit={handleAddOverride}>
                                                <div className="detail-section">
                                                    <h3>Add override</h3>
                                                    {getFormErrors(overrideError).length > 0 && (
                                                        <div className="form-error-banner">{getFormErrors(overrideError).join(" ")}</div>
                                                    )}
                                                    <OverrideFormFields
                                                        busy={overrideBusy}
                                                        fieldErrors={getFieldErrors(overrideError)}
                                                        form={overrideForm}
                                                        responders={responders}
                                                        onChange={updateOverrideField}
                                                    />
                                                </div>
                                            </form>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="modal-footer">
                                {isAdmin && (
                                    <button className="button danger" type="button" onClick={() => setDeleteTarget(selectedSchedule)}>
                                        Delete
                                    </button>
                                )}
                                <button className="button ghost" type="button" onClick={closeDetailModal}>
                                    Close
                                </button>
                                {isAdmin && (
                                    <button autoFocus className="button primary" disabled={saveBusy} form="schedule-edit-form" type="submit">
                                        {saveBusy ? "Saving…" : "Save changes"}
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </Modal>
            )}

            {removeOverrideTarget && (
                <ConfirmDialog
                    busy={removeOverrideBusy}
                    confirmLabel="Remove override"
                    description={`Remove the override for ${removeOverrideTarget.responderName}?`}
                    title="Remove override"
                    tone="danger"
                    onClose={() => !removeOverrideBusy && setRemoveOverrideTarget(null)}
                    onConfirm={confirmRemoveOverride}
                />
            )}

            {deleteTarget && (
                <ConfirmDialog
                    busy={deleteBusy}
                    confirmLabel="Delete schedule"
                    description={`Delete ${deleteTarget.name}? This removes its rotation and any saved overrides.`}
                    title="Delete on-call schedule"
                    tone="danger"
                    onClose={() => !deleteBusy && setDeleteTarget(null)}
                    onConfirm={confirmDeleteSchedule}
                />
            )}
        </>
    );
}
