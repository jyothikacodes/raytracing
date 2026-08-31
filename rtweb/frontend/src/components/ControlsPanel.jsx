import React from "react";

const SIZE_PRESETS = [
  { label: "100 × 100", w: 100, h: 100 },
  { label: "500 × 500", w: 500, h: 500 },
  { label: "1000 × 1000", w: 1000, h: 1000 },
  { label: "1500 × 1500", w: 1500, h: 1500 },
  { label: "2000 × 2000", w: 2000, h: 2000 },
];

function Switch({ active, onClick, children, row }) {
  return (
    <button
      type="button"
      className={`switch ${active ? "switch-active" : ""}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <span className="switch-led" />
      {children}
    </button>
  );
}

export default function ControlsPanel({
  width, height, setSize,
  spheres, setSpheres,
  mode, setMode,
  threads, setThreads,
  onRender, loading,
}) {
  return (
    <div className="panel controls-panel">
      <h2 className="panel-title">Controls</h2>

      <div className="field">
        <label className="field-label">Image size</label>
        <div className="switch-grid">
          {SIZE_PRESETS.map((p) => (
            <Switch key={p.label} active={width === p.w && height === p.h} onClick={() => setSize(p.w, p.h)}>
              {p.label}
            </Switch>
          ))}
        </div>
        <div className="custom-size-row">
          <input
            type="number" min="10" max="4000" value={width}
            onChange={(e) => setSize(Number(e.target.value), height)}
          />
          <span>×</span>
          <input
            type="number" min="10" max="4000" value={height}
            onChange={(e) => setSize(width, Number(e.target.value))}
          />
        </div>
      </div>

      <div className="field">
        <label className="field-label">Scene</label>
        <div className="switch-grid switch-grid-row">
          <Switch active={spheres === 2} onClick={() => setSpheres(2)}>2 spheres</Switch>
          <Switch active={spheres === 3} onClick={() => setSpheres(3)}>3 spheres</Switch>
        </div>
      </div>

      <div className="field">
        <label className="field-label">Mode</label>
        <div className="switch-grid">
          <Switch active={mode === "serial"} onClick={() => setMode("serial")}>Serial</Switch>
          <Switch active={mode === "openmp"} onClick={() => setMode("openmp")}>OpenMP parallel</Switch>
        </div>
      </div>

      {mode === "openmp" && (
        <div className="field">
          <label className="field-label">Threads</label>
          <div className="switch-grid switch-grid-row">
            {[2, 4, 8].map((t) => (
              <Switch key={t} active={threads === t} onClick={() => setThreads(t)}>{t}</Switch>
            ))}
          </div>
        </div>
      )}

      <button className="render-btn" onClick={onRender} disabled={loading}>
        {loading ? "Rendering" : "Render"}
      </button>
    </div>
  );
}
