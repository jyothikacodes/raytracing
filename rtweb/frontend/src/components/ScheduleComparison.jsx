import React from "react";

export default function ScheduleComparison({ data, onClose }) {
  if (!data) return null;

  const { width, height, threads, chunk, spheres, schedules, winner, baselineTime, source } = data;

  return (
    <div className="panel schedule-comp-panel">
      <div className="schedule-comp-header">
        <div>
          <h2 className="panel-title" style={{ margin: 0, paddingBottom: 0, border: "none" }}>
            OpenMP Schedule Comparison
          </h2>
          <p className="schedule-comp-sub">
            {width} × {height} · {threads} threads · chunk {chunk} · {spheres} spheres
            {baselineTime && ` · Serial baseline: ${(baselineTime * 1000).toFixed(2)} ms`}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="source-tag">{source === "live" ? "Live API run" : "Measured locally"}</span>
          {onClose && (
            <button type="button" className="close-btn" onClick={onClose} aria-label="Close comparison">
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="schedule-cards-grid">
        {schedules.map((item) => {
          const isWinner = item.schedule === winner;
          return (
            <div
              key={item.schedule}
              className={`schedule-card ${isWinner ? "schedule-card-winner" : ""}`}
            >
              <div className="schedule-card-head">
                <span className="schedule-card-name">{item.schedule}</span>
                {isWinner && <span className="winner-pill">WINNER ★</span>}
              </div>

              <div className="schedule-metric">
                <span className="metric-label">Execution time</span>
                <span className={`metric-val ${isWinner ? "metric-val-accent" : ""}`}>
                  {(item.time * 1000).toFixed(2)} ms
                </span>
              </div>

              <div className="schedule-metric-row">
                <div className="schedule-submetric">
                  <span className="metric-sublabel">Speedup</span>
                  <span className="metric-subval">
                    {item.speedup ? `${item.speedup.toFixed(2)}×` : "—"}
                  </span>
                </div>
                <div className="schedule-submetric">
                  <span className="metric-sublabel">Efficiency</span>
                  <span className="metric-subval">
                    {item.efficiency ? `${(item.efficiency * 100).toFixed(1)}%` : "—"}
                  </span>
                </div>
              </div>

              <div className="schedule-desc">
                {item.schedule === "static" && "Contiguous chunk blocks assigned upfront; lowest scheduling overhead."}
                {item.schedule === "dynamic" && "Threads grab chunks from a shared queue; optimal for uneven workloads."}
                {item.schedule === "guided" && "Chunk sizes decrease exponentially to balance load and overhead."}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
