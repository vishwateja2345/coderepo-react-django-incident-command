import { useState } from "react";
import { Icon } from "../../shared/components/Icon.jsx";
import { authApi } from "./auth.api.js";

const SEED_EMAIL = "jordan.blake@northpeak.io";
const SEED_PASSWORD = "password123";

export function Login({ onSignedIn }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [seedSubmitting, setSeedSubmitting] = useState(false);

    async function performLogin(loginEmail, loginPassword) {
        setError("");
        try {
            const { responder, token } = await authApi.login(loginEmail, loginPassword);
            onSignedIn(responder, token);
        } catch (requestError) {
            setError(requestError.message);
        }
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setSubmitting(true);
        await performLogin(email, password);
        setSubmitting(false);
    }

    async function handleSeedLogin() {
        setSeedSubmitting(true);
        await performLogin(SEED_EMAIL, SEED_PASSWORD);
        setSeedSubmitting(false);
    }

    return (
        <main className="auth-screen">
            <section className="auth-showcase" aria-hidden="true">
                <div className="auth-showcase-content">
                    <span className="auth-showcase-eyebrow">On-call workspace</span>
                    <h2>Know what broke, who owns it, and what to do next.</h2>
                    <p>
                        Alerts get deduplicated and grouped into a single incident, escalation policies page the right
                        responder automatically, and every action is logged to a timeline you can hand off at shift change.
                    </p>
                </div>
                <div className="auth-showcase-stats">
                    <div>
                        <strong>Escalation policies</strong>
                        <span>Auto-page the right responder</span>
                    </div>
                    <div>
                        <strong>On-call rotations</strong>
                        <span>Round-the-clock coverage</span>
                    </div>
                    <div>
                        <strong>Runbook workflows</strong>
                        <span>Guided incident response</span>
                    </div>
                </div>
            </section>
            <div className="auth-panel">
                <div className="auth-card">
                    <div className="auth-brand">
                        <span className="auth-brand-mark">
                            <Icon name="incidents" size={18} />
                        </span>
                        <span>Incident Command</span>
                    </div>
                    <div>
                        <h1>Sign in</h1>
                        <p className="subtitle">Access the on-call workspace for your team.</p>
                    </div>
                    <button
                        className="button primary seed-login-button"
                        disabled={submitting || seedSubmitting}
                        type="button"
                        onClick={handleSeedLogin}
                    >
                        <Icon name="zap" size={16} />
                        {seedSubmitting ? "Signing in…" : "Log in with demo account"}
                    </button>
                    <div className="auth-divider">
                        <span>or sign in manually</span>
                    </div>
                    <form className="auth-form" onSubmit={handleSubmit}>
                        <div className="field">
                            <label htmlFor="email">Email</label>
                            <input
                                autoComplete="username"
                                data-autofocus
                                id="email"
                                name="email"
                                required
                                type="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                            />
                        </div>
                        <div className="field">
                            <label htmlFor="password">Password</label>
                            <input
                                autoComplete="current-password"
                                id="password"
                                name="password"
                                required
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                            />
                        </div>
                        {error && <p className="form-error-banner" role="alert">{error}</p>}
                        <button className="button ghost" disabled={submitting || seedSubmitting} type="submit">
                            {submitting ? "Signing in…" : "Sign in"}
                        </button>
                    </form>
                    <div className="auth-seed-hint">
                        Demo credentials: <code>{SEED_EMAIL}</code> / <code>{SEED_PASSWORD}</code>
                    </div>
                </div>
            </div>
        </main>
    );
}


