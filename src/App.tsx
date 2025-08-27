import React, { Suspense } from "react";

const Runbook = React.lazy(() => import("./IncidentRescueRunbook"));

class Boundary extends React.Component<{}, { error: any }> {
  constructor(props: {}) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: any) { return { error }; }
  componentDidCatch(error: any, info: any) { console.error("ErrorBoundary:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <pre style={{whiteSpace: "pre-wrap", padding: 16, color: "#b00020"}}>
{String(this.state.error?.message || this.state.error)}
        </pre>
      );
    }
    return this.props.children as any;
  }
}

export default function App() {
  return (
    <Boundary>
      <Suspense fallback={<div style={{padding:16}}>Loading…</div>}>
        <Runbook />
      </Suspense>
    </Boundary>
  );
}
