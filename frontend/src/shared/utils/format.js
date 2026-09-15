const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const TIME_FORMATTER = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });
const DAY_FORMATTER = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });

export function formatDateTime(value) {
    if (!value) return "—";
    return DATE_TIME_FORMATTER.format(new Date(value));
}

export function formatTime(value) {
    if (!value) return "—";
    return TIME_FORMATTER.format(new Date(value));
}

export function formatDay(value) {
    if (!value) return "—";
    return DAY_FORMATTER.format(new Date(value));
}

export function formatRelativeTime(value) {
    if (!value) return "—";
    const diffMs = Date.now() - new Date(value).getTime();
    const seconds = Math.round(diffMs / 1000);
    const future = seconds < 0;
    const absSeconds = Math.abs(seconds);
    const units = [
        ["y", 31536000],
        ["mo", 2592000],
        ["d", 86400],
        ["h", 3600],
        ["m", 60],
    ];
    for (const [label, unitSeconds] of units) {
        if (absSeconds >= unitSeconds) {
            const amount = Math.floor(absSeconds / unitSeconds);
            return future ? `in ${amount}${label}` : `${amount}${label} ago`;
        }
    }
    return future ? "in moments" : "just now";
}

export function formatDuration(seconds) {
    if (seconds === null || seconds === undefined) return "—";
    const total = Math.max(0, Math.round(seconds));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
}

export function initials(name) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
