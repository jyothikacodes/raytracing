import React, { useState } from "react";
import ControlsPanel from "./components/ControlsPanel.jsx";
import RenderView from "./components/RenderView.jsx";
import ThreadVisualizer from "./components/ThreadVisualizer.jsx";
import PerformanceTable from "./components/PerformanceTable.jsx";

const API_BASE = "http://localhost:4000";

export default function App() {
  const [width, setWidth] = useState(500);
  const [height, setHeight] = useState(500);
  const [spheres, setSpheres] = useState(3);
  const [mode, setMode] = useState("serial");
  const [threads, setThreads] = useState(4);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);

  function setSize(w, h) {
    setWidth(w);
    setHeight(h);
  }

  async function handleRender() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ width, height, mode, threads, spheres }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Render failed");
      const data = await res.json();
      setResult(data);
      setHistory((h) => [...h, data]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="masthead">
        <div>
          <h1 className="masthead-title">raytrace lab</h1>
          <p className="masthead-sub">serial vs. OpenMP parallel ray tracing — CSS 311 assignment I</p>
        </div>
        <div className="status-badge">
          <span className={`status-dot ${loading ? "status-active" : ""}`} />
          {loading ? "rendering" : "ready"}
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <div><strong>Error</strong> — {error}</div>
        </div>
      )}

      <div className="main-grid">
        <ControlsPanel
          width={width} height={height} setSize={setSize}
          spheres={spheres} setSpheres={setSpheres}
          mode={mode} setMode={setMode}
          threads={threads} setThreads={setThreads}
          onRender={handleRender} loading={loading}
        />
        <RenderView result={result} loading={loading} />
        <ThreadVisualizer mode={mode} threads={threads} loading={loading} />
      </div>

      <PerformanceTable history={history} />
    </div>
  );
}
