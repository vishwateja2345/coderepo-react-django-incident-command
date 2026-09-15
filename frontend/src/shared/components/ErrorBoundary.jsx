import { Component } from "react";
import { Icon } from "./Icon.jsx";

export class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        // Lifecycle logging only: surfaces unexpected render failures during operation
        // without leaking implementation details to the user-facing fallback below.
        console.error("Incident Command crashed:", error, info.componentStack);
    }

    handleReload = () => {
        this.setState({ error: null });
        window.location.reload();
    };

    render() {
        if (!this.state.error) return this.props.children;

        if (this.props.inline) {
            return (
                <div className="error-banner" role="alert" style={{ alignItems: "flex-start" }}>
                    <Icon name="error" size={18} />
                    <span>
                        This section hit an unexpected error. Try another page from the sidebar, or reload to recover
                        this one.
                    </span>
                    <button className="button ghost small" type="button" onClick={this.handleReload}>
                        Reload
                    </button>
                </div>
            );
        }

        return (
            <main className="boot-screen">
                <div className="auth-card" style={{ textAlign: "center" }}>
                    <div className="auth-brand" style={{ justifyContent: "center" }}>
                        <span className="auth-brand-mark">
                            <Icon name="error" size={18} />
                        </span>
                        <span>Incident Command</span>
                    </div>
                    <h1>Something went wrong</h1>
                    <p className="subtitle">
                        This page hit an unexpected error. Your data is safe — reloading usually resolves it.
                    </p>
                    <button className="button primary" type="button" onClick={this.handleReload}>
                        Reload the app
                    </button>
                </div>
            </main>
        );
    }
}
