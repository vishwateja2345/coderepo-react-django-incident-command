const listeners = new Set();
let nextId = 1;

export function notify(message, tone = "info") {
    const toast = { id: nextId++, message, tone };
    listeners.forEach((listener) => listener(toast));
}

export function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
