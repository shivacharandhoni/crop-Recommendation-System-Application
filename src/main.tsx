import { Component, StrictMode } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

type BoundaryState = { error: Error | null };

class StartupErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Crop Recommendation System failed to render", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f7f8f3", color: "#292524", fontFamily: "system-ui, sans-serif" }}>
          <section style={{ width: "min(100%, 640px)", padding: 24, border: "1px solid #d6d3d1", borderRadius: 16, background: "white" }}>
            <h1 style={{ margin: "0 0 12px", fontSize: 22 }}>The app could not start</h1>
            <p style={{ margin: "0 0 12px" }}>A browser error stopped the dashboard from loading. This message can help us fix it:</p>
            <pre style={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap", padding: 12, borderRadius: 8, background: "#f5f5f4", fontSize: 13 }}>{this.state.error.message}</pre>
            <button onClick={() => window.location.reload()} style={{ minHeight: 44, padding: "8px 16px", border: 0, borderRadius: 8, background: "#166534", color: "white", fontWeight: 700, cursor: "pointer" }}>Reload app</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById("root");
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>Loading Crop Recommendation System…</div>);
  import("./App").then(({ default: App }) => {
    root.render(<StrictMode><StartupErrorBoundary><App /></StartupErrorBoundary></StrictMode>);
  }).catch((error: unknown) => {
    console.error("Crop Recommendation System failed during startup", error);
    rootElement.innerHTML = `<main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#f7f8f3;color:#292524;font-family:system-ui,sans-serif"><section style="width:min(100%,640px);padding:24px;border:1px solid #d6d3d1;border-radius:16px;background:white"><h1 style="margin:0 0 12px;font-size:22px">The app could not start</h1><p style="margin:0 0 12px">A startup error stopped the dashboard from loading. Reload the page, then share this error with your project helper:</p><pre id="startup-error" style="overflow-wrap:anywhere;white-space:pre-wrap;padding:12px;border-radius:8px;background:#f5f5f4;font-size:13px"></pre><button onclick="window.location.reload()" style="min-height:44px;padding:8px 16px;border:0;border-radius:8px;background:#166534;color:white;font-weight:700;cursor:pointer">Reload app</button></section></main>`;
    const message = error instanceof Error ? error.message : String(error);
    const errorElement = document.getElementById("startup-error");
    if (errorElement) errorElement.textContent = message;
  });
}
