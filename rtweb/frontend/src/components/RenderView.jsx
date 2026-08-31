import React from "react";

function ReadoutRow({ label, value, accent, dim }) {
  return (
    <div className="readout-row">
      <span className="readout-label">{label}</span>
      <span className={`readout-value ${accent ? "readout-value-accent" : ""} ${dim ? "readout-value-dim" : ""}`}>
        {value}
      </span>
    </div>
  );
}

export default function RenderView({ result, loading }) {
  return (
    <div className="panel render-panel">
      <h2 className="panel-title">Viewport</h2>

      <div className="viewport-frame">
        <span className="bracket bracket-tl" />
        <span className="bracket bracket-tr" />
        <span className="bracket bracket-bl" />
        <span className="bracket bracket-br" />
        {loading && <div className="viewport-placeholder">rendering…</div>}
        {!loading && result && <img src={result.image} alt="Ray traced render" />}
        {!loading && !result && <div className="viewport-placeholder">no render loaded —<br />set the controls and render</div>}
      </div>

      {result && (
        <div className="readout-list" style={{ marginTop: 16 }}>
          <ReadoutRow label="Mode" value={result.mode === "openmp" ? `OpenMP · ${result.threads}T` : "Serial"} />
          <ReadoutRow label="Image size" value={`${result.width} × ${result.height}`} />
          <ReadoutRow label="Time" value={`${(result.time * 1000).toFixed(2)} ms`} accent />
          <ReadoutRow
            label="Speedup"
            value={result.speedup ? `${result.speedup.toFixed(2)}×` : "—"}
            accent={!!result.speedup}
            dim={!result.speedup}
          />
          <ReadoutRow
            label="Efficiency"
            value={result.efficiency ? `${(result.efficiency * 100).toFixed(1)}%` : "—"}
            accent={!!result.efficiency}
            dim={!result.efficiency}
          />
        </div>
      )}

      {result && !result.speedup && result.mode === "openmp" && (
        <p className="hint-text">No serial baseline yet at this size — render Serial once at {result.width} × {result.height} to unlock speedup and efficiency.</p>
      )}
    </div>
  );
}
