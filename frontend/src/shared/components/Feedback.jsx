import { Icon } from "./Icon.jsx";
import { Modal } from "./Modal.jsx";

export function ConfirmDialog({ title, description, confirmLabel = "Confirm", tone = "default", busy = false, onConfirm, onClose }) {
    return (
        <Modal className="confirm-dialog" label={title} onClose={onClose}>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
            <div className="dialog-actions">
                <button className="button ghost" type="button" onClick={onClose}>
                    Cancel
                </button>
                <button autoFocus className={`button ${tone === "danger" ? "danger" : "primary"}`} disabled={busy} type="button" onClick={onConfirm}>
                    {busy ? "Working…" : confirmLabel}
                </button>
            </div>
        </Modal>
    );
}

export function EmptyState({ icon = "info", title, description, action }) {
    return (
        <div className="empty-state">
            <Icon name={icon} size={32} />
            <h3>{title}</h3>
            {description && <p>{description}</p>}
            {action}
        </div>
    );
}

export function Spinner({ label = "Loading" }) {
    return <div aria-label={label} className="spinner" role="status" />;
}

export function ErrorBanner({ message, onRetry }) {
    if (!message) return null;
    return (
        <div className="error-banner" role="alert">
            <Icon name="error" size={18} />
            <span>{message}</span>
            {onRetry && (
                <button className="button ghost small" type="button" onClick={onRetry}>
                    Retry
                </button>
            )}
        </div>
    );
}
