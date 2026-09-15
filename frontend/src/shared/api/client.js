const baseUrl = import.meta.env.VITE_API_URL || "/api/v1";
let sessionToken = localStorage.getItem("incident-session-token") || "";

export function setSessionToken(token) {
    sessionToken = token || "";
    if (sessionToken) localStorage.setItem("incident-session-token", sessionToken);
    else localStorage.removeItem("incident-session-token");
}

export const hasSessionToken = () => Boolean(sessionToken);

export async function request(path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
            ...options.headers,
        },
    });
    if (response.status === 204) return null;
    const contentType = response.headers?.get?.("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : null;
    if (!response.ok) {
        const code = payload?.error?.code;
        const message = payload?.error?.message || `Incident Command service returned ${response.status}.`;
        if (response.status === 401 && ["AUTH_REQUIRED", "INVALID_TOKEN", "ACCOUNT_UNAVAILABLE"].includes(code)) {
            setSessionToken("");
            window.dispatchEvent(new CustomEvent("incident-session-expired", { detail: message }));
        }
        const error = new Error(message);
        error.code = code;
        error.details = payload?.error?.details;
        throw error;
    }
    if (!payload || !("data" in payload)) throw new Error("Incident Command service returned an invalid response.");
    return payload.data;
}

export const get = (path) => request(path);
export const post = (path, body) => request(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
export const patch = (path, body) => request(path, { method: "PATCH", body: JSON.stringify(body) });
export const del = (path) => request(path, { method: "DELETE" });
