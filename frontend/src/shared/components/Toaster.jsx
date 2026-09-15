import { useEffect, useState } from "react";
import { Icon } from "./Icon.jsx";
import { subscribe } from "../utils/toast.js";

const AUTO_DISMISS_MS = 5000;
const ICON_BY_TONE = { success: "check_circle", error: "error", info: "info" };

export function Toaster() {
    const [toasts, setToasts] = useState([]);

    useEffect(() => {
        return subscribe((toast) => {
            setToasts((current) => [...current, toast]);
            window.setTimeout(() => {
                setToasts((current) => current.filter((item) => item.id !== toast.id));
            }, AUTO_DISMISS_MS);
        });
    }, []);

    if (!toasts.length) return null;

    return (
        <div aria-live="polite" className="toast-stack">
            {toasts.map((toast) => (
                <div className={`toast ${toast.tone}`} key={toast.id} role="status">
                    <Icon name={ICON_BY_TONE[toast.tone] || "info"} size={18} />
                    <span>{toast.message}</span>
                    <button
                        aria-label="Dismiss"
                        className="toast-dismiss"
                        type="button"
                        onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
                    >
                        <Icon name="close" size={14} />
                    </button>
                </div>
            ))}
        </div>
    );
}
