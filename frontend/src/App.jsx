import { useCallback, useEffect, useMemo, useState } from "react";
import { authApi } from "./features/auth/auth.api.js";
import { Login } from "./features/auth/Login.jsx";
import { DashboardPage } from "./features/dashboard/DashboardPage.jsx";
import { IncidentsPage } from "./features/incidents/IncidentsPage.jsx";
import { AlertsPage } from "./features/alerts/AlertsPage.jsx";
import { ServicesPage } from "./features/services/ServicesPage.jsx";
import { OnCallPage } from "./features/oncall/OnCallPage.jsx";
import { EscalationsPage } from "./features/escalations/EscalationsPage.jsx";
import { WorkflowsPage } from "./features/workflows/WorkflowsPage.jsx";
import { AnalyticsPage } from "./features/analytics/AnalyticsPage.jsx";
import { StatusPagePage } from "./features/statuspage/StatusPagePage.jsx";
import { RespondersPage } from "./features/responders/RespondersPage.jsx";
import { Icon } from "./shared/components/Icon.jsx";
import { Avatar } from "./shared/components/Badge.jsx";
import { Toaster } from "./shared/components/Toaster.jsx";
import { hasSessionToken, setSessionToken } from "./shared/api/client.js";

const NAV_SECTIONS = [
    {
        items: [
            { key: "dashboard", label: "Dashboard", icon: "dashboard" },
            { key: "incidents", label: "Incidents", icon: "incidents" },
            { key: "alerts", label: "Alerts", icon: "alerts" },
            { key: "oncall", label: "On-Call", icon: "oncall" },
            { key: "statuspage", label: "Status Page", icon: "statuspage" },
            { key: "analytics", label: "Analytics", icon: "analytics" },
        ],
    },
    {
        label: "Configure",
        items: [
            { key: "services", label: "Services", icon: "services" },
            { key: "escalations", label: "Escalation Policies", icon: "escalations" },
            { key: "workflows", label: "Runbooks", icon: "workflows" },
            { key: "responders", label: "Team", icon: "users" },
        ],
    },
];

const PAGES = {
    dashboard: { title: "Dashboard", Component: DashboardPage },
    incidents: { title: "Incidents", Component: IncidentsPage },
    alerts: { title: "Alerts", Component: AlertsPage },
    oncall: { title: "On-Call Schedules", Component: OnCallPage },
    statuspage: { title: "Status Page", Component: StatusPagePage },
    analytics: { title: "Analytics", Component: AnalyticsPage },
    services: { title: "Services", Component: ServicesPage },
    escalations: { title: "Escalation Policies", Component: EscalationsPage },
    workflows: { title: "Runbooks", Component: WorkflowsPage },
    responders: { title: "Team", Component: RespondersPage },
};

function readTheme() {
    return localStorage.getItem("incident-theme") === "light" ? "light" : "dark";
}

function AppBootScreen() {
    return (
        <main aria-label="Loading Incident Command" className="boot-screen" role="status">
            <div className="auth-brand">
                <span className="auth-brand-mark">
                    <Icon name="incidents" size={20} />
                </span>
                <span>Incident Command</span>
            </div>
        </main>
    );
}

export default function App() {
    const [booting, setBooting] = useState(true);
    const [responder, setResponder] = useState(null);
    const [page, setPage] = useState("dashboard");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [theme, setTheme] = useState(readTheme);
    const [navRevision, setNavRevision] = useState(0);

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem("incident-theme", theme);
    }, [theme]);

    const bootstrap = useCallback(async () => {
        if (!hasSessionToken()) {
            setBooting(false);
            return;
        }
        try {
            const { responder: current } = await authApi.session();
            setResponder(current);
        } catch {
            setSessionToken("");
        } finally {
            setBooting(false);
        }
    }, []);

    useEffect(() => {
        bootstrap();
    }, [bootstrap]);

    useEffect(() => {
        const handleExpired = () => setResponder(null);
        window.addEventListener("incident-session-expired", handleExpired);
        return () => window.removeEventListener("incident-session-expired", handleExpired);
    }, []);

    const handleSignedIn = useCallback((account, token) => {
        setSessionToken(token);
        setResponder(account);
    }, []);

    const handleLogout = useCallback(async () => {
        try {
            await authApi.logout();
        } catch {
            // Ignore network errors on logout; we still clear the local session below.
        }
        setSessionToken("");
        setResponder(null);
    }, []);

    const goTo = useCallback((key) => {
        setPage(key);
        setSidebarOpen(false);
    }, []);

    const refreshNav = useCallback(() => setNavRevision((value) => value + 1), []);

    const activePage = useMemo(() => PAGES[page] || PAGES.dashboard, [page]);
    const ActiveComponent = activePage.Component;

    if (booting) return <AppBootScreen />;
    if (!responder) return <Login onSignedIn={handleSignedIn} />;

    return (
        <div className="app-shell">
            {sidebarOpen && <button aria-label="Close navigation menu" className="sidebar-backdrop" type="button" onClick={() => setSidebarOpen(false)} />}
            <aside className={`app-sidebar ${sidebarOpen ? "open" : ""}`}>
                <div className="sidebar-brand">
                    <span className="sidebar-brand-mark">
                        <Icon name="incidents" size={18} />
                    </span>
                    <span>Incident Command</span>
                </div>
                {NAV_SECTIONS.map((section, index) => (
                    <nav className="sidebar-nav" key={section.label || `section-${index}`}>
                        {section.label && <div className="sidebar-section-label">{section.label}</div>}
                        {section.items.map((item) => (
                            <button
                                className={`sidebar-link ${page === item.key ? "active" : ""}`}
                                key={item.key}
                                type="button"
                                onClick={() => goTo(item.key)}
                            >
                                <Icon name={item.icon} size={18} />
                                {item.label}
                            </button>
                        ))}
                    </nav>
                ))}
                <div className="sidebar-footer">
                    <button className="sidebar-link" type="button" onClick={handleLogout}>
                        <Icon name="logout" size={18} />
                        Sign out
                    </button>
                </div>
            </aside>
            <header className="app-header">
                <button aria-label="Toggle navigation menu" className="icon-button mobile-menu-button" type="button" onClick={() => setSidebarOpen((value) => !value)}>
                    <Icon name="menu" />
                </button>
                <h1>{activePage.title}</h1>
                <div className="header-spacer" />
                <button className="icon-button" title="Toggle theme" type="button" onClick={() => setTheme((value) => (value === "light" ? "dark" : "light"))}>
                    <Icon name={theme === "light" ? "moon" : "sun"} />
                </button>
                <button className="header-user" type="button" onClick={() => goTo("responders")}>
                    <Avatar color={responder.avatarColor} name={responder.name} size="small" />
                    <span>
                        <span className="header-user-name">{responder.name}</span>
                        <span className="header-user-role">{responder.role === "admin" ? "Admin" : "Responder"}</span>
                    </span>
                </button>
            </header>
            <main className="app-main">
                <ActiveComponent currentResponder={responder} navigate={goTo} navRevision={navRevision} onDataChanged={refreshNav} />
            </main>
            <Toaster />
        </div>
    );
}
