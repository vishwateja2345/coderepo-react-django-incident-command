import { useEffect, useRef } from "react";

export function Modal({ children, className = "", label = "Dialog", labelledBy, onClose }) {
    const reference = useRef(null);
    const closeReference = useRef(onClose);
    const triggerReference = useRef(null);

    useEffect(() => {
        closeReference.current = onClose;
    }, [onClose]);

    useEffect(() => {
        const dialog = reference.current;
        if (!dialog.contains(document.activeElement)) {
            triggerReference.current = document.activeElement;
        }
        dialog.showModal();
        window.requestAnimationFrame(() => dialog.querySelector("[autofocus], [data-autofocus]")?.focus());
        const cancel = (event) => {
            event.preventDefault();
            closeReference.current();
        };
        dialog.addEventListener("cancel", cancel);
        return () => {
            dialog.removeEventListener("cancel", cancel);
            const trigger = triggerReference.current;
            if (trigger instanceof HTMLElement && document.body.contains(trigger)) {
                trigger.focus();
            }
        };
    }, []);

    return (
        <dialog
            aria-label={labelledBy ? undefined : label}
            aria-labelledby={labelledBy}
            className={`modal ${className}`}
            ref={reference}
            onMouseDown={(event) => {
                if (event.target === reference.current) onClose();
            }}
        >
            {children}
        </dialog>
    );
}
